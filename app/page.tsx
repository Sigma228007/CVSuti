"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

// получаем initData из Telegram (или из query), как у тебя в lib/webapp.ts
function getInitData(): string {
  try {
    // @ts-ignore
    const tg = window?.Telegram?.WebApp;
    if (tg?.initData) return tg.initData as string;
  } catch {}
  try {
    const p = new URLSearchParams(window.location.search);
    return (
      p.get("tgWebAppData") ||
      p.get("initData") ||
      p.get("initdata") ||
      p.get("init_data") ||
      ""
    );
  } catch {}
  return "";
}

function formatRubKop(n: number) {
  // бек обычно хранит целые рубли; покажем .00, чтобы видны «копейки»
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

  const initData = useMemo(() => getInitData(), []);

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
      } else {
        // если зашли напрямую в браузер — баланс не отдадут, это норм
      }
    } catch {}
    setBalLoading(false);
  }

  useEffect(() => {
    loadBalance();
    // мягкая имитация онлайна
    const t = setInterval(() => {
      setOnline((o) => {
        const delta = Math.floor(Math.random() * 5) - 2; // -2..+2
        const next = Math.max(25, Math.min(100, o + delta));
        return next;
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
        const row = `${name} • ставка ${a}₽ • шанс ${ch}% • ${d === "over" ? "больше" : "меньше"} • ${win ? "выигрыш" : "проигрыш"}`;
        const arr = [row, ...prev];
        if (arr.length > 15) arr.pop();
        return arr;
      });
    }, 3800);

    return () => { clearInterval(t); clearInterval(tick); };
  }, [initData]);

  // ======= BET =======
  async function placeBet() {
    setBetLoading(true);
    try {
      const res = await fetch("/api/bet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData, amount, chance, dir }),
      });
      const j = await res.json();
      if (!res.ok || !j?.ok) {
        alert("Ошибка ставки: " + (j?.error || res.status));
        return;
      }
      setBalance(Number(j.balance || 0));
    } catch (e: any) {
      alert("Сеть: " + (e?.message || e));
    } finally {
      setBetLoading(false);
    }
  }

  // ======= DEPOSIT (FK) =======
  async function startDeposit() {
    try {
      const res = await fetch("/api/pay/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData, amount: depAmount }),
      });
      const j = await res.json();
      if (!res.ok || !j?.ok || !j?.url) {
        alert("Ошибка создания оплаты: " + (j?.error || res.status));
        return;
      }

      // Оставляем внутри аппки «Ожидание оплаты»
      setWaitingPayment(true);
      setShowDeposit(false);

      // Открываем ссылку в внешнем браузере
      try {
        const tg = (window as any)?.Telegram?.WebApp;
        if (tg?.openLink) {
          tg.openLink(j.url, { try_instant_view: false });
        } else {
          window.open(j.url, "_blank", "noopener,noreferrer");
        }
      } catch {
        window.open(j.url, "_blank", "noopener,noreferrer");
      }

      // Через 2–3 сек покажем баннер «оплата зачислена — перезапустите бота»
      // (автообновление баланса намеренно не делаем)
      setTimeout(() => setShowAfterPayBanner(true), 2500);
    } catch (e: any) {
      alert("Сеть: " + (e?.message || e));
    }
  }

  // ======= WITHDRAW =======
  async function startWithdraw() {
    try {
      const res = await fetch("/api/withdraw/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData, amount: wdAmount, details: wdDetails }),
      });
      const j = await res.json();
      if (!res.ok || !j?.ok) {
        alert("Ошибка вывода: " + (j?.error || res.status));
        return;
      }
      alert("Заявка на вывод создана. Статус можно смотреть в профиле.");
      setShowWithdraw(false);
    } catch (e: any) {
      alert("Сеть: " + (e?.message || e));
    }
  }

  return (
    <main className="container">
      <header className="row between header">
        <div className="h1">GVSuti</div>
        <div className="badge">онлайн: {online}</div>
      </header>

      {/* Баланс */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="row between wrap">
          <div>
            <div className="sub">Ваш баланс</div>
            <div className="h2">{balLoading ? "…" : formatRubKop(balance)}</div>
            <div className="sub" style={{ marginTop: 2 }}>
              UID:{" "}
              <span className="k">
                {/* просто визуальная заглушка, можно хранить в state после /api/user/me */}
                {(initData && /"id"\s*:\s*(\d+)/.exec(initData)?.[1]) || "—"}
              </span>
            </div>
          </div>
          <div className="row gap8">
            <button className="btn" onClick={() => setShowDeposit(true)}>Пополнить</button>
            <button className="btn-outline" onClick={() => setShowWithdraw(true)}>Вывести</button>
            <button className="btn-outline" onClick={() => router.push("/profile")}>Профиль</button>
          </div>
        </div>

        {showAfterPayBanner && (
          <div className="info fade-in" style={{ marginTop: 10 }}>
            ✅ Платёж зачислен (если оплата была успешной). <br />
            <b>Перезапустите мини-приложение</b>, чтобы обновить баланс.
          </div>
        )}

        {waitingPayment && (
          <div className="info fade-in" style={{ marginTop: 10 }}>
            ⏳ Ожидаем оплату в кассе… Эту страницу можно не закрывать.
          </div>
        )}
      </div>

      {/* Игра */}
      <div className="grid">
        <div className="card">
          <div className="h2">Сделать ставку</div>
          <div className="label">Сумма</div>
          <div className="row gap8 wrap">
            <input
              className="input"
              type="number"
              min={1}
              max={10000}
              value={amount}
              onChange={(e) => setAmount(Math.max(1, Math.min(10000, Number(e.target.value || 0))))}
              style={{ width: 140 }}
            />
            <div className="row gap8">
              {[100, 500, 1000].map((v) => (
                <button key={v} className="chip" onClick={() => setAmount(v)}>{v}</button>
              ))}
            </div>
          </div>

          <div className="label">Шанс (1–95%)</div>
          <input
            className="slider"
            type="range"
            min={1}
            max={95}
            value={chance}
            onChange={(e) => setChance(Number(e.target.value))}
          />
          <div className="row between sub" style={{ marginTop: 6 }}>
            <span>Шанс: <b className="k">{chance}%</b></span>
            <span>Режим:{" "}
              <span className="chip" onClick={() => setDir(dir === "over" ? "under" : "over")}>
                {dir === "over" ? "Больше" : "Меньше"}
              </span>
            </span>
          </div>

          <div style={{ marginTop: 12 }}>
            <button className="btn" disabled={betLoading} onClick={placeBet}>
              {betLoading ? "Ставим…" : "Сделать ставку"}
            </button>
          </div>
        </div>

        {/* Лента активности */}
        <div className="card">
          <div className="h2">Активность</div>
          <ul className="list">
            {activity.map((row, i) => (
              <li key={i} className="sub">{row}</li>
            ))}
            {activity.length === 0 && <li className="sub">Ждём первых ставок…</li>}
          </ul>
          <div className="ticker">
            <div>GVSuti • честные ставки • provably fair • NVUTI-стиль • выигрыши каждые секунды • </div>
          </div>
        </div>
      </div>

      {/* Модалка «Пополнить» */}
      {showDeposit && (
        <div className="overlay" onClick={() => setShowDeposit(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="h2">Пополнение через FreeKassa</div>
            <div className="label">Сумма</div>
            <input
              className="input"
              type="number"
              min={1}
              value={depAmount}
              onChange={(e) => setDepAmount(Math.max(1, Number(e.target.value || 0)))}
            />
            <div className="sub" style={{ marginTop: 8 }}>
              Откроется внешняя страница оплаты. После успешной оплаты вернитесь в Telegram.
            </div>
            <div className="row gap8" style={{ marginTop: 12 }}>
              <button className="btn" onClick={startDeposit}>Оплатить</button>
              <button className="btn-outline" onClick={() => setShowDeposit(false)}>Закрыть</button>
            </div>
          </div>
        </div>
      )}

      {/* Модалка «Вывести» */}
      {showWithdraw && (
        <div className="overlay" onClick={() => setShowWithdraw(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="h2">Заявка на вывод</div>
            <div className="label">Сумма</div>
            <input
              className="input"
              type="number"
              min={1}
              value={wdAmount}
              onChange={(e) => setWdAmount(Math.max(1, Number(e.target.value || 0)))}
            />
            <div className="label">Реквизиты (карта/кошелёк)</div>
            <input
              className="input"
              placeholder="Например: 2200 **** **** 1234, Иванов И.И."
              value={wdDetails}
              onChange={(e) => setWdDetails(e.target.value)}
            />
            <div className="row gap8" style={{ marginTop: 12 }}>
              <button className="btn" onClick={startWithdraw}>Отправить</button>
              <button className="btn-outline" onClick={() => setShowWithdraw(false)}>Закрыть</button>
            </div>
            <div className="sub" style={{ marginTop: 8 }}>
              Заявка уйдёт администратору. Статус смотри в профиле.
            </div>
          </div>
        </div>
      )}
    </main>
  );
}