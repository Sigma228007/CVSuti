'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { fetchBalance } from '@/lib/api';
import { getInitData as getInitDataFromWebapp } from '@/lib/webapp';

/** Внешняя обёртка — только для Suspense */
export default function Page() {
  return (
    <Suspense fallback={<main style={{ padding: 24, color: '#e6eef3' }}>Загрузка…</main>}>
      <PageInner />
    </Suspense>
  );
}

function PageInner() {
  const [amount, setAmount] = useState<number>(500);
  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);

  const sp = useSearchParams();       // теперь внутри Suspense — ок
  const router = useRouter();
  const initData = useMemo(() => getInitDataFromWebapp() || '', []);

  async function refreshBalanceSafe() {
    if (!initData) { setBalance(null); return; }
    try {
      const b = await fetchBalance();
      setBalance(b);
    } catch {
      setBalance(null);
    }
  }

  // первичная загрузка
  useEffect(() => {
    refreshBalanceSafe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initData]);

  // пришли с /pay/[id]?paid=1 — обновляем баланс и чистим query
  useEffect(() => {
    const paid = sp.get('paid');
    if (paid === '1') {
      refreshBalanceSafe().then(() => {
        const url = new URL(window.location.href);
        url.searchParams.delete('paid');
        url.searchParams.delete('amt');
        url.searchParams.delete('t');
        router.replace(url.pathname + (url.searchParams.toString() ? `?${url.searchParams.toString()}` : ''));
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp]);

  // рефреш при возвращении на вкладку
  useEffect(() => {
    function onFocus() { refreshBalanceSafe(); }
    function onVisible() { if (document.visibilityState === 'visible') refreshBalanceSafe(); }
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initData]);

  async function handlePay() {
    setLoading(true);
    try {
      if (initData) {
        // Телеграм: новый флоу
        const res = await fetch('/api/pay/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount, initData }),
        });
        const data = await res.json();
        if (!res.ok || !data?.ok || !data?.id || !data?.url) {
          const msg = data?.error || `Server error (${res.status})`;
          alert('Ошибка: ' + msg);
          return;
        }
        window.location.href = `/pay/${data.id}?url=${encodeURIComponent(data.url)}`;
      } else {
        // Браузер/ПК: прямой инвойс
        const res = await fetch('/api/fkwallet/invoice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount }),
        });
        const data = await res.json();
        if (!res.ok || !data?.ok || !data?.url) {
          const msg = data?.error || `Server error (${res.status})`;
          alert('Ошибка: ' + msg);
          return;
        }
        const inTelegram = !!(window as any)?.Telegram?.WebApp;
        if (inTelegram) window.location.href = data.url;
        else window.open(data.url, '_blank', 'noopener,noreferrer');
      }
    } catch (e: any) {
      alert('Ошибка сети: ' + (e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  const depositDetails =
    (process.env.NEXT_PUBLIC_DEPOSIT_DETAILS || process.env.NEXT_PUBLIC_DEPOSITS_DETAILS || '').toString();

  return (
    <main style={{ padding: 24, fontFamily: 'Inter, Arial, sans-serif', color: '#e6eef3' }}>
      <h1 style={{ color: '#fff', marginBottom: 16 }}>GVsuti — Пополнение</h1>

      <div
        style={{
          marginTop: 8,
          background: '#0f1720',
          padding: 20,
          borderRadius: 12,
          maxWidth: 900,
          boxShadow: '0 6px 24px rgba(0,0,0,0.25)',
        }}
      >
        <div style={{ marginBottom: 12 }}>
          <span
            style={{
              fontSize: 14,
              background: '#111827',
              padding: '6px 10px',
              borderRadius: 8,
              color: '#93c5fd',
            }}
          >
            Баланс:&nbsp;{balance === null ? '—' : `${balance} ₽`}
            <span style={{ opacity: 0.6, marginLeft: 8 }}>
              {balance === null ? '(вне Telegram авторизация недоступна)' : ''}
            </span>
          </span>
        </div>

        {depositDetails && (
          <div style={{ marginBottom: 12, color: '#9aa9bd' }}>
            <small>Реквизиты: {depositDetails}</small>
          </div>
        )}

        <label style={{ display: 'block', marginBottom: 8, color: '#cbd5e1' }}>Сумма</label>
        <input
          type="number"
          min={1}
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          style={{
            padding: 10,
            width: 220,
            borderRadius: 10,
            border: '1px solid #1f2937',
            background: '#0b1220',
            color: '#e6eef3',
            outline: 'none',
            marginBottom: 14,
          }}
        />

        <p style={{ marginTop: 4, marginBottom: 14, color: '#9aa9bd', lineHeight: 1.45 }}>
          В Telegram оплата пройдёт внутри мини-приложения, статус обновится автоматически.
          В обычном браузере откроется касса на сайте платёжного провайдера.
        </p>

        <button
          onClick={handlePay}
          disabled={loading || !amount || amount <= 0}
          style={{
            padding: '12px 18px',
            background: loading ? '#128a71' : '#19b894',
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            cursor: loading ? 'default' : 'pointer',
            fontWeight: 600,
          }}
        >
          {loading ? 'Подготовка…' : 'Оплатить'}
        </button>
      </div>
    </main>
  );
}