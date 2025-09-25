export const MAX_CHANCE = 95;
export const MIN_CHANCE = 1;
export const MIN_BET = 10;
export const MAX_BET = 100000;
/** База для формирования абсолютных ссылок в уведомлениях админам */
export function getBaseUrl() {
  // при прод-сборке – из переменной окружения
  const env = process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL;
  if (env) {
    // на Vercel VERCEL_URL без схемы
    if (/^https?:\/\//i.test(env)) return env.replace(/\/+$/, "");
    return `https://${env}`.replace(/\/+$/, "");
  }

  // fallback для локалки
  return "http://localhost:3000";
}