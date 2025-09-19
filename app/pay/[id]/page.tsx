'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';

export default function PayPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const sp = useSearchParams();

  const [status, setStatus] = useState<'pending' | 'approved' | 'declined' | 'loading'>('loading');
  const [amount, setAmount] = useState<number | null>(null);

  useEffect(() => {
    let stop = false;
    async function tick() {
      try {
        const r = await fetch(`/api/pay/status?id=${encodeURIComponent(id)}`, { cache: 'no-store' });
        const d = await r.json();
        if (!stop && d?.ok) { setStatus(d.status); setAmount(d.amount); }
      } catch {}
    }
    tick();
    const t = setInterval(tick, 2500);
    return () => { stop = true; clearInterval(t); };
  }, [id]);

  if (status === 'loading') return <div className="center"><div className="card">Загрузка…</div></div>;

  if (status === 'approved') {
    return (
      <div className="center">
        <div className="card fade-in" style={{ textAlign: 'center' }}>
          <div className="h2">✅ Спасибо за пополнение!</div>
          <div className="sub">Зачислено: {amount} ₽</div>
          <div style={{ marginTop: 10, color: '#9aa9bd' }}>
            Можете закрыть эту страницу. В Telegram перезапустите мини-приложение, чтобы увидеть обновлённый баланс.
          </div>
          <div style={{ marginTop: 12 }}><button className="btn" onClick={()=>router.push('/')}>На главную</button></div>
        </div>
      </div>
    );
  }

  if (status === 'declined') {
    return (
      <div className="center">
        <div className="card fade-in" style={{ textAlign: 'center' }}>
          <div className="h2">❌ Оплата не прошла</div>
          <div className="sub">Попробуйте ещё раз.</div>
          <div style={{ marginTop: 10, color: '#9aa9bd' }}>
            В Telegram перезапустите мини-приложение, если баланс не обновился.
          </div>
          <div style={{ marginTop: 12 }}><button className="btn" onClick={()=>router.push('/')}>На главную</button></div>
        </div>
      </div>
    );
  }

  // pending
  return (
    <main className="center">
      <div className="card fade-in" style={{ maxWidth: 560 }}>
        <div className="h2">Ожидаем оплату…</div>
        <div className="sub">Касса открыта во внешнем браузере. После оплаты вернитесь в Telegram.</div>
        <div className="ticker" style={{ marginTop: 16 }}><div>Ждём подтверждение… • страница обновится автоматически • </div></div>
        <div style={{ marginTop: 14 }}><button className="btn-outline" onClick={()=>router.push('/')}>Отмена</button></div>
      </div>
    </main>
  );
}