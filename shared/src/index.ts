export const APP_NAME = 'celebrAItions';

export type EventType =
  | 'wedding'
  | 'birthday'
  | 'community'
  | 'graduation'
  | 'corporate'
  | 'baby-shower'
  | 'other';

export const eventTypeLabels: Record<EventType, string> = {
  wedding: 'Wedding',
  birthday: 'Birthday',
  community: 'Community event',
  graduation: 'Graduation',
  corporate: 'Corporate',
  'baby-shower': 'Baby shower',
  other: 'Other',
};

export * from './engine/index.js';
