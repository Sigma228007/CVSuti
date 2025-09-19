'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getInitData, isInTelegram } from '@/lib/webapp';
import { fetchBalance } from '@/lib/api'; // у тебя это уже есть

function openExternal(url: string) {
  // 1) пробуем официальный метод Telegram
  try {
    // @ts-ignore
    const tg = (window as any)?.Telegram?.WebApp;
    if (tg && typeof tg.openLink === 'function') {
      tg.openLink(url, { try_instant_view: false });
      return;
    }
  } catch {}

  // 2) создаём ссылку и кликаем по ней (часто срабатывает в iOS webview)
  try {
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    a.remove();
    return;
  } catch {}

  // 3) финальный fallback
  try {
    window.open(url, '_blank', 'noopener,noreferrer');
  } catch {
    // если webview глушит target=_blank — как самый крайний случай:
    window.location.href = url;
  }
}

export default function Page() {
  const router = useRouter();

  const [amount, setAmount] = useState<number>(500);
  const [loading, setLoading] = useState(false);

  const [balance, setBalance] = useState<number | null>(null);
  const [balanceErr, setBalanceErr] = useState<string | null>(null);

  const initData = useMemo(() => getInitData(), []);
  const insideTg = useMemo(() => isInTelegram(), []);

  // тянем баланс только если мы реально внутри Telegram (иначе будет 401)
  useEffect(() => {
    let stop = false;
    async function load() {
      if (!insideTg || !initData) {
        setBalance(null);
        return;
      }
      try {
        const b = await fetchBalance(); // этот метод уже шлёт X-Init-Data (см. твой lib/api.ts)
        if (!stop) {
          setBalance(b);
          setBalanceErr(null);
        }
      } catch (e: any) {
        if (!stop) {
          setBalance(null);
          setBalanceErr('Ошибка баланса');
        }
      }
    }
    load();
    const t = setInterval(load, 8000); // лёгкий авто-рефреш
    return () => { stop = true; clearInterval(t); };
  }, [insideTg, initData]);

  async function handlePay() {
    if (!amount || amount <= 0) return;
    setLoading(true);
    try {
      const r = await fetch('/api/pay/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Init-Data': initData || '', // <-- обязательно!
        },
        body: JSON.stringify({ amount }),
      });
      const data = await r.json();

      if (!r.ok || !data?.ok || !data?.url || !data?.id) {
        throw new Error(data?.error || `Server error (${r.status})`);
      }

      // ОЧЕНЬ ВАЖНО: открываем кассу прямо в клике
      openExternal(data.url);

      // Переходим на страницу ожидания статуса
      router.push(`/pay/${encodeURIComponent(data.id)}?url=${encodeURIComponent(data.url)}`);
    } catch (e: any) {
      alert('Ошибка: ' + (e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  const balanceLabel = insideTg
    ? (balance !== null ? `Баланс: ${balance} ₽` : 'Баланс: —')
    : 'Баланс: — (вне Telegram авторизация недоступна)';

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
            {balanceLabel}
            {balanceErr && <span style={{ color: '#ef4444', marginLeft: 8 }}>({balanceErr})</span>}
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
          В Telegram касса откроется во внешнем браузере. После успешной оплаты в браузере появится
          «Спасибо, можно закрыть вкладку». В боте достаточно перезапустить мини-приложение, и баланс обновится.
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