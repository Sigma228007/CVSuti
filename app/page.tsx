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
  const [toast, setToast] = useState<string | null>(null);

  const initData = useMemo(() => {
    try { return getInitData(); } catch { return ''; }
  }, []);
  const inTelegram = !!(window as any)?.Telegram?.WebApp;

  async function loadBalance() {
    try {
      const b = await fetchBalance().catch(() => 0);
      setBalance(Number.isFinite(b) ? b : 0);
    } catch {
      setBalance(0);
    }
  }

  // первичная подгрузка баланса
  useEffect(() => { loadBalance(); }, []);

  // показываем «успех оплаты» + обновляем баланс,
  // если нас вернули с paid=1 или startapp=paid_* (универсально для FK)
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const paid = sp.get('paid');
      const startapp = sp.get('startapp') || '';
      if (paid === '1' || /^paid_/i.test(startapp)) {
        setToast('Оплата прошла, баланс скоро обновится.');
        loadBalance();
        // чистим маркеры из адресной строки, чтобы тост не повторялся
        sp.delete('paid'); sp.delete('startapp');
        const url = `${window.location.pathname}${sp.toString() ? `?${sp.toString()}` : ''}`;
        window.history.replaceState({}, '', url);
      }
    } catch {}
  }, []);

  async function handlePay() {
    if (!amount || amount <= 0) return;
    setLoading(true);
    try {
      const data = await apiPost<{ ok: boolean; url?: string; error?: string }>(
        '/api/fkwallet/invoice',
        { amount, initData }
      );
      if (!data?.ok || !data.url) {
        alert('Ошибка подготовки платежа' + (data?.error ? `: ${data.error}` : ''));
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
    <main className="container">
      {/* шапка */}
      <div className="row between header">
        <div className="h1">GVsuti — Кошелёк</div>
        <div className="row wrap" style={{ gap: 8 }}>
          <span className="badge">Баланс: <b className="k">{balance ?? '—'} ₽</b></span>
          <button className="btn-outline" onClick={loadBalance}>Обновить</button>
          <a className="btn-outline" href="/profile" style={{ textDecoration: 'none' }}>
            Профиль
          </a>
        </div>
      </div>

      {/* мягкое предупреждение вне Telegram */}
      {!inTelegram && !initData && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="sub">
            Это демо-режим вне Telegram. Для авторизации и показа баланса — откройте мини-приложение через бота.
          </div>
        </div>
      )}

      {/* тост об успешной оплате */}
      {toast && (
        <div className="card fade-in" style={{ marginBottom: 12, borderColor: 'rgba(52,211,153,.35)' }}>
          <div className="h2" style={{ marginBottom: 6 }}>✅ Оплата прошла</div>
          <div className="sub">Спасибо! Если баланс не обновился — нажмите «Обновить».</div>
          <div style={{ marginTop: 10 }}>
            <button className="btn-outline" onClick={() => setToast(null)}>Понятно</button>
          </div>
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns: '1fr', gap: 16 }}>
        {/* Пополнение */}
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
            Оплата откроется во внешнем браузере. После оплаты вернитесь в Telegram —
            баланс обновится после подтверждения администратором.
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

        {/* Тизер профиля/истории */}
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