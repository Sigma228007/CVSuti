'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { fetchBalance } from '@/lib/api';
import { getInitData } from '@/lib/webapp';

export default function Page() {
  const [amount, setAmount] = useState<number>(500);
  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);

  const initData = useMemo(() => getInitData() || undefined, []);

  useEffect(() => {
    (async () => {
      try {
        const b = await fetchBalance();
        setBalance(b);
      } catch {
        setBalance(null);
      }
    })();
  }, []);

  async function handlePay() {
    setLoading(true);

    // Узнаём заранее: доступен ли Telegram API
    const tg = (window as any)?.Telegram?.WebApp;
    const canOpenViaTG = Boolean(tg && typeof tg.openLink === 'function');

    // Пред-окно создаём только если НЕТ tg.openLink
    const popup = !canOpenViaTG && typeof window !== 'undefined'
      ? window.open('', '_blank')
      : null;

    try {
      const res = await fetch('/api/fkwallet/invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, initData }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok || !data?.url) {
        const msg = data?.error || `Server error (${res.status})`;
        alert('Ошибка: ' + msg);
        if (popup) popup.close();
        return;
      }

      const url = String(data.url);

      if (canOpenViaTG) {
        try {
          tg.openLink(url, { try_instant_view: false });
          return;
        } catch {
          // если вдруг упало — идём в фолбек ниже
        }
      }

      if (popup && !popup.closed) {
        popup.location.href = url;
        return;
      }

      window.location.href = url;
    } catch (e: any) {
      alert('Ошибка сети: ' + (e?.message || e));
      if (popup && !popup.closed) popup.close();
    } finally {
      setLoading(false);
    }
  }

  const depositDetails =
    (process.env.NEXT_PUBLIC_DEPOSIT_DETAILS || process.env.NEXT_PUBLIC_DEPOSITS_DETAILS || '').toString();

  return (
    <main style={{ padding: 24, fontFamily: 'Inter, Arial, sans-serif', color: '#e6eef3' }}>
      <h1 style={{ color: '#fff', marginBottom: 16 }}>GVsuti — Пополнение</h1>

      <div style={{ marginTop: 8, background: '#0f1720', padding: 20, borderRadius: 12, maxWidth: 900, boxShadow: '0 6px 24px rgba(0,0,0,0.25)' }}>
        <div style={{ marginBottom: 12 }}>
          <span style={{ fontSize: 14, background: '#111827', padding: '6px 10px', borderRadius: 8, color: '#93c5fd' }}>
            Баланс:&nbsp;{balance === null ? '—' : `${balance} ₽`}
            <span style={{ opacity: 0.6, marginLeft: 8 }}>
              {balance === null ? '(открой как WebApp для авторизации)' : ''}
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
          style={{ padding: 10, width: 220, borderRadius: 10, border: '1px solid #1f2937', background: '#0b1220', color: '#e6eef3', outline: 'none', marginBottom: 14 }}
        />

        <p style={{ marginTop: 4, marginBottom: 14, color: '#9aa9bd', lineHeight: 1.45 }}>
          Оплата через кассу (FKWallet / FreeKassa). После успешной оплаты админ подтвердит — баланс обновится.
        </p>

        <button
          onClick={handlePay}
          disabled={loading || !amount || amount <= 0}
          style={{ padding: '12px 18px', background: loading ? '#128a71' : '#19b894', color: '#fff', border: 'none', borderRadius: 10, cursor: loading ? 'default' : 'pointer', fontWeight: 600 }}
        >
          {loading ? 'Подготовка…' : 'Оплатить в кассе'}
        </button>
      </div>
    </main>
  );
}