import { describe, expect, it } from 'vitest';
import { APP_NAME, eventTypeLabels } from './index.js';

describe('shared workspace', () => {
  it('exposes the app name and event labels', () => {
    expect(APP_NAME).toBe('celebrAItions');
    expect(eventTypeLabels.wedding).toBe('Wedding');
  });
});
