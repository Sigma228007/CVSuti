let cachedInit: string | null = null;

export function getInitData(): string | null {
  if (cachedInit) return cachedInit;
  try {
    const w = window as any;
    const tg = w?.Telegram?.WebApp;

    // 1) родной initData
    if (tg && typeof tg.initData === 'string' && tg.initData.length > 10) {
      cachedInit = tg.initData;
      return cachedInit;
    }

    // 2) query-параметры
    const sp = new URLSearchParams(window.location.search);
    const fromQuery =
      sp.get('tgWebAppData') ||
      sp.get('initData') ||
      sp.get('initdata') ||
      sp.get('init_data');
    if (fromQuery && fromQuery.length > 10) {
      cachedInit = fromQuery;
      return cachedInit;
    }

    // 3) hash-параметры
    const hp = new URLSearchParams((window.location.hash || '').replace(/^#/, ''));
    const fromHash = hp.get('tgWebAppData') || hp.get('initData');
    if (fromHash && fromHash.length > 10) {
      cachedInit = fromHash;
      return cachedInit;
    }
  } catch {}
  return null;
}

/** Мягкая проверка: мы внутри Telegram WebView */
export function isInTelegramWebApp(): boolean {
  try {
    const w = window as any;
    if (w?.Telegram?.WebApp) return true;

    // userAgent некоторых клиентов Telegram содержит "Telegram"
    const ua = (navigator?.userAgent || '').toLowerCase();
    if (ua.includes('telegram')) return true;

    // некоторые клиенты прокидывают ancestorOrigins
    const ao = (window.location as any).ancestorOrigins;
    if (ao && Array.from(ao as any[]).some((o: string) =>
      typeof o === 'string' && (o.includes('web.telegram.org') || o.includes('t.me'))
    )) return true;
  } catch {}
  return false;
}