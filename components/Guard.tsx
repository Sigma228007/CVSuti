'use client';

import React, { useEffect, useState } from 'react';

export default function Guard({ children }: { children: React.ReactNode }) {
  const [ok, setOk] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      const tg = (window as any)?.Telegram?.WebApp;
      setOk(Boolean(tg?.initData));
    } catch {
      setOk(false);
    }
  }, []);

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