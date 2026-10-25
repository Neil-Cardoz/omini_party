import { describe, expect, it } from 'vitest';
import {
  buildEventRecommendations,
  buildTimeline,
  estimateCost,
  getChangedSteps,
  getStaleSteps,
  getStaleStepsForChanges,
  rankVendors,
  recommendAttire,
  recommendBar,
  recommendGifts,
  type PlanningContext,
  type Vendor,
} from './index.js';

const baseContext: PlanningContext = {
  eventType: 'birthday',
  guestCount: 50,
  ageMix: { kids: 10, teens: 5, adults: 30, seniors: 5 },
  budgetTier: 'essential',
  cityIndex: 1,
  date: '2026-05-18',
  referenceDate: '2026-01-01',
  durationHours: 3,
  diet: ['Vegetarian'],
  alcoholPref: 'depends',
  indoorOutdoor: 'indoor',
  formality: 'casual',
};

describe('event decision rules', () => {
  it('recommends a mocktail bar for a kid-heavy birthday', () => {
    const result = recommendBar({
      ...baseContext,
      ageMix: { kids: 35, teens: 5, adults: 10, seniors: 0 },
    });

    expect(result.defaultOption).toBe('mocktail-bar');
    expect(result.offeredOptions).toEqual(['mocktail-bar', 'none']);
  });

  it('keeps community events dry and adds inclusive gift guidance', () => {
    const context = { ...baseContext, eventType: 'community' as const, alcoholPref: 'yes' as const };
    const recommendations = buildEventRecommendations(context);

    expect(recommendations.bar.defaultOption).toBe('mocktail-bar');
    expect(recommendations.tasks).toEqual(
      expect.arrayContaining(['Apply for permits', 'Assign volunteers', 'Plan waste management']),
    );
    expect(recommendations.gifts.guidance).toBe('community-raffle');
  });

  it('adds a wedding registry and wedding attire', () => {
    const context = { ...baseContext, eventType: 'wedding' as const, culture: 'Hindu' };

    expect(recommendGifts(context).guidance).toBe('wedding-registry');
    expect(recommendAttire(context).value).toContain('traditional');
    expect(buildEventRecommendations(context).timelineDays).toBe(180);
  });

  it('warns about fast-track outdoor plans using the supplied reference date', () => {
    const result = buildEventRecommendations({
      ...baseContext,
      date: '2026-01-20',
      referenceDate: '2026-01-01',
      indoorOutdoor: 'outdoor',
    });

    expect(result.warnings).toEqual(
      expect.arrayContaining([
        'Fast-track mode: prioritize venue, caterer and invitation decisions.',
        'Outdoor plans may need a backup tent, heaters, or weather cover.',
      ]),
    );
  });
});

describe('cost estimator', () => {
  it('calculates deterministic category lines, contingency and tax', () => {
    const estimate = estimateCost({
      context: baseContext,
      menuPricePerHead: 20,
      venueFlatFee: 1_000,
      venuePricePerHead: 5,
      barOption: 'beer-wine',
      barPricePerDrink: 2,
      decorComplexity: 1,
      mediaCost: 500,
      attireAllowance: 100,
      digitalInvites: true,
      contingencyRate: 0.1,
      taxRate: 0.1,
    });

    expect(estimate.subtotal).toBe(3_570);
    expect(estimate.contingency).toBe(357);
    expect(estimate.tax).toBe(392.7);
    expect(estimate.total).toBe(4_319.7);
    expect(estimate.lines).toHaveLength(9);
  });
});

describe('timeline builder', () => {
  it('creates wedding tasks at their event-relative offsets', () => {
    const timeline = buildTimeline({
      eventType: 'wedding',
      eventDate: '2026-06-30',
      referenceDate: '2026-01-01',
      guestCount: 120,
    });
    const venue = timeline.find((task) => task.title === 'Book venue');

    expect(venue).toMatchObject({ dueOffsetDays: 180, dueDate: '2026-01-01', status: 'todo' });
  });

  it('compresses an urgent plan and marks already-passed tasks overdue', () => {
    const timeline = buildTimeline({
      eventType: 'community',
      eventDate: '2026-01-20',
      referenceDate: '2026-01-01',
      guestCount: 100,
    });

    expect(timeline.some((task) => task.priority === 'high')).toBe(true);
    expect(timeline.some((task) => task.status === 'overdue')).toBe(true);
  });
});

describe('vendor ranking', () => {
  const vendors: Vendor[] = [
    {
      id: 'best',
      name: 'Green Table',
      capacityMin: 20,
      capacityMax: 120,
      pricePerHead: 42,
      cuisines: ['Indian'],
      diets: ['Vegetarian', 'Vegan'],
      rating: 4.8,
      available: true,
    },
    {
      id: 'poor-fit',
      name: 'Tiny Grill',
      capacityMin: 10,
      capacityMax: 30,
      pricePerHead: 80,
      cuisines: ['American'],
      diets: ['Non-veg'],
      rating: 4,
      available: false,
    },
  ];

  it('ranks a diet-, cuisine- and budget-fit vendor first', () => {
    const ranked = rankVendors(vendors, {
      guestCount: 50,
      budgetPerHead: 45,
      diet: ['Vegetarian'],
      cuisine: 'Indian',
    });

    expect(ranked[0]?.id).toBe('best');
    expect(ranked[0]?.reasons).toEqual(expect.arrayContaining(['Matches your cuisine and dietary needs']));
  });
});

describe('wizard dependency graph', () => {
  it('marks the documented downstream steps stale', () => {
    expect(getStaleSteps('guests')).toEqual(['budget', 'location', 'menu', 'bar', 'caterer', 'invites']);
    expect(getStaleStepsForChanges(['theme', 'budget'])).toEqual(
      expect.arrayContaining(['location', 'menu', 'caterer', 'attire', 'invites']),
    );
  });

  it('detects changed steps before calculating downstream stale steps', () => {
    const changed = getChangedSteps(
      { basics: { date: '2026-05-18' }, guests: { count: 50 } },
      { basics: { date: '2026-05-18' }, guests: { count: 80 } },
    );

    expect(changed).toEqual(['guests']);
  });
});
