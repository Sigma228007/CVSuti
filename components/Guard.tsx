'use client';

import React, { useEffect, useMemo, useState } from 'react';

/** Мягкий детект “мы в Telegram” */
function isInTelegramWebApp(): boolean {
  // 1) Нативный объект Telegram WebApp
  try {
    const init = (window as any)?.Telegram?.WebApp?.initData;
    if (init && typeof init === 'string' && init.length > 0) return true;
  } catch {}

  // 2) Web Telegram в iframe (ancestorOrigins)
  try {
    const ao = (window.location as any).ancestorOrigins as unknown;
    const list: string[] = Array.from((ao as any) || []);
    if (list.some((o) => /(?:^|\.)web\.telegram\.org$/i.test(o))) return true;
    if (list.some((o) => /(?:^|\.)t\.me$/i.test(o))) return true;
    if (list.some((o) => /telegram\.org/i.test(o))) return true;
  } catch {}

  // 3) Подпись, прилетевшая в строке запроса
  try {
    const sp = new URLSearchParams(window.location.search);
    if (sp.get('tgWebAppData') || sp.get('initData') || sp.get('init_data')) return true;
  } catch {}

  return false;
}

export default function Guard({ children }: { children: React.ReactNode }) {
  const [ok, setOk] = useState<boolean | null>(null);

  // один раз решаем: пускать / не пускать
  const decision = useMemo(() => isInTelegramWebApp(), []);
  useEffect(() => {
    // попробуем подождать инициализацию Telegram WebApp (иногда initData появляется с задержкой)
    if (decision) {
      setOk(true);
      return;
    }
    const t = setTimeout(() => setOk(isInTelegramWebApp()), 250);
    return () => clearTimeout(t);
  }, [decision]);

  if (ok === null) {
    return (
      <div className="center">
        <div className="card">Загрузка…</div>
      </div>
    );
  }

  if (!ok) {
    return (
      <div className="center">
        <div className="card" style={{ textAlign: 'center', maxWidth: 420 }}>
          <div className="h2">Доступ только из Telegram</div>
          <div className="sub" style={{ marginTop: 6 }}>
            Откройте мини-приложение через нашего бота.
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}