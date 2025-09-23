let cachedInit: string | null = null;

export function getInitData(): string {
  if (cachedInit) return cachedInit;
  
  try {
    // 1. Пробуем из Telegram WebApp
    const tg = (window as any)?.Telegram?.WebApp;
    if (tg?.initData) {
      cachedInit = tg.initData;
      return tg.initData;
    }

    // 2. Пробуем из query параметров
    const urlParams = new URLSearchParams(window.location.search);
    const fromQuery = urlParams.get('tgWebAppData') || urlParams.get('initData') || '';
    
    if (fromQuery) {
      cachedInit = fromQuery;
      return fromQuery;
    }

    return '';
  } catch {
    return '';
  }
}

export function isInTelegramWebApp(): boolean {
  try {
    return !!(window as any)?.Telegram?.WebApp;
  } catch {
    return false;
  }
}

export function saveInitData(initData: string): void {
  try {
    cachedInit = initData;
    localStorage.setItem('tg_init_data', initData);
  } catch {}
}