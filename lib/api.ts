import { getInitData } from "./webapp";

/** Универсальный POST с автоматической прокладкой initData */
export async function apiPost<T = any>(
  url: string,
  payload: Record<string, any> = {}
): Promise<T> {
  const initData = getInitData();
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ initData, ...payload }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${text || res.statusText}`);
  }
  return res.json();
}

/** GET баланса с initData в заголовке (чтобы не ловить 401) */
export async function fetchBalance(): Promise<number> {
  const initData = getInitData();
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