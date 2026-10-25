export type WizardStep =
  | 'basics'
  | 'guests'
  | 'budget'
  | 'theme'
  | 'location'
  | 'menu'
  | 'bar'
  | 'caterer'
  | 'attire'
  | 'gifts'
  | 'invites';

const STEP_ORDER: WizardStep[] = [
  'basics',
  'guests',
  'budget',
  'theme',
  'location',
  'menu',
  'bar',
  'caterer',
  'attire',
  'gifts',
  'invites',
];

const DEPENDENCIES: Record<WizardStep, WizardStep[]> = {
  basics: STEP_ORDER.slice(1),
  guests: ['budget', 'location', 'menu', 'bar', 'caterer', 'invites'],
  budget: ['location', 'menu', 'caterer'],
  theme: ['attire', 'invites'],
  location: [],
  menu: ['caterer'],
  bar: [],
  caterer: [],
  attire: [],
  gifts: [],
  invites: [],
};

export function getStaleSteps(changedStep: WizardStep): WizardStep[] {
  return [...DEPENDENCIES[changedStep]];
}

export function getChangedSteps<T extends Partial<Record<WizardStep, unknown>>>(
  previous: T,
  next: T,
): WizardStep[] {
  const changed = new Set<WizardStep>();
  for (const step of STEP_ORDER) {
    if (JSON.stringify(previous[step]) !== JSON.stringify(next[step])) changed.add(step);
  }
  return [...changed];
}

export function getStaleStepsForChanges(changedSteps: WizardStep[]): WizardStep[] {
  return [...new Set(changedSteps.flatMap(getStaleSteps))];
}
