let cachedInit: string | null = null;

export function getInitData(): string {
  if (cachedInit) return cachedInit;
  
  try {
    // 1. Пробуем из Telegram WebApp
    const w = window as any;
    const tg = w?.Telegram?.WebApp;
    
    if (tg?.initData && typeof tg.initData === 'string' && tg.initData.length > 0) {
      const initData = tg.initData;
      cachedInit = initData;
      return initData;
    }

    // 2. Пробуем из query параметров
    const urlParams = new URLSearchParams(window.location.search);
    const fromQuery = urlParams.get('tgWebAppData') || 
                     urlParams.get('initData') ||
                     urlParams.get('initdata') ||
                     '';
    
    if (fromQuery && fromQuery.length > 0) {
      cachedInit = fromQuery;
      return fromQuery;
    }

    // 3. Пробуем из hash
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    const fromHash = hashParams.get('tgWebAppData') || 
                    hashParams.get('initData') ||
                    '';
    
    if (fromHash && fromHash.length > 0) {
      cachedInit = fromHash;
      return fromHash;
    }

    // 4. Пробуем из localStorage (как fallback)
    try {
      const stored = localStorage.getItem('tg_init_data');
      if (stored) {
        cachedInit = stored;
        return stored;
      }
    } catch {}

    return '';
  } catch {
    return '';
  }
}

export function isInTelegramWebApp(): boolean {
  try {
    const w = window as any;
    
    // Проверяем объект Telegram WebApp
    if (w?.Telegram?.WebApp) {
      return true;
    }

    // Проверяем user agent
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('telegram')) {
      return true;
    }

    // Проверяем referrer или origin
    if (document.referrer.includes('t.me') || 
        document.referrer.includes('telegram.org')) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

// Сохраняем initData для последующего использования
export function saveInitData(initData: string): void {
  try {
    cachedInit = initData;
    localStorage.setItem('tg_init_data', initData);
  } catch {}
}