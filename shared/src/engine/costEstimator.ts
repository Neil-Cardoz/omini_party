import type { BarOption, BudgetTier, CostEstimate, CostInputs, CostLine } from './types.js';

const DEFAULT_MENU_PRICE: Record<BudgetTier, number> = {
  essential: 24,
  balanced: 42,
  premium: 70,
  luxury: 115,
};

const DEFAULT_DECOR_BASE: Record<BudgetTier, number> = {
  essential: 400,
  balanced: 900,
  premium: 1_800,
  luxury: 3_500,
};

const BAR_PRICE: Record<BarOption, number> = {
  'full-bar': 14,
  'beer-wine': 8,
  'signature-cocktails': 11,
  'mocktail-bar': 5,
  none: 0,
};

const DEFAULT_VENUE_FLAT_FEE = 1_200;
const DEFAULT_VENUE_PRICE_PER_HEAD = 6;
const DEFAULT_PRINT_INVITE_COST = 2.5;
const DEFAULT_FAVOR_UNIT_COST = 3;

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function createCostLine(
  category: string,
  label: string,
  quantity: number,
  unitCost: number,
): CostLine {
  return {
    category,
    label,
    quantity,
    unitCost: round(unitCost),
    subtotal: round(quantity * unitCost),
  };
}

function isWeekend(date: string): boolean {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

function seasonFactor(date: string): number {
  const month = Number(date.slice(5, 7));
  return [11, 12, 1].includes(month) ? 1.1 : 1;
}

export function estimateCost(inputs: CostInputs): CostEstimate {
  const { context } = inputs;
  const weekendFactor = isWeekend(context.date) ? 1.15 : 1;
  const factor = context.cityIndex * seasonFactor(context.date) * weekendFactor;
  const guests = Math.max(0, Math.round(context.guestCount));
  const menuPrice = inputs.menuPricePerHead ?? DEFAULT_MENU_PRICE[context.budgetTier];
  const barOption = inputs.barOption ?? 'none';
  const barGuests = barOption === 'none' ? 0 : Math.max(0, guests - context.ageMix.kids);
  const drinksPerGuest = Math.max(0, 2 + Math.max(0, context.durationHours - 1));
  const venueFlatFee = inputs.venueFlatFee ?? DEFAULT_VENUE_FLAT_FEE;
  const venuePricePerHead = inputs.venuePricePerHead ?? DEFAULT_VENUE_PRICE_PER_HEAD;
  const barPricePerDrink = inputs.barPricePerDrink ?? BAR_PRICE[barOption];
  const decorCost =
    (inputs.decorComplexity ?? 1) *
    (DEFAULT_DECOR_BASE[context.budgetTier] ?? 900) *
    Math.sqrt(Math.max(guests, 1) / 50);
  const mediaCost =
    inputs.mediaCost ??
    (context.budgetTier === 'essential' ? 650 : context.budgetTier === 'luxury' ? 3_000 : 1_400);
  const attireAllowance = inputs.attireAllowance ?? (context.eventType === 'wedding' ? 2_000 : 400);
  const printInviteCost = inputs.printInviteCost ?? DEFAULT_PRINT_INVITE_COST;
  const favorUnitCost = inputs.favorUnitCost ?? DEFAULT_FAVOR_UNIT_COST;

  const lines: CostLine[] = [
    createCostLine('Food & Beverage', 'Menu package', guests, menuPrice * factor),
    createCostLine('Venue & Logistics', 'Venue rental', 1, venueFlatFee),
    createCostLine('Venue & Logistics', 'Venue guest fee', guests, venuePricePerHead * factor),
    createCostLine(
      'Food & Beverage',
      barOption === 'none' ? 'Bar' : `${barOption} drinks`,
      barGuests * drinksPerGuest,
      barPricePerDrink,
    ),
    createCostLine('Décor & Theme', 'Decor and styling', 1, decorCost),
    createCostLine('Entertainment & Media', 'Photo and music', 1, mediaCost),
    createCostLine('Attire & Beauty', 'Host and honoree allowance', 1, attireAllowance),
    createCostLine(
      'Guests & Invitations',
      inputs.digitalInvites === false ? 'Printed invitations' : 'Digital invitations',
      guests,
      inputs.digitalInvites === false ? printInviteCost : 0,
    ),
    createCostLine(
      'Gifts & Favors',
      inputs.favorsEnabled ? 'Guest favors' : 'Favors',
      inputs.favorsEnabled ? guests : 0,
      inputs.favorsEnabled ? favorUnitCost : 0,
    ),
  ];

  const subtotal = round(lines.reduce((sum, line) => sum + line.subtotal, 0));
  const contingency = round(subtotal * (inputs.contingencyRate ?? 0.1));
  const tax = round((subtotal + contingency) * (inputs.taxRate ?? 0));

  return {
    lines,
    subtotal,
    contingency,
    tax,
    total: round(subtotal + contingency + tax),
    currency: 'USD',
  };
}
