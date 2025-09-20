'use client';

import React, { useEffect, useMemo, useState } from 'react';

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

function inTelegram() {
  return !!(window as any)?.Telegram?.WebApp;
}

export default function Page() {
  const [amount, setAmount] = useState(500);
  const [balance, setBalance] = useState<number | null>(null);
  const [loadingPay, setLoadingPay] = useState(false);

  const [pendingId, setPendingId] = useState<string | null>(null);
  const [waitingModal, setWaitingModal] = useState(false);
  const [justPaid, setJustPaid] = useState<{amount:number}|null>(null);

  // баланс — только в Telegram
  useEffect(() => {
    if (!inTelegram()) {
      setBalance(null);
      return;
    }
    let stop = false;
    async function load() {
      try {
        const r = await fetch('/api/balance?ts=' + Date.now(), { cache: 'no-store' });
        if (!r.ok) return;
        const d = await r.json();
        if (!stop) setBalance(Number(d?.balance ?? 0));
      } catch {}
    }
    load();
  }, []);

  // если ждём оплаты — опрашиваем статус
  useEffect(() => {
    if (!waitingModal || !pendingId) return;
    let stop = false;
    const t = setInterval(async () => {
      try {
        const r = await fetch(`/api/pay/status?id=${encodeURIComponent(pendingId)}`, { cache: 'no-store' });
        const d = await r.json();
        if (d?.ok && d.status === 'approved') {
          setWaitingModal(false);
          setPendingId(null);
          setJustPaid({ amount: Number(d.amount || amount) });
        }
        if (d?.ok && d.status === 'declined') {
          setWaitingModal(false);
          setPendingId(null);
          alert('❌ Платёж отклонён. Попробуйте ещё раз.');
        }
      } catch {}
    }, 5000);
    return () => { stop = true; clearInterval(t); };
  }, [waitingModal, pendingId]);

  async function handlePay() {
    setLoadingPay(true);
    try {
      const r = await fetch('/api/pay/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      });
      const d = await r.json();
      if (!r.ok || !d?.ok) throw new Error(d?.error || `HTTP ${r.status}`);

      // сохраняем pending
      setPendingId(d.id);
      setWaitingModal(true);
      // открываем кассу
      openExternal(d.url);
    } catch (e: any) {
      alert('Ошибка: ' + (e?.message || e));
    } finally {
      setLoadingPay(false);
    }
  }

  // кнопка «Обновить» в баннере
  function refreshApp() {
    try {
      const tg = (window as any)?.Telegram?.WebApp;
      if (tg?.ready) tg.reload();
      else window.location.reload();
    } catch {
      window.location.reload();
    }
  }

  return (
    <main className="container">
      {/* шапка */}
      <div className="row between wrap header">
        <div className="h1">GVsuti — Кошелёк</div>
        <div className="row gap8">
          <span className="badge">Баланс: {balance === null ? '—' : `${balance} ₽`}</span>
          <button className="btn-outline" onClick={() => window.location.reload()}>Обновить</button>
          <a className="btn-outline" href="/profile">Профиль</a>
        </div>
      </div>

      {/* предупреждение вне Telegram */}
      {!inTelegram() && (
        <div className="card" style={{ marginBottom: 14 }}>
          Это демо-режим вне Telegram. Для авторизации и показа баланса — откройте мини-приложение через бота.
        </div>
      )}

      {/* форма оплаты */}
      <div className="grid">
        <div className="card">
          <div className="h2">Пополнение через кассу</div>
          <label className="label">Сумма</label>
          <input
            className="input"
            type="number"
            min={1}
            value={amount}
            onChange={(e) => setAmount(Math.max(1, Number(e.target.value || 0)))}
            style={{ maxWidth: 280 }}
          />
          <p className="sub" style={{ marginTop: 8 }}>
            Оплата откроется во внешнем браузере. После оплаты вернитесь в Telegram и перезапустите
            мини-приложение для обновления баланса.
          </p>
          <div className="row gap8" style={{ marginTop: 10 }}>
            <button className="btn" disabled={loadingPay} onClick={handlePay}>
              {loadingPay ? 'Подготовка…' : 'Оплатить'}
            </button>
            <a className="btn-outline" href="/withdraw">Вывод</a>
          </div>
        </div>

        <div className="card">
          <div className="h2">История</div>
          <p className="sub">Полная история пополнений и выводов доступна в профиле.</p>
          <div style={{ marginTop: 8 }}>
            <a className="btn-outline" href="/profile">Открыть профиль →</a>
          </div>
        </div>
      </div>

      {/* Модалка ожидания оплаты */}
      {waitingModal && (
        <div className="overlay">
          <div className="modal">
            <div className="h2">Ожидаем оплату…</div>
            <p className="sub">
              Оплатите счёт во внешнем браузере, затем вернитесь в Telegram — мы сами поймём, что оплата пришла,
              и подскажем перезапустить мини-приложение.
            </p>
            <div className="info">Если что-то пошло не так — нажмите «Отмена» и попробуйте снова.</div>
            <div className="row gap8" style={{ marginTop: 10 }}>
              <button className="btn-outline" onClick={() => { setWaitingModal(false); setPendingId(null); }}>Отмена</button>
            </div>
          </div>
        </div>
      )}

      {/* Баннер после поступления оплаты */}
      {justPaid && (
        <div className="overlay">
          <div className="modal">
            <div className="h2">✅ Оплата зачислена</div>
            <p className="sub">Пожалуйста, перезапустите мини-приложение, чтобы увидеть обновлённый баланс.</p>
            <div className="row gap8" style={{ marginTop: 10 }}>
              <button className="btn" onClick={refreshApp}>Обновить</button>
              <button className="btn-outline" onClick={() => setJustPaid(null)}>Позже</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}