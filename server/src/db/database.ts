import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import type * as NodeSqlite from 'node:sqlite';
import bcrypt from 'bcryptjs';
import type { EventType, PartyInput, ProfileInput } from '@celebraitions/shared';

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof NodeSqlite;

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  onboarded: boolean;
}

export interface PartyRecord {
  id: string;
  ownerId: string;
  type: EventType;
  name: string;
  honoree: string;
  date: string;
  endTime: string;
  status: string;
  guestCount: number;
  budgetTotal: number;
  currency: string;
  wizardState: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface TaskRecord {
  id: string;
  partyId: string;
  category: string;
  title: string;
  dueDate: string;
  priority: string;
  status: string;
}

export interface GuestRecord {
  id: string;
  partyId: string;
  name: string;
  email: string;
  diet: string;
  rsvp: string;
  plusOneAllowed: boolean;
  checkedInAt: string | null;
}

export interface PartyUpdateInput {
  type?: EventType | undefined;
  name?: string | undefined;
  honoree?: string | undefined;
  date?: string | undefined;
  endTime?: string | undefined;
  status?: string | undefined;
  guestCount?: number | undefined;
  budgetTotal?: number | undefined;
  currency?: string | undefined;
  wizardState?: Record<string, unknown> | undefined;
}

const schema = `
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS user_profiles (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    interests TEXT NOT NULL DEFAULT '[]',
    role TEXT NOT NULL DEFAULT '',
    budget_tier TEXT NOT NULL DEFAULT 'balanced',
    city TEXT NOT NULL DEFAULT 'New York',
    currency TEXT NOT NULL DEFAULT 'USD',
    diets TEXT NOT NULL DEFAULT '[]',
    planning_style TEXT NOT NULL DEFAULT 'three-choices',
    culture TEXT,
    alcohol_pref TEXT NOT NULL DEFAULT 'depends',
    onboarded INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS parties (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    honoree TEXT NOT NULL DEFAULT '',
    date TEXT NOT NULL,
    end_time TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    guest_count INTEGER NOT NULL,
    budget_total REAL NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'USD',
    wizard_state TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    party_id TEXT NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    due_date TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'normal',
    status TEXT NOT NULL DEFAULT 'todo'
  );
  CREATE TABLE IF NOT EXISTS budget_items (
    id TEXT PRIMARY KEY,
    party_id TEXT NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    label TEXT NOT NULL,
    qty REAL NOT NULL,
    unit_cost REAL NOT NULL,
    estimated REAL NOT NULL,
    actual REAL NOT NULL DEFAULT 0,
    paid INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS guests (
    id TEXT PRIMARY KEY,
    party_id TEXT NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT NOT NULL DEFAULT '',
    diet TEXT NOT NULL DEFAULT '',
    rsvp TEXT NOT NULL DEFAULT 'pending',
    plus_one_allowed INTEGER NOT NULL DEFAULT 0,
    checked_in_at TEXT
  );
  CREATE INDEX IF NOT EXISTS parties_owner_date ON parties(owner_id, date);
  CREATE INDEX IF NOT EXISTS tasks_party_due ON tasks(party_id, due_date);
`;

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string') return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export class PartyDatabase {
  readonly db: NodeSqlite.DatabaseSync;

  constructor(filename = ':memory:') {
    this.db = new DatabaseSync(filename);
    this.db.exec(schema);
  }

  close(): void {
    this.db.close();
  }

  seedDemo(): void {
    const existing = this.db.prepare('SELECT id FROM users WHERE email = ?').get('demo@celebraitions.app');
    if (existing) return;

    const userId = randomUUID();
    this.db
      .prepare('INSERT INTO users (id, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(userId, 'Asha Demo', 'demo@celebraitions.app', bcrypt.hashSync('demo1234', 10), new Date().toISOString());
    this.db.prepare('INSERT INTO user_profiles (user_id) VALUES (?)').run(userId);

    const examples: Array<PartyInput & { status: string }> = [
      {
        type: 'wedding',
        name: 'Riya & Arjun Wedding',
        honoree: 'Riya and Arjun',
        date: '2026-12-12',
        endTime: '23:00',
        guestCount: 180,
        budgetTotal: 10_000,
        currency: 'USD',
        wizardState: {},
        status: 'planning',
      },
      {
        type: 'birthday',
        name: 'Aarav Turns 7',
        honoree: 'Aarav',
        date: '2026-11-03',
        endTime: '18:00',
        guestCount: 20,
        budgetTotal: 2_500,
        currency: 'USD',
        wizardState: {},
        status: 'planning',
      },
      {
        type: 'community',
        name: 'Neighborhood Harvest Mela',
        honoree: '',
        date: '2026-11-01',
        endTime: '20:00',
        guestCount: 250,
        budgetTotal: 5_500,
        currency: 'USD',
        wizardState: {},
        status: 'confirmed',
      },
    ];

    for (const example of examples) {
      const party = this.createParty(userId, example);
      this.addTask(party.id, 'Venue & Logistics', 'Confirm key logistics', party.date, 'normal');
    }
  }

  findUserByEmail(email: string): (UserRecord & { passwordHash: string }) | undefined {
    const row = this.db
      .prepare('SELECT id, name, email, password_hash, onboarded FROM users u LEFT JOIN user_profiles p ON p.user_id = u.id WHERE lower(email) = lower(?)')
      .get(email) as Record<string, unknown> | undefined;
    if (!row) return undefined;
    return {
      id: String(row.id),
      name: String(row.name),
      email: String(row.email),
      passwordHash: String(row.password_hash),
      onboarded: Boolean(row.onboarded),
    };
  }

  createUser(name: string, email: string, passwordHash: string): UserRecord {
    const id = randomUUID();
    this.db
      .prepare('INSERT INTO users (id, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(id, name, email, passwordHash, new Date().toISOString());
    this.db.prepare('INSERT INTO user_profiles (user_id) VALUES (?)').run(id);
    return { id, name, email, onboarded: false };
  }

  getUser(id: string): UserRecord | undefined {
    const row = this.db
      .prepare('SELECT u.id, u.name, u.email, COALESCE(p.onboarded, 0) AS onboarded FROM users u LEFT JOIN user_profiles p ON p.user_id = u.id WHERE u.id = ?')
      .get(id) as Record<string, unknown> | undefined;
    if (!row) return undefined;
    return { id: String(row.id), name: String(row.name), email: String(row.email), onboarded: Boolean(row.onboarded) };
  }

  updateProfile(userId: string, profile: ProfileInput): UserRecord | undefined {
    this.db
      .prepare(`UPDATE user_profiles SET interests = ?, role = ?, budget_tier = ?, city = ?, currency = ?, diets = ?, planning_style = ?, culture = ?, alcohol_pref = ?, onboarded = ? WHERE user_id = ?`)
      .run(JSON.stringify(profile.interests), profile.role ?? '', profile.budgetTier, profile.city, profile.currency, JSON.stringify(profile.diets), profile.planningStyle, profile.culture ?? null, profile.alcoholPref, profile.onboarded ? 1 : 0, userId);
    return this.getUser(userId);
  }

  listParties(ownerId: string, search?: string): PartyRecord[] {
    const rows = (search
      ? this.db.prepare('SELECT * FROM parties WHERE owner_id = ? AND name LIKE ? ORDER BY date').all(ownerId, `%${search}%`)
      : this.db.prepare('SELECT * FROM parties WHERE owner_id = ? ORDER BY date').all(ownerId)) as Array<Record<string, unknown>>;
    return rows.map((row) => this.toParty(row));
  }

  getParty(ownerId: string, id: string): PartyRecord | undefined {
    const row = this.db.prepare('SELECT * FROM parties WHERE owner_id = ? AND id = ?').get(ownerId, id) as Record<string, unknown> | undefined;
    return row ? this.toParty(row) : undefined;
  }

  createParty(ownerId: string, input: PartyInput & { status?: string }): PartyRecord {
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db
      .prepare(`INSERT INTO parties (id, owner_id, type, name, honoree, date, end_time, status, guest_count, budget_total, currency, wizard_state, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, ownerId, input.type, input.name, input.honoree, input.date, input.endTime, input.status ?? 'draft', input.guestCount, input.budgetTotal ?? 0, input.currency, JSON.stringify(input.wizardState), now, now);
    return this.getParty(ownerId, id)!;
  }

  updateParty(ownerId: string, id: string, values: PartyUpdateInput): PartyRecord | undefined {
    const party = this.getParty(ownerId, id);
    if (!party) return undefined;
    const next = {
      type: values.type ?? party.type,
      name: values.name ?? party.name,
      honoree: values.honoree ?? party.honoree,
      date: values.date ?? party.date,
      endTime: values.endTime ?? party.endTime,
      status: values.status ?? party.status,
      guestCount: values.guestCount ?? party.guestCount,
      budgetTotal: values.budgetTotal ?? party.budgetTotal,
      currency: values.currency ?? party.currency,
      wizardState: values.wizardState ?? party.wizardState,
    };
    this.db
      .prepare(`UPDATE parties SET type = ?, name = ?, honoree = ?, date = ?, end_time = ?, status = ?, guest_count = ?, budget_total = ?, currency = ?, wizard_state = ?, updated_at = ? WHERE owner_id = ? AND id = ?`)
      .run(next.type, next.name, next.honoree, next.date, next.endTime, next.status, next.guestCount, next.budgetTotal, next.currency, JSON.stringify(next.wizardState), new Date().toISOString(), ownerId, id);
    return this.getParty(ownerId, id);
  }

  deleteParty(ownerId: string, id: string): boolean {
    const result = this.db.prepare('DELETE FROM parties WHERE owner_id = ? AND id = ?').run(ownerId, id);
    return result.changes > 0;
  }

  saveWizard(ownerId: string, id: string, state: Record<string, unknown>): PartyRecord | undefined {
    this.db.prepare('UPDATE parties SET wizard_state = ?, status = ?, updated_at = ? WHERE owner_id = ? AND id = ?').run(JSON.stringify(state), 'draft', new Date().toISOString(), ownerId, id);
    return this.getParty(ownerId, id);
  }

  addTask(partyId: string, category: string, title: string, dueDate: string, priority: string): TaskRecord {
    const id = randomUUID();
    this.db.prepare('INSERT INTO tasks (id, party_id, category, title, due_date, priority) VALUES (?, ?, ?, ?, ?, ?)').run(id, partyId, category, title, dueDate, priority);
    return this.getTask(id)!;
  }

  listTasks(partyId: string): TaskRecord[] {
    const rows = this.db.prepare('SELECT id, party_id, category, title, due_date, priority, status FROM tasks WHERE party_id = ? ORDER BY due_date').all(partyId) as Array<Record<string, unknown>>;
    return rows.map((row) => this.toTask(row));
  }

  addBudgetItem(partyId: string, item: { category: string; label: string; qty: number; unitCost: number; actual?: number }): void {
    this.db.prepare('INSERT INTO budget_items (id, party_id, category, label, qty, unit_cost, estimated, actual) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(randomUUID(), partyId, item.category, item.label, item.qty, item.unitCost, item.qty * item.unitCost, item.actual ?? 0);
  }

  listBudgetItems(partyId: string): Array<Record<string, unknown>> {
    return this.db.prepare('SELECT id, category, label, qty, unit_cost AS unitCost, estimated, actual, paid FROM budget_items WHERE party_id = ? ORDER BY category, label').all(partyId) as Array<Record<string, unknown>>;
  }

  createGuest(partyId: string, name: string, email = '', diet = ''): GuestRecord {
    const id = randomUUID();
    this.db.prepare('INSERT INTO guests (id, party_id, name, email, diet) VALUES (?, ?, ?, ?, ?)').run(id, partyId, name, email, diet);
    return this.getGuest(id)!;
  }

  listGuests(partyId: string): GuestRecord[] {
    const rows = this.db.prepare('SELECT id, party_id, name, email, diet, rsvp, plus_one_allowed, checked_in_at FROM guests WHERE party_id = ? ORDER BY name').all(partyId) as Array<Record<string, unknown>>;
    return rows.map((row) => this.toGuest(row));
  }

  private getTask(id: string): TaskRecord | undefined {
    const row = this.db.prepare('SELECT id, party_id, category, title, due_date, priority, status FROM tasks WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    return row ? this.toTask(row) : undefined;
  }

  private getGuest(id: string): GuestRecord | undefined {
    const row = this.db.prepare('SELECT id, party_id, name, email, diet, rsvp, plus_one_allowed, checked_in_at FROM guests WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    return row ? this.toGuest(row) : undefined;
  }

  private toParty(row: Record<string, unknown>): PartyRecord {
    return {
      id: String(row.id),
      ownerId: String(row.owner_id),
      type: row.type as EventType,
      name: String(row.name),
      honoree: String(row.honoree),
      date: String(row.date),
      endTime: String(row.end_time),
      status: String(row.status),
      guestCount: Number(row.guest_count),
      budgetTotal: Number(row.budget_total),
      currency: String(row.currency),
      wizardState: parseJson<Record<string, unknown>>(row.wizard_state, {}),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  }

  private toTask(row: Record<string, unknown>): TaskRecord {
    return {
      id: String(row.id),
      partyId: String(row.party_id),
      category: String(row.category),
      title: String(row.title),
      dueDate: String(row.due_date),
      priority: String(row.priority),
      status: String(row.status),
    };
  }

  private toGuest(row: Record<string, unknown>): GuestRecord {
    return {
      id: String(row.id),
      partyId: String(row.party_id),
      name: String(row.name),
      email: String(row.email),
      diet: String(row.diet),
      rsvp: String(row.rsvp),
      plusOneAllowed: Boolean(row.plus_one_allowed),
      checkedInAt: row.checked_in_at ? String(row.checked_in_at) : null,
    };
  }
}
