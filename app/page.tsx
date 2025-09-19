'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

function openExternal(url: string) {
  try {
    // Открытие во внешнем браузере из Telegram WebApp (iOS требует user gesture)
    // @ts-ignore
    const tg = (window as any)?.Telegram?.WebApp;
    if (tg && typeof tg.openLink === 'function') {
      tg.openLink(url, { try_instant_view: false });
      return;
    }
  } catch {}
  // ПК / обычный браузер
  window.open(url, '_blank', 'noopener,noreferrer');
}

export default function Page() {
  const router = useRouter();
  const [amount, setAmount] = useState<number>(500);
  const [loading, setLoading] = useState(false);

  // initData (на всякий случай — если нужно пробрасывать в API)
  const initData = useMemo(() => {
    try {
      // @ts-ignore
      const tg = (window as any)?.Telegram?.WebApp;
      if (tg?.initData) return tg.initData as string;
    } catch {}
    try {
      const sp = new URLSearchParams(window.location.search);
      return (
        sp.get('tgWebAppData') ||
        sp.get('initData') ||
        sp.get('initdata') ||
        sp.get('init_data') ||
        undefined
      );
    } catch {}
    return undefined;
  }, []);

  async function handlePay() {
    if (!amount || amount <= 0) return;
    setLoading(true);
    try {
      // ВНИМАНИЕ: здесь вызываем ваш старт оплаты, который ДОЛЖЕН вернуть { ok, id, url }
      // id — это депозит (для статуса / ожидания), url — ссылка кассы
      const r = await fetch('/api/pay/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, initData }),
      });
      const data = await r.json();

      if (!r.ok || !data?.ok || !data?.url || !data?.id) {
        throw new Error(data?.error || `Server error (${r.status})`);
      }

      // КРИТИЧЕСКОЕ — открываем кассу СЕЙЧАС, пока мы ещё в обработчике клика
      openExternal(data.url);

      // И параллельно отрисовываем экран ожидания статуса
      // (он больше НЕ пытается открыть кассу сам, он толькоpoll'ит статус)
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
            Баланс: — <span style={{ opacity: 0.6, marginLeft: 8 }}>(вне Telegram авторизация недоступна)</span>
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
          В Telegram оплата пройдёт во внешнем браузере. После успешной оплаты на странице будет «Спасибо,
          можете закрыть вкладку», а в боте перезапустите мини-приложение — баланс обновится.
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