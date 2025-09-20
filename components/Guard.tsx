'use client';

import React, { useEffect, useMemo, useState } from 'react';

/** Жёстко определяем, что мы «внутри Telegram WebApp» */
function detectTelegram(): boolean {
  try {
    // 1) родной объект WebApp
    const tg = (window as any)?.Telegram?.WebApp;
    if (tg && tg.initData) return true;

    // 2) initdata в query/hash – у некоторых клиентов
    const sp = new URLSearchParams(window.location.search);
    if (sp.get('tgWebAppData') || sp.get('initData') || sp.get('initdata') || sp.get('init_data')) {
      return true;
    }
    const hash = new URLSearchParams((window.location.hash || '').replace(/^#/, ''));
    if (hash.get('tgWebAppData') || hash.get('initData')) return true;

    // 3) запускаемся во вьюхе Telegram (iframe). У клиентов есть ancestorOrigins с web.telegram.org / t.me
    const ao = (window.location as any).ancestorOrigins;
    if (ao && Array.from(ao as any[]).some((o: string) =>
      typeof o === 'string' && (o.includes('web.telegram.org') || o.includes('t.me'))
    )) {
      return true;
    }
  } catch {}
  return false;
}

export default function Guard({
  children,
}: {
  children: React.ReactNode;
}) {
  const [ok, setOk] = useState<boolean | null>(null);

  useEffect(() => {
    setOk(detectTelegram());
    try {
      const tg = (window as any)?.Telegram?.WebApp;
      if (tg?.ready) tg.ready();
    } catch {}
  }, []);

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
        <div className="card" style={{ textAlign: 'center' }}>
          <div className="h2" style={{ marginBottom: 6 }}>Доступ только из Telegram</div>
          <div className="sub">Откройте мини-приложение через нашего бота.</div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}