declare global {
  interface Window {
    Telegram?: any;
  }
}

/** Безопасно достать initData из Telegram WebApp */
export function getInitData(): string {
  try {
    return window?.Telegram?.WebApp?.initData || "";
  } catch {
    return "";
  }
}