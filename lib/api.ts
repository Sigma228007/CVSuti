import { getInitData } from "./webapp";

/** POST с X-Init-Data */
export async function apiPost<T=any>(url: string, payload: Record<string, any> = {}): Promise<T> {
  const initData = getInitData();
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Init-Data": initData },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(()=> "");
    throw new Error(`${res.status} ${text || res.statusText}`);
  }
  return res.json();
}

/** Баланс (X-Init-Data в заголовке) */
export async function fetchBalance(): Promise<number> {
  const initData = getInitData();
  const res = await fetch(`/api/balance?ts=${Date.now()}`, {
    method: "GET",
    headers: { "X-Init-Data": initData },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(()=> "");
    throw new Error(`${res.status} ${text || res.statusText}`);
  }
  const data = await res.json();
  return Number(data?.balance || 0);
}