declare global {
  interface Window {
    Telegram?: any;
  }
}

/** Безопасно достаём initData */
export function getInitData(): string {
  try {
    // 1) нативно из Telegram WebApp
    const tg = (typeof window !== 'undefined') ? window?.Telegram?.WebApp : undefined;
    if (tg?.initData) return String(tg.initData);
  } catch {}

  try {
    // 2) из query (?tgWebAppData=... || ?initData=...)
    const sp = new URLSearchParams(window.location.search);
    const q =
      sp.get('tgWebAppData') ||
      sp.get('initData') ||
      sp.get('initdata') ||
      sp.get('init_data');
    if (q) return q;
  } catch {}

  try {
    // 3) из hash (#tgWebAppData=...)
    const hp = new URLSearchParams((window.location.hash || '').replace(/^#/, ''));
    const h =
      hp.get('tgWebAppData') ||
      hp.get('initData') ||
      hp.get('initdata') ||
      hp.get('init_data');
    if (h) return h;
  } catch {}

  return '';
}

/** Находимся ли мы в Telegram WebView (грубо/надёжно) */
export function isInTelegram(): boolean {
  try {
    if ((window as any)?.Telegram?.WebApp) return true;
    const ao = (window.location as any).ancestorOrigins as unknown;
    if (Array.isArray(ao)) {
      return (ao as string[]).some((o) =>
        typeof o === 'string' &&
        (o.includes('web.telegram.org') || o.includes('t.me'))
      );
    }
  } catch {}
  return false;
}