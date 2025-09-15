"use client";
import { useEffect, useMemo, useState } from "react";

declare global {
  interface Window { Telegram: any }
}

type TUser = { id: number; first_name?: string; username?: string };

export default function Home() {
  // ---- state ----
  const [user, setUser] = useState<TUser | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const [balance, setBalance] = useState<number>(1000);
  const [amount, setAmount] = useState<number>(100);
  const [chance, setChance] = useState<number>(50);
  const [dir, setDir] = useState<"under" | "over">("under");
  const [coef, setCoef] = useState<number>(0);
  const [log, setLog] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  // ---- Telegram context ----
  const inTelegram = useMemo(
    () => typeof window !== "undefined" && Boolean(window.Telegram?.WebApp),
    []
  );
  const initData = useMemo(
    () => (typeof window !== "undefined" ? window.Telegram?.WebApp?.initData || "" : ""),
    []
  );

  // ---- init Telegram WebApp + auth ----
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) { tg.ready?.(); tg.expand?.(); }

    if (!inTelegram) {
      setAuthError("not_in_telegram");
      return;
    }

    (async () => {
      try {
        const r = await fetch("/api/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ initData }),
        });
        const data = await r.json();
        if (data.ok) setUser(data.user);
        else setAuthError(data.error || "auth_failed");
      } catch {
        setAuthError("network_error");
      }
    })();
  }, [inTelegram, initData]);

  // ---- recalc coef on chance change ----
  useEffect(() => {
    const edgeBp = Number(process.env.NEXT_PUBLIC_HOUSE_EDGE_BP ?? 150);
    const edge = (10000 - edgeBp) / 10000;
    const fair = 100 / Math.max(1, Math.min(95, chance));
    setCoef(parseFloat((fair * edge).toFixed(4)));
  }, [chance]);

  // ---- actions ----
  async function place() {
    if (!user || !inTelegram) return;

    setBusy(true);
    try {
      const res = await fetch("/api/bet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // ключевой момент: шлём initData, а не userId
        body: JSON.stringify({ initData, amount, chance, dir }),
      });
      const data = await res.json();
      if (data.ok) {
        setBalance(data.balance);
        setLog((prev) => [data.bet, ...prev].slice(0, 30));
      } else {
        alert(data.error || "Ошибка");
      }
    } catch (e) {
      alert("Сеть/сервер недоступен");
    } finally {
      setBusy(false);
    }
  }

  function deposit() { alert("Пополнение: подключите провайдера платежей. (заглушка)"); }
  function withdraw() { alert("Вывод: подключите провайдера платежей и KYC. (заглушка)"); }

  // ---- Gate: только Telegram ----
  if (!inTelegram || !user) {
    return (
      <main style={{display:"grid", placeItems:"center", minHeight:"100vh", padding:20}}>
        <div style={{maxWidth:420, textAlign:"center"}}>
          <h2>Откройте через Telegram</h2>
          <p>Это мини-приложение запускается из бота {process.env.NEXT_PUBLIC_BOT_NAME ?? ""}.</p>
          {authError && <p style={{color:"tomato"}}>Ошибка: {authError}</p>}
        </div>
      </main>
    );
  }

  // ---- UI ----
  return (
    <div className="container">
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
        <div>
          <div className="h1">Nvuti-style</div>
          <div className="sub">Проведённая честность • WebApp {process.env.NEXT_PUBLIC_BOT_NAME ?? ""}</div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <span className="badge">UID: {user?.id}</span>
          <span className="badge">Баланс: <b className="k">{balance} ₽</b></span>
          <button className="btn-outline" onClick={deposit}>Пополнить</button>
          <button className="btn-outline" onClick={withdraw}>Вывести</button>
        </div>
      </div>

      <div className="grid">
        <div className="card">
          <div className="label">Сумма ставки (1–10 000 ₽)</div>
          <input
            className="input"
            type="number"
            min={1}
            max={10000}
            value={amount}
            onChange={(e) => setAmount(Math.max(1, Math.min(10000, parseInt(e.target.value || "0", 10))))}
          />

          <div className="row" style={{ marginTop: 12, justifyContent: "space-between" }}>
            <div>
              <div className="label">Шанс (1–95%)</div>
              <input
                className="slider"
                type="range"
                min={1}
                max={95}
                value={chance}
                onChange={(e) => setChance(parseInt(e.target.value, 10))}
              />
            </div>
            <div className="badge">{chance}%</div>
          </div>

          <div className="row" style={{ marginTop: 12, gap: 8 }}>
            <button className="btn-outline" onClick={() => setDir("under")} disabled={dir === "under"}>Меньше</button>
            <button className="btn-outline" onClick={() => setDir("over")} disabled={dir === "over"}>Больше</button>
          </div>

          <div className="row" style={{ marginTop: 12, justifyContent: "space-between" }}>
            <div className="sub">Коэффициент: <b className="k">×{coef}</b></div>
            <div className="sub">Потенц. выплата: <b className="k">{Math.floor(amount * coef)} ₽</b></div>
          </div>

          <div style={{ marginTop: 16 }}>
            <button className="btn" onClick={place} disabled={busy}>Сделать ставку</button>
          </div>
        </div>

        <div className="card">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <b>Последние раунды</b>
            <a className="sub" href="#" onClick={(e) => { e.preventDefault(); alert("Опубликуйте старые serverSeed для проверки."); }}>
              Проверка честности
            </a>
          </div>
          <ul style={{ marginTop: 8, paddingLeft: 18 }}>
            {log.slice(0, 10).map((b: any, i) => (
              <li key={i} style={{ marginBottom: 6 }}>
                <span className="k">{b.outcome.value.toString().padStart(6, "0")}</span> — {b.dir === "under" ? "меньше" : "больше"} при {b.chance}% → {b.outcome.win ? "победа" : "проигрыш"}; выплата <b className="k">{b.outcome.payout}</b>
                <div className="sub">coef ×{b.outcome.coef} • commit {b.outcome.proof.serverSeedHash.slice(0, 10)}… • nonce {b.nonce}</div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Бегущая строка */}
      <div className="ticker">
        <div>
          {log.concat(log).slice(0, 30).map((b: any, i) => (
            <span key={i} style={{ marginRight: 24 }}>
              #{b.id.slice(-6)} • <span className="k">{b.outcome.value.toString().padStart(6, "0")}</span> → {b.outcome.win ? "✔" : ""}{!b.outcome.win ? "✖" : ""}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}