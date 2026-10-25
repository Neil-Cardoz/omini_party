import type { EventType } from '@celebraitions/shared';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api/v1';

export interface User {
  id: string;
  name: string;
  email: string;
  onboarded: boolean;
}

export interface Party {
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

export interface Task {
  id: string;
  partyId: string;
  category: string;
  title: string;
  dueDate: string;
  priority: string;
  status: string;
}

export interface Guest {
  id: string;
  partyId: string;
  name: string;
  email: string;
  diet: string;
  rsvp: string;
  plusOneAllowed: boolean;
  checkedInAt: string | null;
}

export interface BudgetItem {
  id: string;
  category: string;
  label: string;
  qty: number;
  unitCost: number;
  estimated: number;
  actual: number;
  paid: boolean;
}

export interface Estimate {
  subtotal: number;
  contingency: number;
  tax: number;
  total: number;
  currency: string;
  lines: Array<{ category: string; label: string; quantity: number; unitCost: number; subtotal: number }>;
}

export interface Recommendations {
  tasks: string[];
  warnings: string[];
  bar: { defaultOption: string; offeredOptions: string[]; reason: string };
  gifts: { guidance: string; options: string[]; reason: string };
  attire: { value: string; reason: string };
  timelineDays: number;
}

export interface PartyDetail {
  party: Party;
  tasks: Task[];
  budget: BudgetItem[];
  guests: Guest[];
}

interface ApiErrorPayload {
  error?: { message?: string };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as ApiErrorPayload;
    throw new Error(payload.error?.message ?? `Request failed (${response.status})`);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

const json = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) });

export const api = {
  me: () => request<{ user: User }>('/auth/me'),
  login: (body: { email: string; password: string }) => request<{ user: User }>('/auth/login', json(body)),
  signup: (body: { name: string; email: string; password: string }) => request<{ user: User }>('/auth/signup', json(body)),
  demo: () => request<{ user: User }>('/auth/demo', json({})),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),
  updateProfile: (body: Record<string, unknown>) => request<{ user: User }>('/profile', { method: 'PUT', body: JSON.stringify(body) }),
  listParties: (query = '') => request<{ parties: Party[] }>(`/parties${query ? `?q=${encodeURIComponent(query)}` : ''}`),
  getParty: (id: string) => request<PartyDetail>(`/parties/${id}`),
  createParty: (body: Record<string, unknown>) => request<{ party: Party }>('/parties', json(body)),
  saveWizard: (id: string, body: Record<string, unknown>) => request<{ party: Party; staleSteps: string[] }>(`/parties/${id}/wizard`, { method: 'PUT', body: JSON.stringify(body) }),
  generate: (id: string) => request<{ party: Party; recommendations: Recommendations; estimate: Estimate }>(`/parties/${id}/generate`, json({})),
  estimate: (body: Record<string, unknown>) => request<{ estimate: Estimate; recommendations: Recommendations }>('/estimate', json(body)),
  addGuest: (id: string, body: { name: string; email?: string | undefined; diet?: string | undefined }) => request<{ guest: Guest }>(`/parties/${id}/guests`, json(body)),
};
