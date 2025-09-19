'use client';

import React, { useEffect, useMemo, useState } from 'react';

function getInitData(): string {
  try {
    const tg = (window as any)?.Telegram?.WebApp;
    if (tg?.initData && String(tg.initData).length > 0) return String(tg.initData);
  } catch {}
  try {
    const sp = new URLSearchParams(window.location.search);
    const q =
      sp.get('tgWebAppData') ||
      sp.get('initData') ||
      sp.get('initdata') ||
      sp.get('init_data');
    if (q) return q;
  } catch {}
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
  return '';
}

function looksLikeTelegramUA(): boolean {
  try {
    const ua = (navigator.userAgent || '').toLowerCase();
    return /telegram|tma|tgminiapp/.test(ua);
  } catch { return false; }
}

export default function Guard({ children }: { children: React.ReactNode }) {
  // только информационная плашка; ничего не блокируем
  const [showHint, setShowHint] = useState(false);

  const initData = useMemo(getInitData, []);
  useEffect(() => {
    // если нет initData и это не Telegram UA — покажем подсказку
    const isTG = looksLikeTelegramUA() || !!(window as any)?.Telegram?.WebApp;
    setShowHint(!initData && !isTG);
    try { (window as any)?.Telegram?.WebApp?.ready?.(); } catch {}
  }, [initData]);

  return (
    <>
      {showHint && (
        <div style={{
          position: 'sticky', top: 0, zIndex: 50,
          background: '#1f2937', borderBottom: '1px solid rgba(255,255,255,.08)',
          padding: '10px 14px', color: '#e5e7eb', fontSize: 13
        }}>
          Это демо-режим вне Telegram. Для авторизации и показа баланса — откройте мини-приложение через бота.
        </div>
      )}
      {children}
    </>
  );
}