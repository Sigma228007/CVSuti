export const MIN_BET = 1;
export const MAX_BET = 10_000;
export const MIN_CHANCE = 1;
export const MAX_CHANCE = 95;

export const HOUSE_EDGE_BP = Number(process.env.HOUSE_EDGE_BP ?? 150);

/**
 * Возвращает базовый публичный URL приложения.
 * Приоритет:
 * 1) NEXT_PUBLIC_BASE_URL (задаётся вручную в Vercel → Environment Variables)
 * 2) VERCEL_URL (автоматически в рантайме Vercel)
 * 3) локальный адрес (http://localhost:3000)
 */
export function getBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_BASE_URL?.trim();
  if (explicit && explicit.length > 0) {
    return explicit.replace(/\/$/, "");
  }

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel && vercel.length > 0) {
    return `https://${vercel}`.replace(/\/$/, "");
  }

  return "http://localhost:3000";
}