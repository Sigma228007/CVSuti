declare global {
  interface Window {
    Telegram?: any;
  }
}

/** Надёжно достаём initData из Telegram WebApp/Telegram Web. */
export function getInitData(): string {
  // 1) Классика: Telegram.WebApp.initData
  try {
    const tg = (window as any)?.Telegram?.WebApp;
    if (tg?.initData && String(tg.initData).length > 0) return String(tg.initData);
  } catch {}

  // 2) Параметры запроса ?tgWebAppData / ?initData …
  try {
    const sp = new URLSearchParams(window.location.search);
    const q =
      sp.get('tgWebAppData') ||
      sp.get('initData') ||
      sp.get('initdata') ||
      sp.get('init_data');
    if (q) return q;
  } catch {}

  // 3) Хэш #tgWebAppData / #initData …
  try {
    const raw = (window.location.hash || '').replace(/^#/, '');
    if (raw) {
      const hp = new URLSearchParams(raw);
      const h =
        hp.get('tgWebAppData') ||
        hp.get('initData') ||
        hp.get('initdata') ||
        hp.get('init_data');
      if (h) return h;
    }
  } catch {}

  return '';
}