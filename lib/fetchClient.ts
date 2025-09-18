export function getInitData(): string {
  if (typeof window === 'undefined') return '';
  // @ts-ignore
  const fromTG = window?.Telegram?.WebApp?.initData as string | undefined;
  if (fromTG && fromTG.length > 0) return fromTG;
  const fromQuery = new URLSearchParams(window.location.search).get('tgWebAppData');
  return fromQuery || '';
}

export async function apiJson<T>(url: string, body?: any): Promise<T> {
  const initData = getInitData();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (initData) headers['x-init-data'] = initData;

  const r = await fetch(url, {
    method: body ? 'POST' : 'GET',
    headers,
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  if (!r.ok) {
    const txt = await r.text().catch(() => '');
    throw new Error(`${r.status} ${r.statusText}${txt ? ` — ${txt}` : ''}`);
  }
  return r.json() as Promise<T>;
}