'use client';

import React, { useEffect, useMemo, useState } from 'react';

function uaLooksLikeTelegram(): boolean {
  try {
    const ua = (navigator && navigator.userAgent) ? navigator.userAgent.toLowerCase() : '';
    // мобильный Telegram содержит "Telegram" (iOS/Android), иногда "tgminiapp"
    return /telegram|tgminiapp/.test(ua);
  } catch {
    return false;
  }
}

function getInitDataFromAnyWhere(): string | null {
  if (typeof window === 'undefined') return null;

  // 1) Telegram.WebApp.initData
  try {
    const tg = (window as any)?.Telegram?.WebApp;
    if (tg?.initData && String(tg.initData).length > 0) return String(tg.initData);
  } catch {}

  // 2) ?tgWebAppData / ?initData
  try {
    const sp = new URLSearchParams(window.location.search);
    const q =
      sp.get('tgWebAppData') ||
      sp.get('initData') ||
      sp.get('initdata') ||
      sp.get('init_data');
    if (q) return q;
  } catch {}

  // 3) #tgWebAppData / #initData
  try {
    const raw = (window.location.hash || '').replace(/^#/, '');
    if (raw) {
      const hp = new URLSearchParams(raw);
      const h =
        hp.get('tgWebAppData') ||
        hp.get('initData') ||
        hp.get('initdata') ||
        hp.get('init_data');
      if (h) return h;
    }
  } catch {}

  // 4) Эвристики Telegram Web (iframe / переход из t.me)
  try {
    const ao: any = (window.location as any).ancestorOrigins;
    let fromAncestor = false;

    if (ao && typeof ao.contains === 'function') {
      fromAncestor =
        ao.contains('https://web.telegram.org') || ao.contains('https://t.me');
    } else if (ao) {
      const arr = Array.from(ao as unknown as Iterable<unknown>).map((v) => String(v));
      fromAncestor = arr.some((o) => o.includes('web.telegram.org') || o.includes('t.me'));
    }

    const ref = document.referrer || '';
    const fromRef = ref.includes('web.telegram.org') || ref.includes('t.me');

    if (fromAncestor || fromRef) {
      return '__from_iframe__';
    }
  } catch {}

  return null;
}

export default function Guard({ children }: { children: React.ReactNode }) {
  const [ok, setOk] = useState<boolean | null>(null);

  const initData = useMemo(getInitDataFromAnyWhere, []);

  useEffect(() => {
    // Телеграм может подставить initData чуть позже — делаем два тика
    let cancelled = false;

    function decide() {
      if (cancelled) return;
      const hasInit = Boolean(getInitDataFromAnyWhere());
      const looksTG = uaLooksLikeTelegram();
      // Пропускаем, если есть initData ИЛИ userAgent указывает на Telegram
      setOk(hasInit || looksTG);
    }

    try {
      const tg = (window as any)?.Telegram?.WebApp;
      if (tg?.ready) tg.ready();
    } catch {}

    decide();
    const t = setTimeout(decide, 100); // маленькая задержка — вдруг initData появится
    return () => { cancelled = true; clearTimeout(t); };
  }, [initData]);

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