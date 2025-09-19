'use client';

import React, { useEffect, useMemo, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { fetchBalance } from '@/lib/api';
import { getInitData } from '@/lib/webapp';

function openExternal(url: string) {
  try {
    const tg = (window as any)?.Telegram?.WebApp;
    if (tg?.openLink) { tg.openLink(url, { try_instant_view: false }); return; }
  } catch {}
  try {
    const a = document.createElement('a'); a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
    document.body.appendChild(a); a.click(); a.remove(); return;
  } catch {}
  try { window.open(url, '_blank', 'noopener,noreferrer'); } catch { window.location.href = url; }
}

export default function Page() {
  return (
    <Suspense fallback={<main style={{ padding: 24 }}>Загрузка…</main>}>
      <PageInner />
    </Suspense>
  );
}

function PageInner() {
  const router = useRouter();
  const [amount, setAmount] = useState<number>(500);
  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);

  const initData = useMemo(() => getInitData(), []);

  useEffect(() => {
    let stop = false;
    async function load() {
      if (!initData) { setBalance(null); return; }
      try { const b = await fetchBalance(); if (!stop) setBalance(b); } catch { if (!stop) setBalance(null); }
    }
    load();
    const t = setInterval(load, 10000);
    return () => { stop = true; clearInterval(t); };
  }, [initData]);

  async function handlePay() {
    if (!amount || amount <= 0) return;
    setLoading(true);
    try {
      const r = await fetch('/api/fkwallet/invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Init-Data': initData || '' },
        body: JSON.stringify({ amount, initData }),
      });
      const data = await r.json();
      if (!r.ok || !data?.ok || !data?.url || !data?.id) {
        throw new Error(data?.error || `Server error (${r.status})`);
      }

      // открыть кассу СЕЙЧАС (клик юзера)
      openExternal(data.url);

      // показать экран ожидания по реальному id депозита
      router.push(`/pay/${encodeURIComponent(data.id)}?url=${encodeURIComponent(data.url)}`);
    } catch (e: any) {
      alert('Ошибка: ' + (e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: 24, fontFamily: 'Inter, Arial, sans-serif', color: '#e6eef3' }}>
      <h1 style={{ color: '#fff', marginBottom: 16 }}>GVsuti — Пополнение</h1>
      <div style={{ marginTop: 8, background: '#0f1720', padding: 20, borderRadius: 12, maxWidth: 900 }}>
        <div style={{ marginBottom: 12 }}>
          <span style={{ fontSize: 14, background: '#111827', padding: '6px 10px', borderRadius: 8, color: '#93c5fd' }}>
            Баланс: {balance === null ? '— (вне Telegram недоступно)' : `${balance} ₽`}
          </span>
        </div>

        <label style={{ display: 'block', marginBottom: 8, color: '#cbd5e1' }}>Сумма</label>
        <input type="number" min={1} value={amount} onChange={(e)=>setAmount(Number(e.target.value))}
               style={{ padding: 10, width: 220, borderRadius: 10, border: '1px solid #1f2937', background: '#0b1220', color: '#e6eef3', outline: 'none', marginBottom: 14 }} />

        <p style={{ marginTop: 4, marginBottom: 14, color: '#9aa9bd' }}>
          Оплата откроется во внешнем браузере. После успешной оплаты закройте вкладку и вернитесь в Telegram.
        </p>

        <button onClick={handlePay} disabled={loading || !amount || amount <= 0}
                style={{ padding: '12px 18px', background: loading ? '#128a71' : '#19b894', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 600 }}>
          {loading ? 'Подготовка…' : 'Оплатить'}
        </button>
      </div>
    </main>
  );
}