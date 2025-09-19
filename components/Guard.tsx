'use client';

import React, { useEffect, useMemo, useState } from 'react';

export default function Guard({ children }: { children: React.ReactNode }) {
  const [ok, setOk] = useState<boolean | null>(null);

  // Пускаем, если есть tg.WebApp.initData ИЛИ initData в URL (tgWebAppData/initData/варианты)
  const hasInitData = useMemo(() => {
    try {
      if (typeof window === 'undefined') return false;

      const tg = (window as any)?.Telegram?.WebApp;
      const fromTG = tg?.initData && String(tg.initData).length > 0;

      const sp = new URLSearchParams(window.location.search);
      const fromQuery =
        sp.get('tgWebAppData') ||
        sp.get('initData') ||
        sp.get('initdata') ||
        sp.get('init_data');

      return Boolean(fromTG || fromQuery);
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    // Для порядка дернём ready(), если доступен
    try {
      const tg = (window as any)?.Telegram?.WebApp;
      if (tg?.ready) tg.ready();
    } catch {}
    setOk(hasInitData);
  }, [hasInitData]);

  if (ok === null) return null;

  if (!ok) {
    return (
      <div className="center">
        <div className="card">
          <div className="h2">Доступ только из Telegram</div>
          <div className="sub">Откройте мини-приложение через нашего бота.</div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}