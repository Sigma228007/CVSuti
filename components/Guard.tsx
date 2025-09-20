'use client';

import React, { useEffect, useMemo, useState } from 'react';

function getInitDataFromAnywhere(): string | null {
  // 1) querystring ?initData=...
  try {
    const sp = new URLSearchParams(window.location.search);
    if (sp.get('tgWebAppData')) return sp.get('tgWebAppData')!;
    if (sp.get('initdata')) return sp.get('initdata')!;
    if (sp.get('init_data')) return sp.get('init_data')!;
    if (sp.get('initData')) return sp.get('initData')!;
  } catch {}

  // 2) hash #initData=...
  try {
    const raw = (window.location.hash || '').replace(/^#/, '');
    const hp = new URLSearchParams(raw);
    if (hp.get('tgWebAppData')) return hp.get('tgWebAppData')!;
    if (hp.get('initdata')) return hp.get('initdata')!;
    if (hp.get('init_data')) return hp.get('init_data')!;
    if (hp.get('initData')) return hp.get('initData')!;
  } catch {}

  // 3) эвристика: если в iframe телеграма — позволяем без initData
  try {
    const ao = (window.location as any)?.ancestorOrigins as unknown as string[] | undefined;
    const list = ao ? (Array.from(ao) as string[]) : [];
    if (list.some((o) => o.includes('web.telegram.org') || o.includes('t.me'))) {
      // пускаем даже без initData — клиент пришлёт его в запросах к API
      return '__from_iframe__';
    }
  } catch {}

  return null;
}

export default function Guard({ children }: { children: React.ReactNode }) {
  const [ok, setOk] = useState<boolean | null>(null);

  const initData = useMemo(getInitDataFromAnywhere, []);

  useEffect(() => {
    try {
      const tg = (window as any)?.Telegram?.WebApp;
      if (tg?.ready) tg.ready();
    } catch {}
    setOk(Boolean(initData));
  }, [initData]);

  if (ok === null) return null;

  if (!ok) {
    return (
      <div className="center">
        <div className="card fade-in" style={{ textAlign: 'center', maxWidth: 420 }}>
          <div className="h2">Доступ только из Telegram</div>
          <div className="sub">Откройте мини-приложение через нашего бота.</div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}