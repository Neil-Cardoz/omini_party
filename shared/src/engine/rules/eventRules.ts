import type { EventRecommendations, PlanningContext } from '../types.js';
import { recommendAttire } from './attireRules.js';
import { recommendBar } from './barRules.js';
import { recommendGifts } from './giftRules.js';

export function buildEventRecommendations(context: PlanningContext): EventRecommendations {
  const tasks: string[] = [];
  const warnings: string[] = [];

  if (context.eventType === 'wedding') {
    tasks.push('Confirm bridal party attire', 'Set up a gift registry');
  }

  if (context.eventType === 'community') {
    tasks.push('Apply for permits', 'Assign volunteers', 'Prepare first aid and accessibility plan', 'Plan waste management');
  }

  if (context.eventType === 'birthday' && context.ageMix.kids > context.ageMix.adults) {
    tasks.push('Check kid-safe venue details', 'Book an entertainer or activity host', 'Choose return gifts');
  }

  if (context.indoorOutdoor !== 'indoor') {
    const month = Number(context.date.slice(5, 7));
    if ([6, 7, 8, 12, 1, 2].includes(month)) {
      warnings.push('Outdoor plans may need a backup tent, heaters, or weather cover.');
      tasks.push('Confirm weather backup plan');
    }
  }

  const daysAway = Math.ceil(
    (Date.parse(`${context.date}T00:00:00Z`) - Date.parse(`${context.referenceDate}T00:00:00Z`)) /
      86_400_000,
  );
  const fastTrack = daysAway >= 0 && daysAway < 30;
  if (fastTrack) {
    warnings.push('Fast-track mode: prioritize venue, caterer and invitation decisions.');
  }

  return {
    tasks,
    warnings,
    bar: recommendBar(context),
    gifts: recommendGifts(context),
    attire: recommendAttire(context),
    timelineDays: context.eventType === 'wedding' ? 180 : fastTrack ? Math.max(7, daysAway) : 90,
  };
}
