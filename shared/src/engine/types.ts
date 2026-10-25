import type { EventType } from '../index.js';

export type BudgetTier = 'essential' | 'balanced' | 'premium' | 'luxury';
export type AlcoholPreference = 'yes' | 'no' | 'depends';
export type IndoorOutdoor = 'indoor' | 'outdoor' | 'mixed';

export interface AgeMix {
  kids: number;
  teens: number;
  adults: number;
  seniors: number;
}

export interface PlanningContext {
  eventType: EventType;
  guestCount: number;
  ageMix: AgeMix;
  budgetTier: BudgetTier;
  budget?: number;
  cityIndex: number;
  date: string;
  referenceDate: string;
  durationHours: number;
  diet: string[];
  culture?: string;
  alcoholPref: AlcoholPreference;
  indoorOutdoor: IndoorOutdoor;
  formality: 'casual' | 'smart-casual' | 'formal';
  cuisine?: string;
}

export interface RuleDecision<T> {
  value: T;
  reason: string;
}

export type BarOption = 'full-bar' | 'beer-wine' | 'signature-cocktails' | 'mocktail-bar' | 'none';

export interface BarRecommendation {
  defaultOption: BarOption;
  offeredOptions: BarOption[];
  guestCountForDrinks: number;
  reason: string;
}

export type GiftGuidance =
  | 'wedding-registry'
  | 'birthday-gifts-and-favors'
  | 'community-raffle'
  | 'general-gifts'
  | 'no-gifts';

export interface GiftRecommendation {
  guidance: GiftGuidance;
  options: string[];
  reason: string;
}

export interface EventRecommendations {
  tasks: string[];
  warnings: string[];
  bar: BarRecommendation;
  gifts: GiftRecommendation;
  attire: RuleDecision<string>;
  timelineDays: number;
}

export interface CostInputs {
  context: PlanningContext;
  menuPricePerHead?: number;
  venueFlatFee?: number;
  venuePricePerHead?: number;
  barOption?: BarOption;
  barPricePerDrink?: number;
  decorComplexity?: number;
  mediaCost?: number;
  attireAllowance?: number;
  digitalInvites?: boolean;
  printInviteCost?: number;
  favorsEnabled?: boolean;
  favorUnitCost?: number;
  contingencyRate?: number;
  taxRate?: number;
}

export interface CostLine {
  category: string;
  label: string;
  quantity: number;
  unitCost: number;
  subtotal: number;
}

export interface CostEstimate {
  lines: CostLine[];
  subtotal: number;
  contingency: number;
  tax: number;
  total: number;
  currency: string;
}

export interface TimelineInput {
  eventType: EventType;
  eventDate: string;
  referenceDate: string;
  guestCount: number;
}

export interface TimelineTask {
  title: string;
  category: string;
  dueOffsetDays: number;
  dueDate: string;
  priority: 'normal' | 'high';
  status: 'todo' | 'overdue';
}

export interface Vendor {
  id: string;
  name: string;
  capacityMin: number;
  capacityMax: number;
  pricePerHead: number;
  cuisines: string[];
  diets: string[];
  rating: number;
  available: boolean;
}

export interface VendorSearchContext {
  guestCount: number;
  budgetPerHead: number;
  diet: string[];
  cuisine?: string;
}

export interface RankedVendor extends Vendor {
  score: number;
  reasons: string[];
}
