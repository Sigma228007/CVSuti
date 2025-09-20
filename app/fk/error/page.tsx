'use client';

import React, { useEffect } from 'react';

export default function FkFailPage() {
  useEffect(() => {
    try {
      if (window?.navigator?.vibrate) window.navigator.vibrate([10, 40, 10]);
    } catch {}
  }, []);

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#0b0f16',
        color: '#e5e7eb',
        display: 'grid',
        placeItems: 'center',
        padding: 16,
        fontFamily: 'ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto',
      }}
    >
      <div
        style={{
          width: 'min(560px, 92vw)',
          background: '#111827',
          border: '1px solid rgba(255,255,255,.08)',
          borderRadius: 16,
          padding: 18,
          textAlign: 'center',
          boxShadow: '0 12px 36px rgba(0,0,0,.55)',
        }}
      >
        <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>Платёж не прошёл ❌</div>
        <div style={{ color: '#9aa9bd', lineHeight: 1.5 }}>
          Вы можете закрыть эту страницу и попробовать оплатить ещё раз из мини-приложения в Telegram.
        </div>
      </div>
    </main>
  );
}