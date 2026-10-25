import { describe, expect, it } from 'vitest';
import { createEntryToken, verifyEntryToken } from './inviteService.js';

describe('entry invite tokens', () => {
  it('signs and verifies a token without putting guest details in the payload', () => {
    const token = createEntryToken('guest-1', 'party-1', Math.floor(Date.now() / 1000) + 60);
    expect(verifyEntryToken(token)).toMatchObject({ guestId: 'guest-1', partyId: 'party-1' });
    expect(token).not.toContain('Alice');
  });

  it('rejects forged and expired tokens', () => {
    const token = createEntryToken('guest-1', 'party-1', Math.floor(Date.now() / 1000) - 1);
    expect(verifyEntryToken(token)).toBeUndefined();
    expect(verifyEntryToken(`${token.slice(0, -1)}x`)).toBeUndefined();
  });
});
