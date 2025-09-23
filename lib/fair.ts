import crypto from 'crypto';

export function hmacHex(serverSeed: string, message: string) {
  return crypto.createHmac('sha256', serverSeed).update(message).digest('hex');
}

// 0..999999 из hex
export function sixDigit0To999999(hex: string): number {
  const v = parseInt(hex.slice(0, 8), 16);
  return v % 1_000_000;
}

export function roll(serverSeed: string, clientSeed: string, nonce: number) {
  const msg = `${clientSeed}:${nonce}`;
  const hex = hmacHex(serverSeed, msg);
  const value = sixDigit0To999999(hex);
  return { value, hex };
}

export function publicCommit(serverSeed: string) {
  return crypto.createHash('sha256').update(serverSeed).digest('hex');
}