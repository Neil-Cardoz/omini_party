import type { GiftRecommendation, PlanningContext } from '../types.js';

export function recommendGifts(context: PlanningContext): GiftRecommendation {
  switch (context.eventType) {
    case 'wedding':
      return {
        guidance: 'wedding-registry',
        options: ['Registry', 'Honeymoon fund', 'No gifts please'],
        reason: 'Weddings commonly benefit from a registry or fund guests can use as guidance.',
      };
    case 'birthday':
      return {
        guidance: 'birthday-gifts-and-favors',
        options: ['Age-appropriate gifts', 'Return gifts / favors', 'No gifts please'],
        reason: 'Birthday plans can include gift guidance and a simple favor plan for guests.',
      };
    case 'community':
      return {
        guidance: 'community-raffle',
        options: ['Raffle prizes', 'Volunteer thank-yous', 'No gifts please'],
        reason: 'Community events are better served by inclusive prizes or volunteer recognition.',
      };
    default:
      return {
        guidance: 'general-gifts',
        options: ['Gift guidance', 'Optional favors', 'No gifts please'],
        reason: 'A flexible gift note works best for this event type.',
      };
  }
}
