import { z } from 'zod';

export const eventTypeSchema = z.enum([
  'wedding',
  'birthday',
  'community',
  'graduation',
  'corporate',
  'baby-shower',
  'other',
]);

export const budgetTierSchema = z.enum(['essential', 'balanced', 'premium', 'luxury']);

export const profileSchema = z.object({
  interests: z.array(eventTypeSchema).default([]),
  role: z.string().min(1).max(80).optional(),
  budgetTier: budgetTierSchema.default('balanced'),
  city: z.string().min(1).max(80).default('New York'),
  currency: z.string().length(3).default('USD'),
  diets: z.array(z.string().min(1).max(40)).max(10).default([]),
  planningStyle: z.enum(['do-it-for-me', 'three-choices', 'customize']).default('three-choices'),
  culture: z.string().max(50).optional(),
  alcoholPref: z.enum(['yes', 'no', 'depends']).default('depends'),
  onboarded: z.boolean().default(false),
});

export const signupSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(160),
  password: z.string().min(8).max(128),
});

export const loginSchema = z.object({
  email: z.string().trim().email().max(160),
  password: z.string().min(8).max(128),
});

export const partySchema = z.object({
  type: eventTypeSchema,
  name: z.string().trim().min(2).max(120),
  honoree: z.string().trim().max(120).default(''),
  date: z.string().date(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).default('22:00'),
  guestCount: z.number().int().min(1).max(100_000),
  budgetTotal: z.number().min(0).max(100_000_000).optional(),
  currency: z.string().length(3).default('USD'),
  wizardState: z.record(z.unknown()).default({}),
});

export const wizardSchema = z.object({
  currentStep: z.number().int().min(1).max(11),
  steps: z.record(
    z.object({
      value: z.unknown(),
      status: z.enum(['pending', 'done', 'stale']),
    }),
  ),
  version: z.number().int().min(1),
});

export const expenseSchema = z.object({
  category: z.string().min(1).max(60),
  label: z.string().min(1).max(120),
  qty: z.number().positive(),
  unitCost: z.number().min(0),
  actual: z.number().min(0).default(0),
});

export type ProfileInput = z.infer<typeof profileSchema>;
export type PartyInput = z.infer<typeof partySchema>;
