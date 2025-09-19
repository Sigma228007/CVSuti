'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';

function getInitDataFromAnywhere(): string | null {
  try {
    // 1) Telegram WebApp
    // @ts-ignore
    const tg = (typeof window !== 'undefined') ? window?.Telegram?.WebApp : undefined;
    if (tg?.initData) return tg.initData as string;

    // 2) query (?tgWebAppData=... или ?initData=...)
    const sp = new URLSearchParams(window.location.search);
    const q =
      sp.get('tgWebAppData') ||
      sp.get('initData') ||
      sp.get('initdata') ||
      sp.get('init_data');
    if (q) return q;

    // 3) hash (#tgWebAppData=...)
    const hp = new URLSearchParams((window.location.hash || '').replace(/^#/, ''));
    const h =
      hp.get('tgWebAppData') ||
      hp.get('initData') ||
      hp.get('initdata') ||
      hp.get('init_data');
    if (h) return h;

  } catch {}
  return null;
}

export default function Guard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Разрешённые роуты без Telegram (оплата/результат)
  const allowWithoutTG = useMemo(() => {
    if (!pathname) return false;
    return pathname.startsWith('/pay/') || pathname.startsWith('/fk/');
  }, [pathname]);

  const [ok, setOk] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      // Если специально разрешили — пропускаем
      if (allowWithoutTG) {
        setOk(true);
        return;
      }

      // Проверяем наличие initData / самого WebApp
      const hasInit = !!getInitDataFromAnywhere();

      // Иногда в Web версиях помогает ancestorOrigins
      const ao = (window.location as any).ancestorOrigins as unknown;
      const fromTelegram =
        !!(window as any)?.Telegram?.WebApp ||
        (Array.isArray(ao) &&
          (ao as string[]).some((o) =>
            typeof o === 'string' &&
            (o.includes('web.telegram.org') || o.includes('t.me'))
          ));

      setOk(Boolean(hasInit || fromTelegram));
    } catch {
      setOk(false);
    }
  }, [allowWithoutTG]);

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
          <div className="h2">Доступ только из Telegram</div>
          <div className="sub">
            Откройте мини-приложение через нашего бота.
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}