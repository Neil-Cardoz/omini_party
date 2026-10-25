import { describe, expect, it } from 'vitest';
import { fallbackCreativeResponse } from './aiService.js';

describe('creative ideas fallback', () => {
  it('returns useful offline ideas without an API key', () => {
    const result = fallbackCreativeResponse({ eventType: 'community', partyName: 'Harvest Mela', prompt: 'ideas' });
    expect(result.source).toBe('offline');
    expect(result.ideas).toHaveLength(3);
    expect(result.text).toContain('Harvest Mela');
  });
});
