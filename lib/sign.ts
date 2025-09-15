import crypto from 'crypto';

// общий секрет для подписей (можно fallback на SERVER_SEED)
const KEY = process.env.ADMIN_SIGN_KEY || process.env.SERVER_SEED || 'fallback_key';

export function sign(payload: string) {
  return crypto.createHmac('sha256', KEY).update(payload).digest('hex').slice(0, 16);
}

export function verify(payload: string, k: string) {
  return sign(payload) === (k || '');
}