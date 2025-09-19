'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';

export default function PayPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const sp = useSearchParams();

  const [status, setStatus] = useState<'pending' | 'approved' | 'declined' | 'loading'>('loading');
  const [amount, setAmount] = useState<number | null>(null);

  // URL кассы передаётся из /pay/[id]?url=...
  const payUrl = sp.get('url') || '';

  // --- 1) Авто-открытие кассы РОВНО ОДИН РАЗ ---
  const openedRef = useRef(false);
  useEffect(() => {
    if (openedRef.current) return;          // уже открывали
    if (!payUrl) return;                    // нет ссылки — нечего открывать
    openedRef.current = true;

    const t = setTimeout(() => {
      try {
        const tg = (window as any)?.Telegram?.WebApp;
        if (tg && typeof tg.openLink === 'function') {
          // Всегда внешний браузер — без Instant View
          tg.openLink(payUrl, { try_instant_view: false });
          return;
        }
      } catch {}
      // ПК или не внутри WebApp: новая вкладка
      try { window.open(payUrl, '_blank', 'noopener,noreferrer'); } catch {}
    }, 150);

    return () => clearTimeout(t);
  }, [payUrl]);

  // --- 2) Пулинг статуса депозита ---
  useEffect(() => {
    let stop = false;
    async function tick() {
      try {
        const r = await fetch(`/api/pay/status?id=${encodeURIComponent(id)}`, { cache: 'no-store' });
        const d = await r.json();
        if (!stop && d?.ok) {
          setStatus(d.status);
          setAmount(d.amount);
        }
      } catch {}
    }
    tick();
    const t = setInterval(tick, 2500);
    return () => { stop = true; clearInterval(t); };
  }, [id]);

  // --- 3) UI-состояния ---
  if (status === 'loading') {
    return <div className="center"><div className="card">Загрузка…</div></div>;
  }

  if (status === 'approved') {
    return (
      <div className="center">
        <div className="card fade-in" style={{ textAlign: 'center' }}>
          <div className="h2">✅ Оплата прошла</div>
          <div className="sub">Зачислено: {amount} ₽</div>
          <div style={{ marginTop: 12 }}>
            <button className="btn" onClick={() => router.push('/')}>На главную</button>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'declined') {
    return (
      <div className="center">
        <div className="card fade-in" style={{ textAlign: 'center' }}>
          <div className="h2">❌ Платёж отклонён</div>
          <div className="sub">Если это ошибка — напишите в поддержку.</div>
          <div style={{ marginTop: 12 }}>
            <button className="btn" onClick={() => router.push('/')}>Назад</button>
          </div>
        </div>
      </div>
    );
  }

  // pending
  return (
    <main className="center">
      <div className="card fade-in" style={{ maxWidth: 560 }}>
        <div className="h2">Ожидаем оплату…</div>
        <div className="sub">
          Касса уже открыта во внешнем браузере. После оплаты вернитесь в Telegram —
          баланс обновится автоматически.
        </div>

        <div className="ticker" style={{ marginTop: 16 }}>
          <div>Ждём подтверждение оплаты… • страница обновится автоматически • </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <button className="btn-outline" onClick={() => router.push('/')}>Отмена</button>
        </div>
      </div>
    </main>
  );
}