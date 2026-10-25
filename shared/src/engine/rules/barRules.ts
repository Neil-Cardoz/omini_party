import type { PlanningContext, BarRecommendation } from '../types.js';

export function recommendBar(context: PlanningContext): BarRecommendation {
  const kidsShare = context.guestCount === 0 ? 0 : context.ageMix.kids / context.guestCount;
  const childHeavy = kidsShare > 0.3;
  const dryEvent = context.alcoholPref === 'no' || context.eventType === 'community';

  if (dryEvent || childHeavy) {
    const reason = dryEvent
      ? 'Alcohol is disabled for this event preference or community format.'
      : 'More than 30% of guests are children, so a kid-safe drinks plan is recommended.';

    return {
      defaultOption: 'mocktail-bar',
      offeredOptions: ['mocktail-bar', 'none'],
      guestCountForDrinks: context.guestCount,
      reason,
    };
  }

  if (context.alcoholPref === 'depends') {
    return {
      defaultOption: 'beer-wine',
      offeredOptions: ['beer-wine', 'signature-cocktails', 'mocktail-bar', 'none'],
      guestCountForDrinks: Math.max(0, context.guestCount - context.ageMix.kids),
      reason: 'A moderate drinks option keeps the plan flexible when alcohol depends on the event.',
    };
  }

  return {
    defaultOption: 'beer-wine',
    offeredOptions: ['full-bar', 'beer-wine', 'signature-cocktails', 'mocktail-bar', 'none'],
    guestCountForDrinks: Math.max(0, context.guestCount - context.ageMix.kids),
    reason: 'Beer and wine is the balanced default for an adult-friendly celebration.',
  };
}
