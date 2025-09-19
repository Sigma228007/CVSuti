'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getInitData } from '@/lib/webapp';

export default function PayPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [status, setStatus] = useState<'pending' | 'approved' | 'declined' | 'loading'>('loading');
  const [amount, setAmount] = useState<number | null>(null);
  const [gotoUrl, setGotoUrl] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);

  const initData = useMemo(() => getInitData() || undefined, []);

  // подтянем статус и сумму
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
    const t = setInterval(tick, 2500); // авто-обновление
    return () => { stop = true; clearInterval(t); };
  }, [id]);

  // получим ссылку на кассу (один раз)
  useEffect(() => {
    (async () => {
      try {
        // Мы не знаем сумму здесь → пусть юзер создаёт инвойс с главной.
        // Но чтобы /pay/[id] открывалось в одиночку, дёрнем старт с суммой из статуса
        // (если статус уже есть). Если сумма ещё не пришла — подождём.
        if (amount) {
          const r = await fetch('/api/pay/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount, initData }),
          });
          const d = await r.json();
          if (d?.ok && d.id === id) {
            setGotoUrl(d.url);
          }
        }
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount, id]);

  function openInside() {
    if (!gotoUrl) return;
    setOpening(true);
    // Внутри Telegram — остаёмся в том же WebView
    window.location.href = gotoUrl;
  }

  if (status === 'loading') {
    return <div className="center"><div className="card">Загрузка...</div></div>;
  }

  if (status === 'approved') {
    return (
      <div className="center">
        <div className="card">
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
        <div className="card">
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
      <div className="card">
        <div className="h2">Оплата {amount ? `${amount} ₽` : ''}</div>
        <div className="sub" style={{ marginBottom: 12 }}>
          Откройте кассу. После успешной оплаты статус обновится автоматически.
        </div>

        <button className="btn" onClick={openInside} disabled={!gotoUrl || opening}>
          {opening ? 'Открываю…' : 'Открыть кассу'}
        </button>

        <div className="ticker" style={{ marginTop: 16 }}>
          <div>Ожидаем подтверждение оплаты… • страница обновится автоматически • </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <button className="btn-outline" onClick={() => router.push('/')}>Отмена</button>
        </div>
      </div>
    </main>
  );
}