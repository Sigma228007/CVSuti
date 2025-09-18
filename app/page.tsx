'use client';

import React, { useCallback, useMemo, useState } from 'react';

type ApiOk<T> = { ok: true } & T;
type ApiErr = { ok: false; error: string };

function getInitData(): string {
  // initData доступен ТОЛЬКО внутри Telegram WebApp
  // Если ты открываешь в обычном браузере — его не будет.
  const anyWin = window as any;
  const td = anyWin?.Telegram?.WebApp?.initData;
  return typeof td === 'string' ? td : '';
}

export default function Page() {
  const [amount, setAmount] = useState<number>(500);
  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const initData = useMemo(() => getInitData(), []);

  const refreshBalance = useCallback(async () => {
    setLoading(true);
    try {
      const url = `/api/balance?initData=${encodeURIComponent(initData)}`;
      const r = await fetch(url, { cache: 'no-store' });
      const d = (await r.json()) as ApiOk<{ balance: number }> | ApiErr;
      if ('ok' in d && d.ok) setBalance(d.balance);
      else alert(`401: открой WebApp из Telegram (нет initData)\n${(d as ApiErr).error ?? ''}`);
    } catch (e) {
      console.error(e);
      alert('Не удалось получить баланс');
    } finally {
      setLoading(false);
    }
  }, [initData]);

  const payInFK = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/fkwallet/invoice?initData=${encodeURIComponent(initData)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      });
      const d = (await r.json()) as ApiOk<{ url: string }> | ApiErr;
      if ('ok' in d && d.ok) {
        // Откроем во внешнем браузере
        window.open(d.url, '_blank', 'noopener,noreferrer');
      } else {
        alert((d as ApiErr).error || 'Ошибка при создании счета');
      }
    } catch (e) {
      console.error(e);
      alert('Сеть недоступна или сервер не отвечает');
    } finally {
      setLoading(false);
    }
  }, [amount, initData]);

  return (
    <div className="min-h-screen bg-[#0c1219] text-white flex justify-center">
      <div className="w-full max-w-xl px-5 py-8">
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-2xl font-semibold">GVSuti</h1>
          <button
            className="text-sm px-3 py-1 rounded bg-[#0f2842]"
            onClick={refreshBalance}
            disabled={loading}
          >
            Баланс: {balance ?? 0} ₽ <span className="opacity-70 ml-1">Обновить</span>
          </button>
        </div>

        <div className="rounded-xl border border-[#1b2a3a] bg-[#0f1621] p-4">
          <div className="text-sm mb-2">Сумма</div>
          <input
            type="number"
            min={10}
            value={amount}
            onChange={(e) => setAmount(Math.max(1, Number(e.target.value || 0)))}
            className="w-full rounded-md bg-[#0b1118] border border-[#1b2a3a] px-3 py-2 outline-none"
          />

          <p className="text-xs mt-4 text-[#a7b3c2]">
            Оплата через кассу (FKWallet / FreeKassa). Нажмите «Оплатить в кассе» — откроется
            страница оплаты во внешнем браузере. После успешной оплаты баланс обновится
            автоматически.
          </p>

          <button
            onClick={payInFK}
            disabled={loading}
            className="mt-4 w-full rounded-md bg-[#16a34a] hover:bg-[#129243] transition-colors py-2 font-semibold disabled:opacity-60"
          >
            Оплатить в кассе
          </button>

          {!initData && (
            <div className="mt-4 text-xs text-amber-300">
              401: открой WebApp из Telegram (нет initData).
            </div>
          )}
        </div>

        <div className="mt-6 text-xs text-[#93a3b5] border border-[#1b2a3a] rounded-xl p-3 bg-[#0f1621]">
          <span className="opacity-70">*Подсказка:</span> Если вы тестируете в обычном браузере,
          параметр initData отсутствует и сервер ответит 401. Откройте приложение через Telegram
          WebApp.
        </div>
      </div>
    </div>
  );
}