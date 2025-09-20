'use client';

import React, { useEffect, useMemo, useState } from 'react';

/**
 * Guard — пускаем только из Telegram WebApp.
 * НО: страницы оплаты/результатов (/pay/* и /fk/*) не блокируем,
 * чтобы они работали в браузере и внутри мини-приложения.
 */

function isTelegramWebApp(): boolean {
  try {
    return Boolean((window as any)?.Telegram?.WebApp?.initDataUnsafe);
  } catch {
    return false;
  }
}

export default function Guard({ children }: { children: React.ReactNode }) {
  const [ok, setOk] = useState<boolean | null>(null);

  const allowedPath = useMemo(() => {
    try {
      const p = window.location.pathname || '/';
      // Белый список: ожидание оплаты и странички успеха/ошибки
      if (p.startsWith('/pay/')) return true;
      if (p.startsWith('/fk/')) return true;
    } catch {}
    return false;
  }, []);

  useEffect(() => {
    // если мы на белом пути — пропускаем без проверок
    if (allowedPath) {
      setOk(true);
      return;
    }
    // иначе требуем Telegram WebApp
    setOk(isTelegramWebApp());
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