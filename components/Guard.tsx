'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Guard — блокирует доступ вне Telegram WebApp.
 * НО: для служебных публичных страниц (успех/ошибка оплаты) делаем белый список.
 */
export default function Guard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // ---- БЕЛЫЙ СПИСОК: страницы, доступные из обычного браузера ----
  const isWhitelisted = useMemo(() => {
    if (!pathname) return false;
    // Всё, что под /fk/*, открывается без ограничений (success/fail и т.п.)
    if (pathname.startsWith('/fk/')) return true;
    return false;
  }, [pathname]);

  // Разрешаем сразу, если роут в белом списке
  if (isWhitelisted) return <>{children}</>;

  // ---- ИНАЧЕ — стандартная проверка Telegram WebApp ----
  const [ok, setOk] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      let allow = false;

      // 1) Есть Telegram WebApp объект?
      const tg = (window as any)?.Telegram?.WebApp;
      if (tg) {
        try { tg.ready?.(); } catch {}
        allow = true;
      }

      // 2) Есть initData в query?
      const sp = new URLSearchParams(window.location.search);
      if (sp.get('initData') || sp.get('initdata') || sp.get('init_data')) {
        allow = true;
      }

      // 3) Открыто внутри web.telegram.org iframe (ancestorOrigins)?
      try {
        const ao = (window.location as any)?.ancestorOrigins;
        if (ao && Array.from(ao as unknown as string[]).some((o) => (o || '').includes('web.telegram.org') || (o || '').includes('t.me'))) {
          allow = true;
        }
      } catch {}

      setOk(allow);
    } catch {
      setOk(false);
    }
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
        <div className="card fade-in" style={{ textAlign: 'center', maxWidth: 420 }}>
          <div className="h2" style={{ marginBottom: 6 }}>Доступ только из Telegram</div>
          <div className="sub">Откройте мини-приложение через нашего бота.</div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}