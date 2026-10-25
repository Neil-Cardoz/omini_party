import type { PlanningContext, RuleDecision } from '../types.js';

export function recommendAttire(context: PlanningContext): RuleDecision<string> {
  if (context.eventType === 'wedding') {
    return {
      value: context.culture === 'Hindu' || context.culture === 'Sikh' ? 'Festive traditional or Indo-western' : 'Formal celebration attire',
      reason: 'Wedding attire should coordinate the host, honoree and guests with the formality of the celebration.',
    };
  }

  if (context.eventType === 'birthday' && context.ageMix.kids > context.ageMix.adults) {
    return {
      value: 'Comfortable clothes; costumes welcome',
      reason: 'A kid-heavy birthday benefits from movement-friendly clothing and optional costumes.',
    };
  }

  if (context.formality === 'formal') {
    return {
      value: 'Formal attire',
      reason: 'The selected formality calls for a polished dress code.',
    };
  }

  return {
    value: context.formality === 'smart-casual' ? 'Smart casual' : 'Casual and comfortable',
    reason: 'The dress code follows the selected formality without adding unnecessary complexity.',
  };
}
