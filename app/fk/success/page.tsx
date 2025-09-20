'use client';
import React from 'react';

export default function SuccessPage() {
  // Просто страница «спасибо». Никакой логики — начисление делает callback.
  return (
    <main className="center">
      <div className="card fade-in" style={{ maxWidth: 520 }}>
        <div className="h2">✅ Оплата прошла</div>
        <p className="sub" style={{ marginTop: 8 }}>
          Спасибо! Можете закрыть эту вкладку.
        </p>
        <div style={{ marginTop: 12 }}>
          <a className="btn-outline" href="javascript:window.close()">Закрыть</a>
        </div>
      </div>
    </main>
  );
}