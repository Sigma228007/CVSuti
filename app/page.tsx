"use client";

import React, { useEffect, useMemo, useState } from "react";

/** Безопасный доступ к Telegram WebApp */
function getInitDataFromTMA(): string {
  // 1) Telegram WebApp JS
  // @ts-ignore
  const tma = typeof window !== "undefined" ? window.Telegram?.WebApp : undefined;
  const fromTMA = tma?.initData || "";
  if (fromTMA) return fromTMA;

  // 2) Параметр из URL (иногда хосты кладут initData в query)
  if (typeof window !== "undefined") {
    const u = new URL(window.location.href);
    const q = u.searchParams.get("tma_initData") || u.searchParams.get("initData");
    if (q) return q;
  }

  return "";
}

/** Небольшой helper для сообщений */
function toast(msg: string) {
  try {
    // легкий UX, без сторонних либ
    alert(msg);
  } catch {}
}

type InvoiceResp = { ok: true; url: string } | { ok: false; error: string };

export default function Page() {
  const [initData, setInitData] = useState<string>("");
  const [balance, setBalance] = useState<number | null>(null);
  const [depositOpen, setDepositOpen] = useState(false);
  const [depositTab, setDepositTab] = useState<"card" | "fk">("fk");
  const [amount, setAmount] = useState<number>(50);
  const [loading, setLoading] = useState(false);

  // Реквизиты (с фолбэком)
  const CARD_DETAILS = useMemo(() => {
    const primary = process.env.NEXT_PUBLIC_DEPOSIT_DETAILS;
    const fallback = process.env.NEXT_PUBLIC_DEPOSITS_DETAILS;
    return (primary && primary.trim()) || (fallback && fallback.trim()) || "Реквизиты не заданы";
  }, []);

  useEffect(() => {
    // Telegram ready
    // @ts-ignore
    window.Telegram?.WebApp?.ready?.();
    setInitData(getInitDataFromTMA());
  }, []);

  // Опционально тянем баланс, если у вас есть /api/balance
  useEffect(() => {
    let timer: any;
    async function fetchBalance() {
      if (!initData) return;
      try {
        const r = await fetch(`/api/balance?initData=${encodeURIComponent(initData)}`, { cache: "no-store" });
        if (r.ok) {
          const d = await r.json();
          if (typeof d.balance === "number") setBalance(d.balance);
        }
      } catch {}
    }
    fetchBalance();
    // обновлять раз в 20 сек
    timer = setInterval(fetchBalance, 20000);
    return () => clearInterval(timer);
  }, [initData]);

  async function createManualDeposit() {
    if (!initData) return toast("Нет initData из Telegram.");
    if (!amount || amount < 1) return toast("Введите сумму пополнения.");
    try {
      setLoading(true);
      const r = await fetch("/api/deposit/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData, amount }),
      });
      const d = await r.json();
      if (!r.ok || d?.ok === false) {
        return toast(d?.error || "Не удалось создать заявку на пополнение.");
      }
      toast("Заявка отправлена администратору. После подтверждения баланс увеличится.");
    } catch (e) {
      toast("Ошибка сети при создании заявки.");
    } finally {
      setLoading(false);
    }
  }

  async function payViaFK() {
    if (!initData) return toast("Нет initData из Telegram.");
    if (!amount || amount < 1) return toast("Введите сумму пополнения.");

    try {
      setLoading(true);
      const r = await fetch("/api/fkwallet/invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData, amount }),
      });
      const d: InvoiceResp = await r.json();
      if (!r.ok || d.ok === false) {
        return toast((d as any)?.error || "Не удалось создать счёт в кассе.");
      }

      // Открываем платёж в новом окне/вкладке
      window.open(d.url, "_blank", "noopener,noreferrer");
      toast("Счёт открыт во внешнем браузере. После успешной оплаты баланс увеличится автоматически.");
    } catch (e) {
      toast("Сеть/сервер недоступен.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-neutral-900 text-neutral-100">
      <div className="mx-auto max-w-3xl p-4 space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">GVSuti</h1>

          <div className="text-sm opacity-80">
            Баланс:&nbsp;
            <b>{balance === null ? "—" : `${balance} ₽`}</b>
          </div>
        </header>

        <div className="flex gap-3">
          <button
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500"
            onClick={() => setDepositOpen(true)}
          >
            Пополнить
          </button>
        </div>

        {/* --- Модалка пополнения --- */}
        {depositOpen && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
            <div className="w-full max-w-xl rounded-2xl bg-neutral-800 p-4 shadow-xl">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Пополнение баланса</h2>
                <button
                  className="rounded-xl bg-neutral-700 px-3 py-1 text-sm hover:bg-neutral-600"
                  onClick={() => setDepositOpen(false)}
                >
                  Закрыть
                </button>
              </div>

              {/* Tabs */}
              <div className="mb-3 flex gap-2">
                <button
                  onClick={() => setDepositTab("card")}
                  className={`rounded-lg px-3 py-1 text-sm ${
                    depositTab === "card" ? "bg-neutral-700" : "bg-neutral-700/40 hover:bg-neutral-700/60"
                  }`}
                >
                  Банковская карта
                </button>
                <button
                  onClick={() => setDepositTab("fk")}
                  className={`rounded-lg px-3 py-1 text-sm ${
                    depositTab === "fk" ? "bg-neutral-700" : "bg-neutral-700/40 hover:bg-neutral-700/60"
                  }`}
                >
                  Касса (FKWallet)
                </button>
              </div>

              {/* Сумма */}
              <div className="mb-3">
                <div className="mb-1 text-xs opacity-70">Сумма</div>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={amount}
                  onChange={(e) => setAmount(Math.max(1, Math.floor(Number(e.target.value || "0"))))}
                  className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-neutral-500"
                  placeholder="Например, 500"
                />
              </div>

              {/* Контент вкладок */}
              {depositTab === "fk" ? (
                <div className="space-y-3">
                  <p className="text-xs leading-5 text-neutral-300">
                    Оплата через кассу (FKWallet / FreeKassa).
                    Нажмите «Оплатить в кассе» — откроется страница оплаты во внешнем браузере.
                    После успешной оплаты баланс увеличится автоматически.
                  </p>

                  <div className="flex justify-between gap-2">
                    <button
                      className="rounded-lg bg-neutral-700 px-3 py-2 text-sm hover:bg-neutral-600"
                      onClick={() => setDepositOpen(false)}
                    >
                      Отмена
                    </button>
                    <button
                      className="rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium hover:bg-sky-500 disabled:opacity-60"
                      onClick={payViaFK}
                      disabled={loading}
                    >
                      Оплатить в кассе
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <div className="mb-1 text-xs opacity-70">Реквизиты для перевода</div>
                    <div className="rounded-lg border border-neutral-700 bg-neutral-900 p-3 text-sm">
                      {CARD_DETAILS}
                    </div>
                    <div className="mt-2 text-[11px] opacity-70">
                      После перевода нажмите «Я оплатил» — заявка отправится администратору. После подтверждения баланс
                      увеличится.
                    </div>
                  </div>

                  <div className="flex justify-between gap-2">
                    <button
                      className="rounded-lg bg-neutral-700 px-3 py-2 text-sm hover:bg-neutral-600"
                      onClick={() => setDepositOpen(false)}
                    >
                      Отмена
                    </button>
                    <button
                      className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium hover:bg-emerald-500 disabled:opacity-60"
                      onClick={createManualDeposit}
                      disabled={loading}
                    >
                      Я оплатил
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}