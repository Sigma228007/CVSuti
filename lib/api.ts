import { getInitData } from "./webapp";

/** Безопасный POST с X-Init-Data */
export async function apiPost<T = any>(url: string, payload: Record<string, any> = {}): Promise<T> {
  const initData = getInitData();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (initData) headers["X-Init-Data"] = initData;

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ initData, ...payload }),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${text || res.statusText}`);
  }
  return res.json();
}

/** Баланс — только в ТГ, иначе возвращаем 0 и не ломаемся */
export async function fetchBalance(): Promise<number> {
  const initData = getInitData();
  if (!initData) return 0;

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