import type { EventType } from '../index.js';
import type { TimelineInput, TimelineTask } from './types.js';

interface TemplateTask {
  title: string;
  category: string;
  dueOffsetDays: number;
}

const COMMON_TASKS: TemplateTask[] = [
  { title: 'Confirm guest list', category: 'Guests & Invitations', dueOffsetDays: 45 },
  { title: 'Finalize menu', category: 'Food & Beverage', dueOffsetDays: 30 },
  { title: 'Send invitations', category: 'Guests & Invitations', dueOffsetDays: 30 },
  { title: 'Confirm final headcount', category: 'Guests & Invitations', dueOffsetDays: 7 },
  { title: 'Prepare day-of run-sheet', category: 'Day-of & Wrap-up', dueOffsetDays: 3 },
];

const EVENT_TASKS: Partial<Record<EventType, TemplateTask[]>> = {
  wedding: [
    { title: 'Book venue', category: 'Venue & Logistics', dueOffsetDays: 180 },
    { title: 'Book caterer', category: 'Food & Beverage', dueOffsetDays: 120 },
    { title: 'Send invitations', category: 'Guests & Invitations', dueOffsetDays: 60 },
  ],
  community: [
    { title: 'Apply for permits', category: 'Safety & Compliance', dueOffsetDays: 60 },
    { title: 'Recruit volunteers', category: 'Safety & Compliance', dueOffsetDays: 30 },
  ],
};

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function buildTimeline(input: TimelineInput): TimelineTask[] {
  const eventDate = new Date(`${input.eventDate}T00:00:00Z`);
  const referenceDate = new Date(`${input.referenceDate}T00:00:00Z`);
  const daysAvailable = Math.max(0, Math.floor((eventDate.getTime() - referenceDate.getTime()) / 86_400_000));
  const templates = [...(EVENT_TASKS[input.eventType] ?? []), ...COMMON_TASKS];
  const maxOffset = Math.max(...templates.map((task) => task.dueOffsetDays));
  const compression = maxOffset > 0 && daysAvailable < maxOffset ? daysAvailable / maxOffset : 1;

  return templates.map((task) => {
    const effectiveOffset = Math.round(task.dueOffsetDays * compression);
    const dueDate = new Date(eventDate);
    dueDate.setUTCDate(dueDate.getUTCDate() - effectiveOffset);
    const originalDueDate = new Date(eventDate);
    originalDueDate.setUTCDate(originalDueDate.getUTCDate() - task.dueOffsetDays);
    const overdue = originalDueDate < referenceDate;

    return {
      ...task,
      dueDate: isoDate(dueDate),
      priority: overdue || daysAvailable < 30 ? 'high' : 'normal',
      status: overdue ? 'overdue' : 'todo',
    };
  });
}
