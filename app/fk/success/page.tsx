'use client';

import React from 'react';

export default function FkSuccessPage() {
  return (
    <main className="center" style={{ padding: 24 }}>
      <div className="card fade-in" style={{ maxWidth: 560, textAlign: 'center' }}>
        <div className="h2">✅ Платёж принят</div>
        <p className="sub" style={{ marginTop: 6 }}>
          Спасибо! Можете закрыть эту страницу и вернуться в Telegram.
        </p>
        <p className="sub" style={{ marginTop: 10 }}>
          В боте появится сообщение о зачислении. Если его нет — откройте мини-приложение заново.
        </p>
      </div>
    </main>
  );
}