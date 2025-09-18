'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type Method = 'card' | 'fkwallet';

function useInitData() {
  const [initData, setInitData] = useState<string>('');
  useEffect(() => {
    try {
      const tg = (globalThis as any)?.Telegram?.WebApp;
      const raw = tg?.initData || '';
      setInitData(typeof raw === 'string' ? raw : '');
    } catch {
      setInitData('');
    }
  }, []);
  return initData;
}

const DEPOSIT_DETAILS =
  process.env.NEXT_PUBLIC_DEPOSIT_DETAILS ||
  process.env.NEXT_PUBLIC_DEPOSITS_DETAILS ||
  '';

export default function Page() {
  const initData = useInitData();

  const [balance, setBalance] = useState<number>(0);
  const [loadingBalance, setLoadingBalance] = useState(false);

  const [amount, setAmount] = useState<number>(500);
  const [tab, setTab] = useState<Method>('card');
  const [busy, setBusy] = useState(false);

  const canCall = useMemo(() => initData && initData.length > 0, [initData]);

  const fetchBalance = useCallback(async () => {
    if (!canCall) return;
    setLoadingBalance(true);
    try {
      const r = await fetch('/api/balance', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ initData }),
      });
      const d = await r.json().catch(() => ({}));
      if (d?.ok && typeof d.balance === 'number') {
        setBalance(d.balance);
      }
    } catch {
      // игнор — просто не обновим баланс
    } finally {
      setLoadingBalance(false);
    }
  }, [canCall, initData]);

  useEffect(() => {
    // при первом монтировании и затем каждые 12 сек
    fetchBalance();
    const id = setInterval(fetchBalance, 12_000);
    return () => clearInterval(id);
  }, [fetchBalance]);

  const onCreateCardInvoice = useCallback(async () => {
    if (!canCall) return alert('WebApp initData недоступен.');
    if (!amount || amount <= 0) return alert('Введите сумму > 0');

    setBusy(true);
    try {
      const r = await fetch('/api/deposit/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ initData, amount }),
      });
      const d = await r.json();
      if (!d?.ok) {
        alert(d?.error || 'Не удалось создать пополнение');
        return;
      }
      // далее админ подтверждает — баланс подтянется через опрос
      alert('Заявка на пополнение создана. Ожидайте подтверждения.');
    } catch {
      alert('Сеть недоступна');
    } finally {
      setBusy(false);
    }
  }, [canCall, initData, amount]);

  const onCreateFKWalletInvoice = useCallback(async () => {
    if (!canCall) return alert('WebApp initData недоступен.');
    if (!amount || amount <= 0) return alert('Введите сумму > 0');

    setBusy(true);
    try {
      const r = await fetch('/api/fkwallet/invoice', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ initData, amount }),
      });
      const d = await r.json();
      if (d?.url) {
        // В Telegram-мини-приложении внешняя ссылка открывается во внешнем браузере.
        // Пользователь вернётся назад и баланс обновится автоматически.
        window.open(d.url, '_blank');
      } else {
        alert(d?.error || 'Не удалось создать счёт в кассе');
      }
    } catch {
      alert('Сеть недоступна');
    } finally {
      setBusy(false);
    }
  }, [canCall, initData, amount]);

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: 16 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <h1 style={{ margin: 0 }}>GVsuti</h1>
        <button
          onClick={fetchBalance}
          disabled={loadingBalance}
          style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #444' }}
        >
          Баланс: {loadingBalance ? '…' : `${balance} ₽`}
        </button>
      </header>

      <section style={{ marginTop: 20, padding: 16, border: '1px solid #333', borderRadius: 12 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button
            onClick={() => setTab('card')}
            style={{
              padding: '6px 10px',
              borderRadius: 8,
              border: '1px solid #444',
              background: tab === 'card' ? '#1f6feb' : 'transparent',
              color: tab === 'card' ? '#fff' : 'inherit',
            }}
          >
            Банковская карта
          </button>
          <button
            onClick={() => setTab('fkwallet')}
            style={{
              padding: '6px 10px',
              borderRadius: 8,
              border: '1px solid #444',
              background: tab === 'fkwallet' ? '#1f6feb' : 'transparent',
              color: tab === 'fkwallet' ? '#fff' : 'inherit',
            }}
          >
            Касса (FKWallet)
          </button>
        </div>

        <label style={{ display: 'block', marginBottom: 8 }}>
          Сумма
          <input
            type="number"
            value={amount}
            min={1}
            onChange={(e) => setAmount(Math.max(0, Math.floor(Number(e.target.value || '0'))))}
            style={{
              width: '100%',
              marginTop: 6,
              padding: 10,
              borderRadius: 10,
              border: '1px solid #444',
              background: 'transparent',
              color: 'inherit',
            }}
          />
        </label>

        <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 12 }}>
          Оплата через кассу (FKWallet / FreeKassa). Нажмите «Оплатить в кассе» — откроется
          страница оплаты во внешнем браузере. После успешной оплаты баланс обновится автоматически.
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {tab === 'card' ? (
            <button
              disabled={busy || !canCall}
              onClick={onCreateCardInvoice}
              style={{
                padding: '10px 14px',
                borderRadius: 10,
                border: 'none',
                background: '#2ea043',
                color: '#fff',
              }}
            >
              Создать заявку (карта)
            </button>
          ) : (
            <button
              disabled={busy || !canCall}
              onClick={onCreateFKWalletInvoice}
              style={{
                padding: '10px 14px',
                borderRadius: 10,
                border: 'none',
                background: '#2ea043',
                color: '#fff',
              }}
            >
              Оплатить в кассе
            </button>
          )}
        </div>
      </section>

      {DEPOSIT_DETAILS ? (
        <section style={{ marginTop: 16, padding: 12, border: '1px dashed #444', borderRadius: 10, fontSize: 13, whiteSpace: 'pre-wrap' }}>
          {DEPOSIT_DETAILS}
        </section>
      ) : null}
    </main>
  );
}