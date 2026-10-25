import { createHmac, timingSafeEqual } from 'node:crypto';

const inviteSecret = () => process.env.INVITE_SECRET ?? process.env.JWT_SECRET ?? 'local-invite-secret-change-me';

function encode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function sign(payload: string): string {
  return createHmac('sha256', inviteSecret()).update(payload).digest('base64url');
}

export function createEntryToken(guestId: string, partyId: string, expiresAt = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365): string {
  const payload = `${encode(guestId)}.${encode(partyId)}.${expiresAt}`;
  return `${payload}.${sign(payload)}`;
}

export interface VerifiedEntryToken {
  guestId: string;
  partyId: string;
  expiresAt: number;
}

export function verifyEntryToken(token: string): VerifiedEntryToken | undefined {
  const parts = token.split('.');
  if (parts.length !== 4) return undefined;
  const [guestPart, partyPart, expiryPart, signature] = parts;
  if (!guestPart || !partyPart || !expiryPart || !signature) return undefined;
  const payload = `${guestPart}.${partyPart}.${expiryPart}`;
  const expected = sign(payload);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) return undefined;
  const expiresAt = Number(expiryPart);
  if (!Number.isSafeInteger(expiresAt) || expiresAt < Math.floor(Date.now() / 1000)) return undefined;
  try {
    return { guestId: Buffer.from(guestPart, 'base64url').toString('utf8'), partyId: Buffer.from(partyPart, 'base64url').toString('utf8'), expiresAt };
  } catch {
    return undefined;
  }
}
