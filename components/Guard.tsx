'use client';

import React, { useEffect, useState } from 'react';
import { isInTelegramWebApp } from '@/lib/webapp';

export default function Guard({ children }: { children: React.ReactNode }) {
  const [ok, setOk] = useState<boolean | null>(null);

  useEffect(() => {
    setOk(isInTelegramWebApp());
    try {
      const tg = (window as any)?.Telegram?.WebApp;
      tg?.ready?.();
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