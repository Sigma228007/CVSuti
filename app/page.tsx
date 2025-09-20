'use client';

import React, { useEffect, useState } from 'react';
import Guard from '@/components/Guard';
import { fetchBalance } from '@/lib/api';
import { isInTelegramWebApp } from '@/lib/webapp';

export default function Page() {
  const [amount, setAmount] = useState<number>(500);
  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState<number>(0);
  const [inTG, setInTG] = useState(false);

  useEffect(() => {
    setInTG(isInTelegramWebApp());
    // Баланс тянем ОДИН раз при открытии (в ТГ).
    (async () => {
      if (!isInTelegramWebApp()) return;
      try { setBalance(await fetchBalance()); } catch {}
    })();
  }, []);

  async function handlePay() {
    setLoading(true);
    try {
      const res = await fetch('/api/fkwallet/invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        alert('Ошибка: ' + (data?.error || `Server error (${res.status})`));
        return;
      }

      // ВСЕГДА открываем во внешнем браузере
      window.open(String(data.url), '_blank', 'noopener,noreferrer');

      // В ТГ просто покажем подсказку (без автообновлений/проверок)
      try {
        const tg = (window as any)?.Telegram?.WebApp;
        tg?.showPopup?.({
          title: 'Ожидаем оплату…',
          message: 'Оплатите во внешнем браузере и вернитесь в Telegram. ' +
                   'После возвращения перезагрузите мини-приложение, чтобы обновить баланс.',
          buttons: [{ id: 'ok', type: 'default', text: 'OK' }],
        });
      } catch {}
    } catch (e: any) {
      alert('Ошибка сети: ' + (e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  function gotoProfile() {
    if (!inTG) return;
    window.location.href = '/profile';
  }

  async function refreshBalanceOnce() {
    if (!inTG) return;
    try { setBalance(await fetchBalance()); } catch {}
  }

  return (
    <Guard>
      <main className="container" style={{ paddingTop: 18 }}>
        <div className="row between wrap header">
          <div className="h1">GVsuti — Кошелёк</div>
          <div className="row gap8">
            <span className="badge">Баланс: {inTG ? `${balance} ₽` : '—'}</span>
            <button className="btn-outline" onClick={refreshBalanceOnce} disabled={!inTG}>Обновить</button>
            <button className="btn-outline" onClick={gotoProfile} disabled={!inTG}>Профиль</button>
          </div>
        </div>

        <div className="grid">
          <div className="card">
            <div className="h2">Пополнение через кассу</div>
            <div className="label">Сумма</div>
            <input
              type="number"
              min={1}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="input"
              style={{ maxWidth: 260 }}
            />
            <p className="sub" style={{ marginTop: 8 }}>
              Оплата откроется во внешнем браузере. После оплаты вернитесь в Telegram и
              <b> перезагрузите мини-приложение</b> для обновления баланса (кнопка «Обновить»).
            </p>
            <div className="row gap8" style={{ marginTop: 10 }}>
              <button onClick={handlePay} disabled={loading || !amount || amount <= 0} className="btn">
                {loading ? 'Подготовка…' : 'Оплатить'}
              </button>
              <button onClick={() => (inTG ? (window.location.href = '/withdraw') : null)} className="btn-outline" disabled={!inTG}>
                Вывод
              </button>
            </div>
          </div>

          <div className="card">
            <div className="h2">История</div>
            <p className="sub">Полная история пополнений и выводов — в профиле. Там же сводка и статус заявок.</p>
            <button className="btn-outline" onClick={gotoProfile} disabled={!inTG}>Открыть профиль →</button>
          </div>
        </div>
      </main>
    </Guard>
  );
}