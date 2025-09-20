'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Guard from '@/components/Guard';
import { fetchBalance } from '@/lib/api';

function inTelegram(): boolean {
  try {
    const tg = (window as any)?.Telegram?.WebApp;
    if (tg && tg.initData) return true;
    const sp = new URLSearchParams(window.location.search);
    if (sp.get('tgWebAppData') || sp.get('initData')) return true;
    const ao = (window.location as any).ancestorOrigins;
    if (ao && Array.from(ao as any[]).some((o: string) =>
      typeof o === 'string' && (o.includes('web.telegram.org') || o.includes('t.me'))
    )) return true;
  } catch {}
  return false;
}

export default function Page() {
  const [amount, setAmount] = useState<number>(500);
  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState<number>(0);
  const [okTG, setOkTG] = useState<boolean>(false);

  useEffect(() => {
    setOkTG(inTelegram());
  }, []);

  // авто-баннер после успешной оплаты (если вернулись из браузера/кассы)
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const startapp = p.get('startapp') || '';
    if (startapp.startsWith('paid_dep_')) {
      // маленький тост
      try {
        const tg = (window as any)?.Telegram?.WebApp;
        if (tg?.showPopup) {
          tg.showPopup({ title: 'Оплата прошла', message: 'Баланс будет обновлён после подтверждения администратором.', buttons: [{ id: 'ok', type: 'default', text: 'OK' }] });
        }
      } catch {}
    }
  }, []);

  async function refreshBalance() {
    try {
      const v = await fetchBalance();
      setBalance(v);
    } catch {
      // вне Telegram fetchBalance возвращает 0 и сюда мы не попадём; а в Telegram — просто не шумим
    }
  }

  useEffect(() => {
    if (!okTG) return;
    refreshBalance();
  }, [okTG]);

  async function handlePay() {
    setLoading(true);
    try {
      const res = await fetch('/api/fkwallet/invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // вне Telegram initData на сервере не нужен — инвойс всё равно создаётся
        body: JSON.stringify({ amount }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        const msg = data?.error || `Server error (${res.status})`;
        alert('Ошибка: ' + msg);
        return;
      }

      // мобайл (ТГ): пусть открывает во внешнем браузере — так надёжнее
      // ПК: тоже новая вкладка
      const url = String(data.url);
      window.open(url, '_blank', 'noopener,noreferrer');

      // показываем экран ожидания (без навигации) — пользователь вручную вернётся в Telegram
      try {
        const tg = (window as any)?.Telegram?.WebApp;
        tg?.showPopup?.({
          title: 'Ожидаем оплату…',
          message: 'Откройте кассу во внешнем браузере.\nПосле оплаты просто вернитесь в Telegram — админ подтвердит и баланс обновится.',
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
    if (!okTG) return; // в браузере — просто не позволяем
    window.location.href = '/profile';
  }

  return (
    <main className="container" style={{ paddingTop: 18 }}>
      {!okTG && (
        <div className="card" style={{ marginBottom: 14 }}>
          Это демо-режим вне Telegram. Для авторизации и показа баланса — откройте мини-приложение через бота.
        </div>
      )}

      <div className="row between wrap header">
        <div className="h1">GVsuti — Кошелёк</div>
        <div className="row gap8">
          <span className="badge">Баланс: {okTG ? `${balance} ₽` : '0 ₽'}</span>
          <button className="btn-outline" onClick={refreshBalance} disabled={!okTG}>Обновить</button>
          <button className="btn-outline" onClick={gotoProfile} disabled={!okTG}>Профиль</button>
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
            Оплата откроется во внешнем браузере. После оплаты вернитесь в Telegram — баланс обновится после подтверждения администратором.
          </p>
          <div className="row gap8" style={{ marginTop: 10 }}>
            <button onClick={handlePay} disabled={loading || !amount || amount <= 0} className="btn">
              {loading ? 'Подготовка…' : 'Оплатить'}
            </button>
            <button onClick={() => window.location.href = '/withdraw'} className="btn-outline">Вывод</button>
          </div>
        </div>

        <div className="card">
          <div className="h2">История</div>
          <p className="sub">
            Полная история пополнений и выводов доступна в профиле. Там же — сводка и статус заявок.
          </p>
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn-outline" onClick={gotoProfile} disabled={!okTG}>
              Открыть профиль →
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}