'use client';

import React, { useEffect, useMemo, useState } from 'react';

/**
 * Guard — впускаем только из Telegram WebApp.
 * Разрешаем обход проверки для путей /pay/* и /fk/* (ожидание/страницы результата).
 */

function isFromTelegram(): boolean {
  try {
    const w = window as any;

    // 1) Нативный объект WebApp присутствует
    if (w?.Telegram?.WebApp) return true;

    // 2) Параметры строки/хэша, которые Telegram добавляет
    const sp = new URLSearchParams(window.location.search);
    if (
      sp.get('tgWebAppData') ||
      sp.get('initData') ||
      sp.get('initdata') ||
      sp.get('init_data')
    ) {
      return true;
    }
    const hash = window.location.hash || '';
    if (hash.includes('tgWebAppData=')) return true;

    // 3) Запуск внутри iframe от web.telegram.org / t.me
    const ao = (window.location as any).ancestorOrigins;
    if (ao && Array.from(ao as unknown as string[]).some((o) => o.includes('web.telegram.org') || o.includes('t.me'))) {
      return true;
    }
  } catch {}
  return false;
}

export default function Guard({ children }: { children: React.ReactNode }) {
  const [ok, setOk] = useState<boolean | null>(null);

  // Белый список путей, которые должны работать и в обычном браузере
  const allowedPath = useMemo(() => {
    try {
      const p = window.location.pathname || '/';
      if (p.startsWith('/pay/')) return true;
      if (p.startsWith('/fk/')) return true;
    } catch {}
    return false;
  }, []);

  useEffect(() => {
    if (allowedPath) {
      setOk(true);
      return;
    }
    setOk(isFromTelegram());
  }, [allowedPath]);

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
        <div className="card fade-in" style={{ textAlign: 'center' }}>
          <div className="h2">Доступ только из Telegram</div>
          <div className="sub">Откройте мини-приложение через нашего бота.</div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}