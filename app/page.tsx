'use client';

import React, { useMemo, useState } from 'react';

function openExternal(url: string) {
  try {
    const tg = (window as any)?.Telegram?.WebApp;
    if (tg && typeof tg.openLink === 'function') {
      tg.openLink(url, { try_instant_view: false });
      return;
    }
  } catch {}
  window.open(url, '_blank', 'noopener,noreferrer');
}

export default function Page() {
  const [amount, setAmount] = useState<number>(500);
  const [loading, setLoading] = useState(false);

  // читаем initData (если запущено как Telegram WebApp)
  const initData = useMemo(() => {
    try {
      const tg = (window as any)?.Telegram?.WebApp;
      if (tg?.initData) return tg.initData as string;
    } catch {}
    try {
      const urlParams = new URLSearchParams(window.location.search);
      return (
        urlParams.get('initData') ||
        urlParams.get('initdata') ||
        urlParams.get('init_data') ||
        undefined
      );
    } catch {}
    return undefined;
  }, []);

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
        const msg = data?.error || `Server error (${res.status})`;
        alert('Ошибка: ' + msg);
        return;
      }
      openExternal(data.url);
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
            Баланс: 0 ₽ <span style={{ opacity: 0.6, marginLeft: 8 }}>(демо-заглушка)</span>
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
          Оплата через кассу (FKWallet / FreeKassa). Нажмите «Оплатить в кассе» — откроется внешняя
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
          {loading ? 'Подготовка…' : 'Оплатить в кассе'}
        </button>

        <div style={{ marginTop: 16, color: '#9aa9bd' }}>
          <small>
            Подсказка: если тестируешь в обычном браузере, <code>initData</code> может отсутствовать — сервер вернёт 401 на других эндпойнтах, но
            создание счёта для Freekassa всё равно отработает. Для полного флоу открой WebApp в Telegram.
          </small>
        </div>
      </div>
    </main>
  );
}