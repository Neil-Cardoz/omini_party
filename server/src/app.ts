import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import {
  buildEventRecommendations,
  buildTimeline,
  estimateCost,
  getChangedSteps,
  getStaleStepsForChanges,
  type AgeMix,
  type PlanningContext,
  type WizardStep,
  partySchema,
  profileSchema,
  signupSchema,
  loginSchema,
  wizardSchema,
} from '@celebraitions/shared';
import { PartyDatabase, type PartyRecord } from './db/database.js';
import { clearSession, requireAuth, setSession, type AuthenticatedRequest } from './middleware/auth.js';
import { errorHandler } from './middleware/errors.js';
import { createEntryToken, verifyEntryToken } from './services/inviteService.js';
import { generateCreativeResponse } from './services/aiService.js';

const estimateSchema = z.object({
  eventType: partySchema.shape.type,
  guestCount: z.number().int().min(1),
  date: z.string().date(),
  budgetTier: z.enum(['essential', 'balanced', 'premium', 'luxury']).default('balanced'),
  cityIndex: z.number().positive().default(1),
  durationHours: z.number().positive().max(24).default(4),
  ageMix: z.object({ kids: z.number().nonnegative(), teens: z.number().nonnegative(), adults: z.number().nonnegative(), seniors: z.number().nonnegative() }).default({ kids: 0, teens: 0, adults: 0, seniors: 0 }),
  diet: z.array(z.string()).default([]),
  alcoholPref: z.enum(['yes', 'no', 'depends']).default('depends'),
  indoorOutdoor: z.enum(['indoor', 'outdoor', 'mixed']).default('indoor'),
  formality: z.enum(['casual', 'smart-casual', 'formal']).default('smart-casual'),
  referenceDate: z.string().date().optional(),
});

const rsvpSchema = z.object({
  rsvp: z.enum(['yes', 'maybe', 'no']),
  plusOneName: z.string().trim().max(120).optional(),
  plusOneDiet: z.string().trim().max(40).optional(),
  kidsCount: z.number().int().min(0).max(20).default(0),
  message: z.string().trim().max(500).optional(),
});

const checkinSchema = z.object({ entryToken: z.string().min(10) });
const aiChatSchema = z.object({ prompt: z.string().trim().min(1).max(800) });

const jsonObject = (value: unknown): Record<string, unknown> => (value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {});

function contextFromParty(party: PartyRecord): PlanningContext {
  const state = party.wizardState;
  const guests = jsonObject(state.guests);
  const basics = jsonObject(state.basics);
  const options = jsonObject(state.options);
  const ageMix = jsonObject(guests.ageMix) as Partial<AgeMix>;

  return {
    eventType: party.type,
    guestCount: party.guestCount,
    ageMix: {
      kids: Number(ageMix.kids ?? 0),
      teens: Number(ageMix.teens ?? 0),
      adults: Number(ageMix.adults ?? party.guestCount),
      seniors: Number(ageMix.seniors ?? 0),
    },
    budgetTier: (state.budgetTier as PlanningContext['budgetTier']) ?? 'balanced',
    budget: party.budgetTotal,
    cityIndex: Number(state.cityIndex ?? 1),
    date: party.date,
    referenceDate: new Date().toISOString().slice(0, 10),
    durationHours: Number(basics.durationHours ?? 4),
    diet: Array.isArray(state.diet) ? state.diet.filter((value): value is string => typeof value === 'string') : [],
    culture: typeof state.culture === 'string' ? state.culture : undefined,
    alcoholPref: (options.alcoholPref as PlanningContext['alcoholPref']) ?? 'depends',
    indoorOutdoor: (options.indoorOutdoor as PlanningContext['indoorOutdoor']) ?? 'indoor',
    formality: (guests.formality as PlanningContext['formality']) ?? 'smart-casual',
    cuisine: typeof state.cuisine === 'string' ? state.cuisine : undefined,
  };
}

function userId(request: AuthenticatedRequest): string {
  return request.userId!;
}

function routeParam(request: express.Request, name: string): string {
  const value = request.params[name];
  return typeof value === 'string' ? value : '';
}

function validationError(response: express.Response, result: z.SafeParseError<unknown>): void {
  response.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Please check the highlighted fields.', fields: result.error.flatten().fieldErrors } });
}

export interface AppOptions {
  database?: PartyDatabase;
}

export const createApp = (options: AppOptions = {}) => {
  const database = options.database ?? new PartyDatabase(process.env.DATABASE_FILE ?? 'celebraitions.db');
  database.seedDemo();
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173', credentials: true }));
  app.use(express.json({ limit: '100kb' }));

  app.get('/health', (_request, response) => {
    response.json({ ok: true, app: 'celebrAItions' });
  });

  app.post('/api/v1/auth/signup', (request, response) => {
    const parsed = signupSchema.safeParse(request.body);
    if (!parsed.success) return validationError(response, parsed);
    const email = parsed.data.email.toLowerCase();
    if (database.findUserByEmail(email)) {
      response.status(400).json({ error: { code: 'SIGNUP_FAILED', message: 'Unable to create this account.' } });
      return;
    }
    const user = database.createUser(parsed.data.name, email, bcrypt.hashSync(parsed.data.password, 10));
    setSession(response, user.id);
    response.status(201).json({ user });
  });

  app.post('/api/v1/auth/login', (request, response) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) return validationError(response, parsed);
    const user = database.findUserByEmail(parsed.data.email.toLowerCase());
    if (!user || !bcrypt.compareSync(parsed.data.password, user.passwordHash)) {
      response.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' } });
      return;
    }
    setSession(response, user.id);
    response.json({ user: database.getUser(user.id) });
  });

  app.post('/api/v1/auth/demo', (_request, response) => {
    const demo = database.findUserByEmail('demo@celebraitions.app')!;
    setSession(response, demo.id);
    response.json({ user: database.getUser(demo.id) });
  });

  app.post('/api/v1/auth/logout', (_request, response) => {
    clearSession(response);
    response.status(204).send();
  });

  app.get('/api/v1/auth/me', requireAuth, (request: AuthenticatedRequest, response) => {
    const user = database.getUser(userId(request));
    if (!user) {
      response.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Please sign in.' } });
      return;
    }
    response.json({ user });
  });

  app.put('/api/v1/profile', requireAuth, (request: AuthenticatedRequest, response) => {
    const parsed = profileSchema.safeParse(request.body);
    if (!parsed.success) return validationError(response, parsed);
    response.json({ user: database.updateProfile(userId(request), parsed.data) });
  });

  app.get('/api/v1/parties', requireAuth, (request: AuthenticatedRequest, response) => {
    const search = typeof request.query.q === 'string' ? request.query.q : undefined;
    response.json({ parties: database.listParties(userId(request), search) });
  });

  app.post('/api/v1/parties', requireAuth, (request: AuthenticatedRequest, response) => {
    const parsed = partySchema.safeParse(request.body);
    if (!parsed.success) return validationError(response, parsed);
    response.status(201).json({ party: database.createParty(userId(request), parsed.data) });
  });

  app.get('/api/v1/parties/:id', requireAuth, (request: AuthenticatedRequest, response) => {
    const party = database.getParty(userId(request), routeParam(request, 'id'));
    if (!party) {
      response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Party not found.' } });
      return;
    }
    response.json({ party, tasks: database.listTasks(party.id), budget: database.listBudgetItems(party.id), guests: database.listGuests(party.id) });
  });

  app.patch('/api/v1/parties/:id', requireAuth, (request: AuthenticatedRequest, response) => {
    const parsed = partySchema.partial().safeParse(request.body);
    if (!parsed.success) return validationError(response, parsed);
    const party = database.updateParty(userId(request), routeParam(request, 'id'), parsed.data);
    if (!party) {
      response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Party not found.' } });
      return;
    }
    response.json({ party });
  });

  app.delete('/api/v1/parties/:id', requireAuth, (request: AuthenticatedRequest, response) => {
    if (!database.deleteParty(userId(request), routeParam(request, 'id'))) {
      response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Party not found.' } });
      return;
    }
    response.status(204).send();
  });

  app.put('/api/v1/parties/:id/wizard', requireAuth, (request: AuthenticatedRequest, response) => {
    const parsed = wizardSchema.safeParse(request.body);
    if (!parsed.success) return validationError(response, parsed);
    const party = database.getParty(userId(request), routeParam(request, 'id'));
    if (!party) {
      response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Party not found.' } });
      return;
    }
    const previousSteps = jsonObject(party.wizardState.steps) as Partial<Record<WizardStep, unknown>>;
    const nextSteps = parsed.data.steps as Partial<Record<WizardStep, unknown>>;
    const changedSteps = getChangedSteps(previousSteps, nextSteps);
    const staleSteps = getStaleStepsForChanges(changedSteps);
    const steps = { ...parsed.data.steps };
    for (const staleStep of staleSteps) {
      const step = steps[staleStep];
      if (step && step.status === 'done') steps[staleStep] = { ...step, status: 'stale' };
    }
    const saved = database.saveWizard(userId(request), party.id, { ...parsed.data, steps, staleSteps });
    response.json({ party: saved, staleSteps });
  });

  app.post('/api/v1/parties/:id/generate', requireAuth, (request: AuthenticatedRequest, response) => {
    const party = database.getParty(userId(request), routeParam(request, 'id'));
    if (!party) {
      response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Party not found.' } });
      return;
    }
    const context = contextFromParty(party);
    const recommendations = buildEventRecommendations(context);
    const timeline = buildTimeline({ eventType: party.type, eventDate: party.date, referenceDate: context.referenceDate, guestCount: party.guestCount });
    const estimate = estimateCost({ context, barOption: recommendations.bar.defaultOption, digitalInvites: true });
    database.clearPlanData(party.id);
    for (const task of [...timeline, ...recommendations.tasks.map((title) => ({ title, category: 'Smart recommendations', dueDate: party.date, priority: 'high' as const }))]) {
      database.addTask(party.id, task.category, task.title, task.dueDate, task.priority);
    }
    for (const line of estimate.lines.filter((line) => line.subtotal > 0)) {
      database.addBudgetItem(party.id, { category: line.category, label: line.label, qty: line.quantity, unitCost: line.unitCost });
    }
    const updated = database.updateParty(userId(request), party.id, { status: 'planning' });
    response.json({ party: updated, recommendations, timeline, estimate });
  });

  app.post('/api/v1/estimate', (request, response) => {
    const parsed = estimateSchema.safeParse(request.body);
    if (!parsed.success) return validationError(response, parsed);
    const context: PlanningContext = { ...parsed.data, referenceDate: parsed.data.referenceDate ?? new Date().toISOString().slice(0, 10) };
    response.json({ estimate: estimateCost({ context }), recommendations: buildEventRecommendations(context) });
  });

  app.post('/api/v1/ai/chat', requireAuth, async (request: AuthenticatedRequest, response) => {
    const parsed = aiChatSchema.safeParse(request.body);
    if (!parsed.success) return validationError(response, parsed);
    const partyId = typeof request.query.partyId === 'string' ? request.query.partyId : '';
    const party = database.getParty(userId(request), partyId);
    if (!party) return response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Party not found.' } });
    const result = await generateCreativeResponse({ eventType: party.type, partyName: party.name, prompt: parsed.data.prompt, guestCount: party.guestCount, budgetTier: typeof party.wizardState.budgetTier === 'string' ? party.wizardState.budgetTier : undefined });
    response.json(result);
  });

  app.get('/api/v1/suggestions/:step', (_request, response) => {
    const suggestions: Record<string, unknown> = {
      basics: ['wedding', 'birthday', 'community'],
      budget: ['essential', 'balanced', 'premium'],
      menu: ['Buffet', 'Plated', 'Family-style', 'Food stations', 'Potluck'],
      bar: ['Full bar', 'Beer and wine', 'Signature cocktails', 'Mocktail bar', 'None'],
      invites: ['Formal', 'Fun', 'Minimal'],
    };
    const step = routeParam(_request, 'step');
    response.json({ step, suggestions: suggestions[step] ?? [] });
  });

  app.get('/api/v1/public/rsvp/:token', (request, response) => {
    const invite = database.getGuestByToken(routeParam(request, 'token'));
    if (!invite) {
      response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Invite not found.' } });
      return;
    }
    response.json({ invite: { guestName: invite.name, rsvp: invite.rsvp, diet: invite.diet, plusOneName: invite.plusOneName, message: invite.message, party: { id: invite.party.id, name: invite.party.name, type: invite.party.type, honoree: invite.party.honoree, date: invite.party.date, endTime: invite.party.endTime, guestCount: invite.party.guestCount } } });
  });

  app.post('/api/v1/public/rsvp/:token', (request, response) => {
    const parsed = rsvpSchema.safeParse(request.body);
    if (!parsed.success) return validationError(response, parsed);
    const invite = database.updateGuestRsvp(routeParam(request, 'token'), parsed.data);
    if (!invite) {
      response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Invite not found.' } });
      return;
    }
    response.json({ invite: { guestName: invite.name, rsvp: invite.rsvp, party: { id: invite.party.id, name: invite.party.name, date: invite.party.date, endTime: invite.party.endTime }, entryToken: parsed.data.rsvp === 'yes' ? createEntryToken(invite.id, invite.party.id) : undefined } });
  });

  app.get('/api/v1/parties/:id/tasks', requireAuth, (request: AuthenticatedRequest, response) => {
    const party = database.getParty(userId(request), routeParam(request, 'id'));
    if (!party) return response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Party not found.' } });
    response.json({ tasks: database.listTasks(party.id) });
  });

  app.get('/api/v1/parties/:id/budget', requireAuth, (request: AuthenticatedRequest, response) => {
    const party = database.getParty(userId(request), routeParam(request, 'id'));
    if (!party) return response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Party not found.' } });
    response.json({ budget: database.listBudgetItems(party.id) });
  });

  app.get('/api/v1/parties/:id/guests', requireAuth, (request: AuthenticatedRequest, response) => {
    const party = database.getParty(userId(request), routeParam(request, 'id'));
    if (!party) return response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Party not found.' } });
    response.json({ guests: database.listGuests(party.id) });
  });

  app.post('/api/v1/parties/:id/guests', requireAuth, (request: AuthenticatedRequest, response) => {
    const party = database.getParty(userId(request), routeParam(request, 'id'));
    const input = z.object({ name: z.string().trim().min(1).max(120), email: z.string().email().max(160).optional(), diet: z.string().max(40).optional() }).safeParse(request.body);
    if (!party) return response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Party not found.' } });
    if (!input.success) return validationError(response, input);
    response.status(201).json({ guest: database.createGuest(party.id, input.data.name, input.data.email, input.data.diet) });
  });

  app.get('/api/v1/parties/:id/guests/:guestId/invite', requireAuth, (request: AuthenticatedRequest, response) => {
    const party = database.getParty(userId(request), routeParam(request, 'id'));
    if (!party) return response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Party not found.' } });
    const guest = database.getGuestById(party.id, routeParam(request, 'guestId'));
    if (!guest) return response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Guest not found.' } });
    response.json({ inviteToken: guest.inviteToken, entryToken: createEntryToken(guest.id, party.id) });
  });

  app.post('/api/v1/parties/:id/checkin', requireAuth, (request: AuthenticatedRequest, response) => {
    const parsed = checkinSchema.safeParse(request.body);
    if (!parsed.success) return validationError(response, parsed);
    const party = database.getParty(userId(request), routeParam(request, 'id'));
    if (!party) return response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Party not found.' } });
    const verified = verifyEntryToken(parsed.data.entryToken);
    if (!verified || verified.partyId !== party.id) return response.status(400).json({ error: { code: 'INVALID_INVITE', message: 'Invalid invite.' } });
    const result = database.checkInGuest(party.id, verified.guestId);
    if (!result) return response.status(400).json({ error: { code: 'INVALID_INVITE', message: 'Invalid invite.' } });
    if (result.status === 'already-checked-in') return response.status(409).json({ error: { code: 'ALREADY_CHECKED_IN', message: 'This invite has already been checked in.', checkedInAt: result.guest.checkedInAt } });
    response.json({ status: result.status, guest: { name: result.guest.name, plusOneName: result.guest.plusOneName } });
  });

  app.get('/api/v1/parties/:id/ics', requireAuth, (request: AuthenticatedRequest, response) => {
    const party = database.getParty(userId(request), routeParam(request, 'id'));
    if (!party) return response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Party not found.' } });
    const date = party.date.replaceAll('-', '');
    const time = party.endTime.replace(':', '') + '00';
    const body = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//celebrAItions//EN', 'BEGIN:VEVENT', `UID:${party.id}@celebraitions`, `DTSTAMP:${new Date().toISOString().replaceAll(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')}`, `DTSTART:${date}T120000`, `DTEND:${date}T${time}`, `SUMMARY:${party.name}`, `DESCRIPTION:Planned with celebrAItions`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    response.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    response.setHeader('Content-Disposition', `attachment; filename="${party.name.replaceAll(/[^a-z0-9]+/gi, '-').toLowerCase()}.ics"`);
    response.send(body);
  });

  app.use(errorHandler);
  return app;
};
