'use client';

import React from 'react';

export default function FkErrorPage() {
  return (
    <main className="center" style={{ padding: 24 }}>
      <div className="card fade-in" style={{ maxWidth: 560, textAlign: 'center' }}>
        <div className="h2">❌ Платёж не выполнен</div>
        <p className="sub" style={{ marginTop: 6 }}>
          Попробуйте ещё раз. Если деньги списались — дождитесь подтверждения от кассы и сообщения в боте.
        </p>
      </div>
    </main>
  );
}