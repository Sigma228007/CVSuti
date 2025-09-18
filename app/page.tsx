'use client';

import React, { useEffect, useMemo, useState } from 'react';

type ApiOk<T> = { ok: true } & T;
type ApiErr = { ok: false; error?: string };

function readInitData(): string {
  // 1) нормальный путь
  // @ts-ignore
  const w: any = typeof window !== 'undefined' ? window : undefined;
  const fromTG = w?.Telegram?.WebApp?.initData;
  if (fromTG && typeof fromTG === 'string' && fromTG.length > 0) return fromTG;

  // 2) иногда Telegram кладёт в hash или search
  const h = typeof window !== 'undefined' ? window.location.hash : '';
  const s = typeof window !== 'undefined' ? window.location.search : '';
  const tryKeys = ['tgWebAppData', 'tgWebAppStartParam', 'initData'];

  for (const k of tryKeys) {
    const m1 = new URLSearchParams(h.replace(/^#/, ''));
    const v1 = m1.get(k);
    if (v1) return v1;
    const m2 = new URLSearchParams(s);
    const v2 = m2.get(k);
    if (v2) return v2;
  }

  return ''; // нет initData
}

export default function Page() {
  const [initData, setInitData] = useState<string>('');
  const [balance, setBalance] = useState<number>(0);
  const [amount, setAmount] = useState<string>('500');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // подтягиваем initData
  useEffect(() => {
    setInitData(readInitData());
    // попросим Telegram расширить webApp (необязательно)
    // @ts-ignore
    try { window?.Telegram?.WebApp?.expand?.(); } catch {}
  }, []);

  // баланс
  async function refreshBalance() {
    try {
      const r = await fetch('/api/balance', { cache: 'no-store' });
      if (r.status === 401) {
        setMsg('401: открой в Telegram (webapp) — нет initData');
        return;
      }
      const d = await r.json();
      if (d?.ok) setBalance(d.balance ?? 0);
    } catch {
      setMsg('Не удалось получить баланс');
    }
  }

  useEffect(() => {
    refreshBalance();
  }, [initData]);

  const canPay = useMemo(() => {
    const a = Number(amount);
    return !!initData && !busy && Number.isFinite(a) && a > 0;
  }, [initData, busy, amount]);

  async function payFK() {
    if (!canPay) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch('/api/fkwallet/invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData, amount: Number(amount) }),
      });

      if (r.status === 401) {
        setMsg('401: нет прав — запусти бот внутри Telegram');
        return;
      }
      const d: ApiOk<{ url: string }> | ApiErr = await r.json();

      if ('ok' in d && d.ok && 'url' in d && d.url) {
        // открыть во внешнем браузере
        window.open(d.url, '_blank', 'noopener,noreferrer');
        setMsg('Счёт открыт. После оплаты вернись — баланс обновится.');
      } else {
        setMsg((d as ApiErr).error || 'Не удалось создать счёт');
      }
    } catch {
      setMsg('Сеть/сервер недоступен');
    } finally {
      setBusy(false);
      // попробуем обновить баланс с задержкой
      setTimeout(refreshBalance, 3000);
    }
  }

  return (
    <div style={{ maxWidth: 680, margin: '32px auto', padding: 16, color: '#e8eef7', fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto' }}>
      <h1 style={{ margin: 0, marginBottom: 12 }}>GVsuti</h1>

      <div style={{ marginBottom: 8, textAlign: 'right' }}>
        Баланс: <b>{balance} ₽</b>{' '}
        <button
          onClick={refreshBalance}
          style={{ background: 'transparent', color: '#8bd6ff', border: '1px solid #2b4b63', borderRadius: 8, padding: '2px 8px', cursor: 'pointer' }}>
          Обновить
        </button>
      </div>

      <div style={{ border: '1px solid #2b2f38', borderRadius: 12, padding: 16, background: '#0f141a' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button style={{ background: '#1d2a36', color: '#cfe8ff', border: '1px solid #2b4b63', borderRadius: 999, padding: '6px 12px' }}>Банковская карта</button>
          <button style={{ background: '#13364f', color: '#cfe8ff', border: '1px solid #2b4b63', borderRadius: 999, padding: '6px 12px' }}>Касса (FKWallet)</button>
        </div>

        <label style={{ display: 'block', fontSize: 12, color: '#a9b5c1', marginBottom: 6 }}>Сумма</label>
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))}
          inputMode="numeric"
          placeholder="500"
          style={{
            width: '100%',
            background: '#0b1116',
            color: '#e8eef7',
            border: '1px solid #233141',
            borderRadius: 10,
            padding: '10px 12px',
            outline: 'none',
          }}
        />

        <p style={{ color: '#97a6b4', fontSize: 12, lineHeight: 1.5, marginTop: 10 }}>
          Оплата через кассу (FKWallet / FreeKassa). Нажмите «Оплатить в кассе» — откроется страница оплаты во внешнем браузере. После успешной оплаты баланс обновится автоматически.
        </p>

        <button
          disabled={!canPay}
          onClick={payFK}
          style={{
            background: canPay ? 'linear-gradient(90deg,#15b093,#2ec6df)' : '#1c2833',
            color: canPay ? '#061018' : '#7b8b98',
            border: 'none',
            borderRadius: 10,
            padding: '10px 14px',
            cursor: canPay ? 'pointer' : 'not-allowed',
          }}
        >
          {busy ? 'Создаём счёт…' : 'Оплатить в кассе'}
        </button>

        {!initData && (
          <div style={{ marginTop: 10, color: '#f0c674', fontSize: 12 }}>
            Нет <code>initData</code>. Открой ссылку **из Telegram** (бота). В браузере напрямую WebApp не авторизуется.
          </div>
        )}

        {msg && (
          <div style={{ marginTop: 10, color: '#d1e7ff', background: '#0b1a25', border: '1px solid #1c3a53', padding: 10, borderRadius: 8 }}>
            {msg}
          </div>
        )}
      </div>

      <div style={{ opacity: 0.6, fontSize: 12, marginTop: 16, border: '1px dashed #2b2f38', borderRadius: 10, padding: 10 }}>
        «Карта · 1245 3456 2387 3465 · Получатель: ООО “Пример”»
      </div>
    </div>
  );
}