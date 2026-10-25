import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { PartyDatabase } from './db/database.js';

const databases: PartyDatabase[] = [];

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
});

function testApp() {
  const database = new PartyDatabase();
  databases.push(database);
  return createApp({ database });
}

describe('celebrAItions API', () => {
  it('logs into demo mode and lists only the owned seeded parties', async () => {
    const app = testApp();
    const agent = request.agent(app);

    const login = await agent.post('/api/v1/auth/demo').expect(200);
    expect(login.body.user.email).toBe('demo@celebraitions.app');

    const parties = await agent.get('/api/v1/parties').expect(200);
    expect(parties.body.parties).toHaveLength(3);
  });

  it('creates a party, autosaves a wizard and reports downstream stale steps', async () => {
    const app = testApp();
    const agent = request.agent(app);
    await agent.post('/api/v1/auth/demo').expect(200);

    const created = await agent
      .post('/api/v1/parties')
      .send({ type: 'birthday', name: 'Maya Turns 8', honoree: 'Maya', date: '2026-08-22', endTime: '18:00', guestCount: 24, currency: 'USD', wizardState: {} })
      .expect(201);

    const partyId = created.body.party.id as string;
    const wizard = await agent
      .put(`/api/v1/parties/${partyId}/wizard`)
      .send({
        currentStep: 2,
        version: 1,
        steps: {
          basics: { value: { type: 'birthday' }, status: 'done' },
          guests: { value: { count: 24 }, status: 'done' },
          budget: { value: { tier: 'balanced' }, status: 'done' },
          location: { value: { venue: 'park' }, status: 'done' },
        },
      })
      .expect(200);

    expect(wizard.body.staleSteps).toEqual(expect.arrayContaining(['budget', 'location', 'menu', 'bar', 'caterer', 'invites']));
    expect(wizard.body.party.wizardState.steps.budget.status).toBe('stale');
  });

  it('rejects cross-user party access instead of leaking data', async () => {
    const first = testApp();
    const firstAgent = request.agent(first);
    await firstAgent.post('/api/v1/auth/demo').expect(200);
    const created = await firstAgent
      .post('/api/v1/parties')
      .send({ type: 'birthday', name: 'Private Party', date: '2026-08-22', endTime: '18:00', guestCount: 10, currency: 'USD', wizardState: {} })
      .expect(201);

    const secondDatabase = new PartyDatabase();
    databases.push(secondDatabase);
    const secondApp = createApp({ database: secondDatabase });
    const secondAgent = request.agent(secondApp);
    await secondAgent.post('/api/v1/auth/signup').send({ name: 'Other Host', email: 'other@example.com', password: 'safe-password' }).expect(201);

    await secondAgent.get(`/api/v1/parties/${created.body.party.id}`).expect(404);
  });

  it('creates a public RSVP invite and rejects duplicate check-in', async () => {
    const app = testApp();
    const agent = request.agent(app);
    await agent.post('/api/v1/auth/demo').expect(200);
    const created = await agent
      .post('/api/v1/parties')
      .send({ type: 'birthday', name: 'Invite Party', date: '2026-08-22', endTime: '18:00', guestCount: 10, currency: 'USD', wizardState: {} })
      .expect(201);
    const guest = await agent.post(`/api/v1/parties/${created.body.party.id}/guests`).send({ name: 'Sam Guest', email: 'sam@example.com' }).expect(201);
    const inviteToken = guest.body.guest.inviteToken as string;

    await request(app).get(`/api/v1/public/rsvp/${inviteToken}`).expect(200);
    const response = await request(app).post(`/api/v1/public/rsvp/${inviteToken}`).send({ rsvp: 'yes' }).expect(200);
    const entryToken = response.body.invite.entryToken as string;

    await agent.post(`/api/v1/parties/${created.body.party.id}/checkin`).send({ entryToken }).expect(200);
    await agent.post(`/api/v1/parties/${created.body.party.id}/checkin`).send({ entryToken }).expect(409);
  });
});
