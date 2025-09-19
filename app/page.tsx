'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchBalance } from '@/lib/api';
import { getInitData as getInitDataFromWebapp } from '@/lib/webapp';

export default function Page() {
  return (
    <Suspense fallback={<main style={{ padding: 24, color: '#e6eef3' }}>Загрузка…</main>}>
      <PageInner />
    </Suspense>
  );
}

function PageInner() {
  const router = useRouter();
  const [amount, setAmount] = useState<number>(500);
  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);

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

  useEffect(() => { refreshBalanceSafe(); }, [initData]);

  // Пополнение через FreeKassa
  async function handlePay() {
    setLoading(true);
    try {
      const res = await fetch('/api/fkwallet/invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, initData }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        alert('Ошибка: ' + (data?.error || `Server error (${res.status})`));
        return;
      }

      // Переходим на страницу оплаты
      const id = `dep_${Date.now()}`;
      router.push(`/pay/${id}?url=${encodeURIComponent(data.url)}`);
    } catch (e: any) {
      alert('Ошибка сети: ' + (e?.message || e));
    } finally {
      setLoading(false);
    }
  }

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
            Баланс:&nbsp;
            {balance === null ? '— (недоступно вне Telegram)' : `${balance} ₽`}
          </span>
        </div>

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
          Оплата через кассу (FKWallet / FreeKassa). Нажмите «Оплатить» — откроется внешняя
          страница оплаты. После успешной оплаты баланс обновится автоматически.
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