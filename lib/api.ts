import { getInitData } from "./webapp";

/** Универсальный POST с автоматической прокладкой initData */
export async function apiPost<T = any>(
  url: string,
  payload: Record<string, any> = {}
): Promise<T> {
  const initData = getInitData();
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(initData ? { "X-Init-Data": initData } : {}) },
    body: JSON.stringify({ initData, ...payload }),
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${text || res.statusText}`);
  }
  return res.json();
}

/** GET баланса с initData в заголовке — безопасный: вне Telegram просто возврат 0 и без 401 */
export async function fetchBalance(): Promise<number> {
  const initData = getInitData();
  if (!initData) return 0; // вне Telegram: не трогаем API
  const res = await fetch(`/api/balance?ts=${Date.now()}`, {
    method: "GET",
    headers: { "X-Init-Data": initData },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${text || res.statusText}`);
  }
  const data = await res.json();
  return Number(data?.balance || 0);
}