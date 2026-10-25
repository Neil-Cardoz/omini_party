import type { RankedVendor, Vendor, VendorSearchContext } from './types.js';

function overlapScore(requested: string[], offered: string[]): number {
  if (requested.length === 0) return 1;
  const normalized = new Set(offered.map((value) => value.toLowerCase()));
  const matches = requested.filter((value) => normalized.has(value.toLowerCase())).length;
  return matches / requested.length;
}

function capacityScore(vendor: Vendor, guestCount: number): number {
  if (guestCount < vendor.capacityMin || guestCount > vendor.capacityMax) return 0;
  const range = Math.max(1, vendor.capacityMax - vendor.capacityMin);
  const midpoint = vendor.capacityMin + range / 2;
  return Math.max(0, 1 - Math.abs(guestCount - midpoint) / range);
}

export function rankVendors(vendors: Vendor[], context: VendorSearchContext): RankedVendor[] {
  return vendors
    .map((vendor) => {
      const fit = (overlapScore(context.diet, vendor.diets) + overlapScore(context.cuisine ? [context.cuisine] : [], vendor.cuisines)) / 2;
      const budgetFit = Math.max(0, 1 - Math.abs(vendor.pricePerHead - context.budgetPerHead) / Math.max(context.budgetPerHead, 1));
      const rating = Math.max(0, Math.min(1, vendor.rating / 5));
      const capacityFit = capacityScore(vendor, context.guestCount);
      const availability = vendor.available ? 1 : 0;
      const score = 0.35 * fit + 0.25 * budgetFit + 0.2 * rating + 0.1 * capacityFit + 0.1 * availability;
      const reasons: string[] = [];

      if (fit >= 0.75) reasons.push('Matches your cuisine and dietary needs');
      if (budgetFit >= 0.8) reasons.push('Fits the target budget');
      if (capacityFit === 0) reasons.push('Does not fit the guest count');
      if (!vendor.available) reasons.push('Needs availability confirmation');

      return { ...vendor, score: Math.round(score * 1000) / 1000, reasons };
    })
    .sort((left, right) => right.score - left.score);
}
