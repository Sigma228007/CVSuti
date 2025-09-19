'use client';

import React, { useEffect, useState } from 'react';

function hasInitData(): boolean {
  try {
    const tg = (window as any)?.Telegram?.WebApp;
    if (tg?.initData && String(tg.initData).length > 0) return true;
  } catch {}
  try {
    const sp = new URLSearchParams(window.location.search);
    if (sp.get('tgWebAppData') || sp.get('initData') || sp.get('initdata') || sp.get('init_data')) return true;
  } catch {}
  try {
    const raw = (window.location.hash || '').replace(/^#/, '');
    if (raw) {
      const hp = new URLSearchParams(raw);
      if (hp.get('tgWebAppData') || hp.get('initData') || hp.get('initdata') || hp.get('init_data')) return true;
    }
  } catch {}
  return false;
}

function looksLikeTelegram(): boolean {
  try {
    // 1) Наличие объекта Telegram.WebApp
    if ((window as any)?.Telegram?.WebApp) return true;

    // 2) ancestorOrigins/referrer (Telegram Web / t.me)
    const ao: any = (window.location as any).ancestorOrigins;
    if (ao && typeof ao.contains === 'function') {
      if (ao.contains('https://web.telegram.org') || ao.contains('https://t.me')) return true;
    } else if (ao) {
      const arr = Array.from(ao as unknown as Iterable<unknown>).map((v) => String(v));
      if (arr.some((o) => o.includes('web.telegram.org') || o.includes('t.me'))) return true;
    }
    const ref = document.referrer || '';
    if (ref.includes('web.telegram.org') || ref.includes('t.me')) return true;

    // 3) userAgent (iOS/Android клиенты Telegram/TMA)
    const ua = (navigator && navigator.userAgent ? navigator.userAgent : '').toLowerCase();
    if (/telegram|tma|tgminiapp/.test(ua)) return true;

    // 4) Встроенность (Telegram Web открывает мини-апп в iframe)
    if (window.top !== window.self) return true;
  } catch {}
  return false;
}

export default function Guard({ children }: { children: React.ReactNode }) {
  const [ok, setOk] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;

    const decide = () => {
      // Пропускаем, если есть ИЛИ initData, ИЛИ достоверные признаки Telegram
      const allow = hasInitData() || looksLikeTelegram();
      if (alive) setOk(allow);
    };

    // дергаем заранее ready(), если есть
    try { (window as any)?.Telegram?.WebApp?.ready?.(); } catch {}

    // мгновенная проверка + пуллинг 2 сек (каждые 150 мс)
    decide();
    let n = 0;
    const timer = setInterval(() => {
      if (ok === true) { clearInterval(timer); return; }
      decide();
      if (++n >= 14) clearInterval(timer); // ~2.1s
    }, 150);

    return () => { alive = false; clearInterval(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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