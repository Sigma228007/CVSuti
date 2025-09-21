"use client";

import { useEffect, useState, useCallback } from "react";
import InitAuth from "@/components/InitAuth";

type BalanceResp = {
  ok: boolean;
  uid?: number;
  balance?: number;
  error?: string;
};

export default function Page() {
  const [uid, setUid] = useState<number | null>(null);
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const loadBalance = useCallback(async () => {
    setErr(null);
    try {
      const r = await fetch(`/api/balance?ts=${Date.now()}`, {
        credentials: "include",
      });
      const j: BalanceResp = await r.json();
      if (!j.ok) {
        setErr(j.error || "Не удалось получить баланс");
      }
      if (typeof j.uid === "number") setUid(j.uid);
      if (typeof j.balance === "number") setBalance(j.balance);
    } catch (e: any) {
      setErr(e?.message || "Ошибка соединения");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBalance();
    // лёгкий автопуллинг раз в 15 сек, чтобы не мешать логике оплаты
    const t = setInterval(loadBalance, 15000);
    return () => clearInterval(t);
  }, [loadBalance]);

  return (
    <main className="min-h-screen bg-[#0b0f14] text-white">
      {/* Мягкая авторизация сразу после монтирования */}
      <InitAuth />

      <div className="mx-auto max-w-4xl px-4 py-6">
        {/* Шапка/статус */}
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">GVSuti</h1>
            <p className="text-xs opacity-70">честные ставки • provably fair</p>
          </div>

          <div className="rounded-2xl bg-[#10151c] px-4 py-3 shadow">
            <div className="text-xs opacity-70">Ваш баланс</div>
            <div className="text-2xl font-bold">
              {loading ? "…" : `${(balance || 0).toFixed(2)} ₽`}
            </div>
            <div className="mt-1 text-xs opacity-70">
              UID: {uid ?? "—"}
            </div>
          </div>
        </div>

        {/* Кнопки */}
        <div className="mb-6 flex flex-wrap gap-2">
          <button
            className="rounded-xl bg-gradient-to-r from-[#34e89e] to-[#0f9] px-4 py-2 font-medium text-black"
            onClick={() => {
              // здесь у тебя могла быть логика открытия модалки пополнения
              const ev = new CustomEvent("open:topup");
              window.dispatchEvent(ev);
            }}
          >
            Пополнить
          </button>

          <button
            className="rounded-xl bg-[#141a22] px-4 py-2 font-medium"
            onClick={() => {
              const ev = new CustomEvent("open:withdraw");
              window.dispatchEvent(ev);
            }}
          >
            Вывести
          </button>

          <button
            className="rounded-xl bg-[#141a22] px-4 py-2 font-medium"
            onClick={() => {
              const ev = new CustomEvent("open:profile");
              window.dispatchEvent(ev);
            }}
          >
            Профиль
          </button>

          <button
            className="rounded-xl bg-[#141a22] px-4 py-2 font-medium"
            onClick={loadBalance}
            title="Обновить баланс"
          >
            Обновить
          </button>
        </div>

        {/* Секция ставок (упрощённый каркас — твоя логика может быть сложнее) */}
        <section className="rounded-2xl bg-[#0f141b] p-4 shadow">
          <h2 className="mb-3 text-lg font-semibold">Сделать ставку</h2>

          <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto]">
            <div className="space-y-3">
              <div className="text-sm opacity-80">Сумма</div>
              <div className="flex gap-2">
                {([100, 500, 1000] as const).map((s) => (
                  <button
                    key={s}
                    className="rounded-lg bg-[#141a22] px-3 py-2 text-sm"
                    onClick={() => {
                      const ev = new CustomEvent("set:bet-amount", {
                        detail: s,
                      });
                      window.dispatchEvent(ev);
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <button
              className="rounded-xl bg-gradient-to-r from-[#6a11cb] to-[#2575fc] px-5 py-3 font-semibold"
              onClick={() => {
                const ev = new CustomEvent("action:bet");
                window.dispatchEvent(ev);
              }}
            >
              Сделать ставку
            </button>
          </div>
        </section>

        {/* Ошибки */}
        {err && (
          <div className="mt-4 rounded-lg bg-[#201a1a] px-3 py-2 text-sm text-red-300">
            {err}
          </div>
        )}

        {/* Подвал/пояснение */}
        <div className="mt-8 text-center text-xs opacity-60">
          NVUTI-стиль • выигрыши каждую секунду • лимиты 1–10 000 ₽, шанс 1–95%
        </div>
      </div>
    </main>
  );
}