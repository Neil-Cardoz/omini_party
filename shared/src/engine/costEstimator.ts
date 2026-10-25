import type { BarOption, CostEstimate, CostInputs, CostLine } from './types.js';

const DEFAULT_MENU_PRICE: Record<CostInputs['context']['budgetTier'], number> = {
  essential: 24,
  balanced: 42,
  premium: 70,
  luxury: 115,
};

const DEFAULT_DECOR_BASE: Record<CostInputs['context']['budgetTier'], number> = {
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

function round(value: number): number {
  return Math.round(value * 100) / 100;
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

  const lines: CostLine[] = [
    {
      category: 'Food & Beverage',
      label: 'Menu package',
      quantity: guests,
      unitCost: round(menuPrice * factor),
      subtotal: round(guests * menuPrice * factor),
    },
    {
      category: 'Venue & Logistics',
      label: 'Venue rental',
      quantity: 1,
      unitCost: round(inputs.venueFlatFee ?? 1_200),
      subtotal: round(inputs.venueFlatFee ?? 1_200),
    },
    {
      category: 'Venue & Logistics',
      label: 'Venue guest fee',
      quantity: guests,
      unitCost: round((inputs.venuePricePerHead ?? 6) * factor),
      subtotal: round(guests * (inputs.venuePricePerHead ?? 6) * factor),
    },
    {
      category: 'Food & Beverage',
      label: barOption === 'none' ? 'Bar' : `${barOption} drinks`,
      quantity: barGuests * drinksPerGuest,
      unitCost: round(inputs.barPricePerDrink ?? BAR_PRICE[barOption]),
      subtotal: round(barGuests * drinksPerGuest * (inputs.barPricePerDrink ?? BAR_PRICE[barOption])),
    },
    {
      category: 'Décor & Theme',
      label: 'Decor and styling',
      quantity: 1,
      unitCost: round((inputs.decorComplexity ?? 1) * (DEFAULT_DECOR_BASE[context.budgetTier] ?? 900) * Math.sqrt(Math.max(guests, 1) / 50)),
      subtotal: round((inputs.decorComplexity ?? 1) * (DEFAULT_DECOR_BASE[context.budgetTier] ?? 900) * Math.sqrt(Math.max(guests, 1) / 50)),
    },
    {
      category: 'Entertainment & Media',
      label: 'Photo and music',
      quantity: 1,
      unitCost: round(inputs.mediaCost ?? (context.budgetTier === 'essential' ? 650 : context.budgetTier === 'luxury' ? 3_000 : 1_400)),
      subtotal: round(inputs.mediaCost ?? (context.budgetTier === 'essential' ? 650 : context.budgetTier === 'luxury' ? 3_000 : 1_400)),
    },
    {
      category: 'Attire & Beauty',
      label: 'Host and honoree allowance',
      quantity: 1,
      unitCost: round(inputs.attireAllowance ?? (context.eventType === 'wedding' ? 2_000 : 400)),
      subtotal: round(inputs.attireAllowance ?? (context.eventType === 'wedding' ? 2_000 : 400)),
    },
    {
      category: 'Guests & Invitations',
      label: inputs.digitalInvites === false ? 'Printed invitations' : 'Digital invitations',
      quantity: guests,
      unitCost: inputs.digitalInvites === false ? round(inputs.printInviteCost ?? 2.5) : 0,
      subtotal: inputs.digitalInvites === false ? round(guests * (inputs.printInviteCost ?? 2.5)) : 0,
    },
    {
      category: 'Gifts & Favors',
      label: inputs.favorsEnabled ? 'Guest favors' : 'Favors',
      quantity: inputs.favorsEnabled ? guests : 0,
      unitCost: inputs.favorsEnabled ? round(inputs.favorUnitCost ?? 3) : 0,
      subtotal: inputs.favorsEnabled ? round(guests * (inputs.favorUnitCost ?? 3)) : 0,
    },
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
