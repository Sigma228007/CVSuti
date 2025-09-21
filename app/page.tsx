"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

/** Универсальное получение initData */
function getInitData(): string {
  try {
    // 1) через Telegram WebApp
    // @ts-ignore
    const tg = window?.Telegram?.WebApp;
    if (tg?.initData && tg.initData.length > 10) return tg.initData as string;
  } catch {}

  try {
    // 2) через query string (разные варианты ключа)
    const p = new URLSearchParams(window.location.search);
    const fromUrl =
      p.get("tgWebAppData") ||
      p.get("initData") ||
      p.get("initdata") ||
      p.get("init_data");
    if (fromUrl && fromUrl.length > 10) return fromUrl;
  } catch {}

  try {
    // 3) fallback — localStorage
    const stored = localStorage.getItem("tg_init_data");
    if (stored && stored.length > 10) return stored;
  } catch {}

  return "";
}

function formatRubKop(n: number) {
  const rub = Number.isFinite(n) ? Number(n) : 0;
  return rub.toFixed(2).replace(".", ",") + " ₽";
}

export default function Page() {
  const router = useRouter();

  // ======= STATE =======
  const [balance, setBalance] = useState<number>(0);
  const [balLoading, setBalLoading] = useState(true);

  const [amount, setAmount] = useState<number>(100);
  const [chance, setChance] = useState<number>(50);
  const [dir, setDir] = useState<"over" | "under">("over");
  const [betLoading, setBetLoading] = useState(false);

  const [showDeposit, setShowDeposit] = useState(false);
  const [depAmount, setDepAmount] = useState<number>(500);
  const [waitingPayment, setWaitingPayment] = useState(false);
  const [showAfterPayBanner, setShowAfterPayBanner] = useState(false);

  const [showWithdraw, setShowWithdraw] = useState(false);
  const [wdAmount, setWdAmount] = useState<number>(500);
  const [wdDetails, setWdDetails] = useState<string>("");

  const [activity, setActivity] = useState<string[]>([]);
  const [online, setOnline] = useState<number>(Math.floor(25 + Math.random() * 60));

  const initData = useMemo(() => {
    const d = getInitData();
    if (d) {
      try {
        localStorage.setItem("tg_init_data", d); // сохраним для последующих входов
      } catch {}
    }
    return d;
  }, []);

  // ======= FETCH BALANCE =======
  async function loadBalance() {
    setBalLoading(true);
    try {
      const res = await fetch(`/api/balance?ts=${Date.now()}`, {
        method: "GET",
        headers: { "X-Init-Data": initData },
        cache: "no-store",
      });
      const j = await res.json();
      if (res.ok && j?.ok) {
        setBalance(Number(j.balance || 0));
      }
    } catch {}
    setBalLoading(false);
  }

  useEffect(() => {
    loadBalance();

    // мягкая имитация онлайна
    const t = setInterval(() => {
      setOnline((o) => {
        const delta = Math.floor(Math.random() * 5) - 2;
        return Math.max(25, Math.min(100, o + delta));
      });
    }, 5000);

    // лента активности
    const names = ["@neo", "@kira", "@maxx", "@ivan", "@nazar", "@vika", "@mila", "@lev", "@fox"];
    const tick = setInterval(() => {
      const name = names[Math.floor(Math.random() * names.length)];
      const a = 10 + Math.floor(Math.random() * 990);
      const ch = 1 + Math.floor(Math.random() * 95);
      const d = Math.random() > 0.5 ? "over" : "under";
      const win = Math.random() > 0.55;
      setActivity((prev) => {
        const row = `${name} • ставка ${a}₽ • шанс ${ch}% • ${
          d === "over" ? "больше" : "меньше"
        } • ${win ? "выигрыш" : "проигрыш"}`;
        const arr = [row, ...prev];
        if (arr.length > 15) arr.pop();
        return arr;
      });
    }, 3800);

    return () => {
      clearInterval(t);
      clearInterval(tick);
    };
  }, [initData]);

  // ======= UI =======
  return (
    <main className="container">
      <div className="header row between">
        <div>
          <div className="h1">🎲 GVSuti</div>
          <div className="sub">Онлайн игроков: {online}</div>
        </div>
        <div>
          <span className="badge">
            Баланс: {balLoading ? "…" : formatRubKop(balance)}
          </span>
        </div>
      </div>

      <div className="card">
        <div className="h2">Сделать ставку</div>
        <div className="row gap8 wrap">
          <input
            type="number"
            className="input"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
          />
          <button className="chip" onClick={() => setAmount(100)}>100</button>
          <button className="chip" onClick={() => setAmount(500)}>500</button>
          <button className="chip" onClick={() => setAmount(1000)}>1000</button>
        </div>

        <div className="label">Шанс (%): {chance}</div>
        <input
          type="range"
          min={1}
          max={95}
          value={chance}
          onChange={(e) => setChance(Number(e.target.value))}
          className="slider"
        />

        <div className="row gap8" style={{ marginTop: 12 }}>
          <button className="btn" disabled={betLoading}>
            Больше
          </button>
          <button className="btn-outline" disabled={betLoading}>
            Меньше
          </button>
        </div>
      </div>

      <div className="card demo">
        <div className="demo-title">🎯 Лента активности</div>
        <div className="ticker">
          <div>{activity.join(" • ")}</div>
        </div>
      </div>

      <div className="row gap8" style={{ marginTop: 16 }}>
        <button className="btn" onClick={() => setShowDeposit(true)}>
          Пополнить
        </button>
        <button className="btn-outline" onClick={() => setShowWithdraw(true)}>
          Вывести
        </button>
        <button className="btn-outline" onClick={() => router.push("/profile")}>
          Профиль
        </button>
      </div>

      {showDeposit && (
        <div className="overlay">
          <div className="modal">
            <div className="h2">Пополнение</div>
            <input
              type="number"
              className="input"
              value={depAmount}
              onChange={(e) => setDepAmount(Number(e.target.value))}
            />
            <button className="btn" style={{ marginTop: 12 }}>
              Оплатить
            </button>
            <button
              className="btn-outline"
              style={{ marginTop: 8 }}
              onClick={() => setShowDeposit(false)}
            >
              Закрыть
            </button>
          </div>
        </div>
      )}

      {showWithdraw && (
        <div className="overlay">
          <div className="modal">
            <div className="h2">Вывод</div>
            <input
              type="number"
              className="input"
              value={wdAmount}
              onChange={(e) => setWdAmount(Number(e.target.value))}
            />
            <input
              type="text"
              className="input"
              placeholder="Реквизиты"
              value={wdDetails}
              onChange={(e) => setWdDetails(e.target.value)}
            />
            <button className="btn" style={{ marginTop: 12 }}>
              Отправить заявку
            </button>
            <button
              className="btn-outline"
              style={{ marginTop: 8 }}
              onClick={() => setShowWithdraw(false)}
            >
              Закрыть
            </button>
          </div>
        </div>
      )}

      {showAfterPayBanner && (
        <div className="overlay">
          <div className="modal">
            <div className="h2">✅ Оплата прошла</div>
            <div className="sub">Пожалуйста, перезапустите бота для обновления баланса</div>
            <button
              className="btn"
              style={{ marginTop: 12 }}
              onClick={() => setShowAfterPayBanner(false)}
            >
              Ок
            </button>
          </div>
        </div>
      )}
    </main>
  );
}