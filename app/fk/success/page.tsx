'use client';

import React, { useEffect } from 'react';

export default function FkSuccessPage() {
  // Ничего не открываем и никуда не редиректим — только текст.
  // Дадим небольшой "виб" для айфона/андроида, чтобы было понятно, что всё ок.
  useEffect(() => {
    try {
      if (window?.navigator?.vibrate) window.navigator.vibrate(12);
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
        <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>Оплата принята ✅</div>
        <div style={{ color: '#9aa9bd', lineHeight: 1.5 }}>
          Спасибо! Эту страницу можно закрыть.
          <br />
          Вернитесь в Telegram. В мини-приложении будет показано сообщение
          «Платёж зачислен, перезагрузите мини-приложение для обновления баланса».
        </div>
      </div>
    </main>
  );
}