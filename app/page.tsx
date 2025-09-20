'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { fetchBalance, apiPost } from '@/lib/api';
import { getInitData } from '@/lib/webapp';

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
  const [balance, setBalance] = useState<number | null>(null);

  // initData для баннера «вне Telegram»
  const initData = useMemo(() => {
    try {
      return getInitData();
    } catch {
      return '';
    }
  }, []);

  // первичная загрузка баланса
  useEffect(() => {
    (async () => {
      try {
        const b = await fetchBalance().catch(() => 0);
        setBalance(Number.isFinite(b) ? b : 0);
      } catch {
        setBalance(0);
      }
    })();
  }, []);

  async function handlePay() {
    if (!amount || amount <= 0) return;
    setLoading(true);
    try {
      // получаем ссылку на оплату во FreeKassa/FKWallet
      const data = await apiPost<{ ok: boolean; url?: string; error?: string }>(
        '/api/fkwallet/invoice',
        { amount, initData }
      );

      if (!data?.ok || !data.url) {
        alert('Ошибка подготовки платежа' + (data?.error ? `: ${data.error}` : ''));
        return;
      }

      // открываем кассу: в Telegram — внутри webview, на ПК — новой вкладкой
      openExternal(data.url);
    } catch (e: any) {
      alert('Ошибка сети: ' + (e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function refreshBalance() {
    try {
      const b = await fetchBalance();
      setBalance(Number.isFinite(b) ? b : 0);
    } catch {}
  }

  const inTelegram = !!(window as any)?.Telegram?.WebApp;

  return (
    <main className="container">
      {/* шапка */}
      <div className="row between header">
        <div className="h1">GVsuti — Кошелёк</div>

        <div className="row wrap" style={{ gap: 8 }}>
          <span className="badge">
            Баланс: <b className="k">{balance ?? '—'} ₽</b>
          </span>
          <button className="btn-outline" onClick={refreshBalance}>Обновить</button>
          <a className="btn-outline" href="/profile" style={{ textDecoration: 'none' }}>
            Профиль
          </a>
        </div>
      </div>

      {/* предупреждение вне Telegram */}
      {!inTelegram && !initData && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="sub">
            Это демо-режим вне Telegram. Для авторизации и показа баланса — откройте мини-приложение через
            нашего бота.
          </div>
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns: '1fr', gap: 16 }}>
        {/* Блок пополнения */}
        <section className="card">
          <div className="h2">Пополнение через кассу</div>

          <label className="label">Сумма</label>
          <input
            type="number"
            min={1}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="input"
            placeholder="Введите сумму"
            style={{ maxWidth: 320 }}
          />

          <p className="sub" style={{ marginTop: 8 }}>
            Оплата откроется во внешнем браузере. После оплаты вернитесь в Telegram — баланс обновится после
            подтверждения администратором.
          </p>

          <div className="row" style={{ gap: 8, marginTop: 10 }}>
            <button
              onClick={handlePay}
              disabled={loading || !amount || amount <= 0}
              className="btn"
            >
              {loading ? 'Подготовка…' : 'Оплатить'}
            </button>

            <a className="btn-outline" href="/profile" style={{ textDecoration: 'none' }}>
              Вывод
            </a>
          </div>
        </section>

        {/* История (кусок-тизер) */}
        <section className="card">
          <div className="row between">
            <div className="h2">История</div>
            <a className="btn-outline" href="/profile" style={{ textDecoration: 'none' }}>
              Открыть профиль →
            </a>
          </div>
          <div className="sub" style={{ marginTop: 8 }}>
            Полная история пополнений и выводов доступна в профиле. Там же — сводка и статус заявок.
          </div>
        </section>
      </div>
    </main>
  );
}