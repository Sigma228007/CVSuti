declare global { interface Window { Telegram?: any } }

/** Достаём initData из всех мест */
export function getInitData(): string {
  // 1) нативно из WebApp
  try { const tg = (window as any)?.Telegram?.WebApp; if (tg?.initData) return String(tg.initData); } catch {}
  // 2) query (?tgWebAppData / ?initData / …)
  try {
    const sp = new URLSearchParams(window.location.search);
    const q = sp.get('tgWebAppData') || sp.get('initData') || sp.get('initdata') || sp.get('init_data');
    if (q) return q;
  } catch {}
  // 3) hash (#tgWebAppData=…)
  try {
    const hp = new URLSearchParams((window.location.hash||'').replace(/^#/, ''));
    const h = hp.get('tgWebAppData') || hp.get('initData') || hp.get('initdata') || hp.get('init_data');
    if (h) return h;
  } catch {}
  return '';
}

/** Находимся ли мы внутри Telegram WebView */
export function isInTelegram(): boolean {
  try {
    if ((window as any)?.Telegram?.WebApp) return true;
    const ao = (window.location as any).ancestorOrigins as unknown;
    if (Array.isArray(ao)) {
      return (ao as string[]).some(o => typeof o === 'string' && (o.includes('web.telegram.org') || o.includes('t.me')));
    }
  } catch {}
  return false;
}