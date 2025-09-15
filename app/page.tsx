"use client";

import { useEffect, useMemo, useState, useRef } from "react";

declare global { interface Window { Telegram?: any } }
type TUser = { id: number; first_name?: string; username?: string };
type PendingDeposit = { id: string; userId: number; amount: number; createdAt: number; status: string };

function getInitData(): string {
  if (typeof window === "undefined") return "";
  const tg = window.Telegram?.WebApp;
  if (tg?.initData) return tg.initData;

  const url = new URL(window.location.href);
  const fromHash = (url.hash || "").match(/tgWebAppData=([^&]+)/)?.[1];
  if (fromHash) return decodeURIComponent(fromHash);

  const fromQuery = url.searchParams.get("tgWebAppData");
  if (fromQuery) return decodeURIComponent(fromQuery);

  return "";
}

export default function Home() {
  // ---- Auth
  const [user, setUser] = useState<TUser | null>(null);
  const [balance, setBalance] = useState<number>(0);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const initData = useMemo(() => getInitData(), []);
  const pollingRef = useRef<number | null>(null);

  // ---- Game state
  const [amount, setAmount] = useState<number>(100);
  const [chance, setChance] = useState<number>(50);
  const [dir, setDir] = useState<"under" | "over">("under");
  const [coef, setCoef] = useState<number>(0);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<any[]>([]);

  // ---- Deposit
  const [depositOpen, setDepositOpen] = useState(false);
  const [depositAmt, setDepositAmt] = useState<number>(500);

  // ---- Admin
  const [pending, setPending] = useState<PendingDeposit[]>([]);
  const isAdmin = useMemo(() => {
    const ids = (process.env.NEXT_PUBLIC_ADMIN_IDS ?? "")
      .split(",")
      .map(s => Number(s.trim()))
      .filter(Boolean);
    return !!user && ids.includes(user.id);
  }, [user]);

  // ====== helpers ======
  async function postJSON<T=any>(url: string, body: any): Promise<T> {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return r.json();
  }

  async function fetchMeAndBalance() {
    // новый эндпоинт — всегда возвращает актуальный баланс
    const data = await postJSON("/api/user/me", { initData });
    if (data?.ok) {
      if (data.user) setUser(data.user as TUser);
      if (typeof data.balance === "number") setBalance(data.balance);
    } else if (data?.error) {
      setAuthError(data.error);
    }
  }

  // ====== init ======
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    tg?.ready?.();
    tg?.expand?.();

    (async () => {
      try {
        // 1) auth
        const auth = await postJSON("/api/auth", { initData }); // твой текущий эндпоинт
        if (auth?.ok && auth?.user) {
          setUser(auth.user as TUser);
        } else {
          setAuthError(auth?.error || "auth_failed");
        }
        // 2) баланс
        await fetchMeAndBalance();
      } catch {
        setAuthError("network_error");
      } finally {
        setAuthLoading(false);
      }
    })();

    // фоновый опрос баланса (и на случай подтверждения депозита без перезагрузки)
    pollingRef.current = window.setInterval(() => {
      fetchMeAndBalance().catch(() => {});
    }, 10_000);

    return () => {
      if (pollingRef.current) window.clearInterval(pollingRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initData]);

  // коэффициент
  useEffect(() => {
    const edgeBp = Number(process.env.NEXT_PUBLIC_HOUSE_EDGE_BP ?? 150);
    const edge = (10000 - edgeBp) / 10000;
    const fair = 100 / Math.max(1, Math.min(95, chance));
    setCoef(parseFloat((fair * edge).toFixed(4)));
  }, [chance]);

  // ====== actions ======
  async function place() {
    if (!user) return;
    if (amount < 1) return;
    if (amount > balance) {
      alert("Недостаточно средств");
      return;
    }
    setBusy(true);
    try {
      const data = await postJSON("/api/bet", { initData, amount, chance, dir });
      if (data.ok) {
        if (typeof data.balance === "number") setBalance(data.balance);
        setLog(prev => [data.bet, ...prev].slice(0, 30));
      } else {
        alert(data.error || "Ошибка");
      }
    } catch {
      alert("Сеть/сервер недоступен");
    } finally {
      setBusy(false);
    }
  }

  function openDeposit() { setDepositOpen(true); setDepositAmt(500); }
  function closeDeposit() { setDepositOpen(false); }
  async function submitDeposit() {
    try {
      const data = await postJSON("/api/deposit/create", { initData, amount: depositAmt });
      if (data.ok) {
        alert("Заявка на пополнение отправлена. После подтверждения администратором средства поступят на баланс.");
        setDepositOpen(false);
        // через пару секунд подёргаем баланс (на случай очень быстрого апрува)
        setTimeout(() => fetchMeAndBalance().catch(() => {}), 3_000);
      } else {
        alert(data.error || "Не удалось создать заявку");
      }
    } catch {
      alert("Сеть/сервер недоступен");
    }
  }

  async function refreshPending() {
    const data = await postJSON("/api/deposit/pending", { initData });
    if (data.ok) setPending(data.pending as PendingDeposit[]);
    else alert(data.error || "Ошибка загрузки");
  }
  async function actPending(id: string, action: "approve" | "decline") {
    const data = await postJSON("/api/deposit/approve", { initData, requestId: id, action });
    if (data.ok) {
      alert(`Заявка ${action === "approve" ? "подтверждена" : "отклонена"}`);
      await refreshPending();
      await fetchMeAndBalance();
    } else {
      alert(data.error || "Ошибка");
    }
  }
  useEffect(() => { if (isAdmin) refreshPending(); /* eslint-disable-next-line */ }, [isAdmin]);

  // ===== DEMO feed (помеченная лента) =====
  const demoFeedOn = String(process.env.NEXT_PUBLIC_DEMO_FEED ?? "") === "1";
  const [demo, setDemo] = useState<any[]>([]);
  useEffect(() => {
    if (!demoFeedOn) return;
    const int = setInterval(() => {
      const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const val = Math.floor(Math.random() * 1_000_000);
      const win = Math.random() < 0.48;
      const amt = [50, 100, 200, 500, 1000, 2500][Math.floor(Math.random() * 6)];
      const ch = [10, 25, 50, 70, 90][Math.floor(Math.random() * 5)];
      setDemo(prev => [{
        id,
        outcome: {
          value: val,
          win,
          coef: +(100 / ch * 0.985).toFixed(2),
          payout: win ? Math.floor(amt * (100 / ch * 0.985)) : 0
        }
      }, ...prev].slice(0, 50));
    }, 2000);
    return () => clearInterval(int);
  }, [demoFeedOn]);

  // ===== gates =====
  if (authLoading) {
    return <main className="center"><div className="card"><div className="h2">Подключение к Telegram…</div></div></main>;
  }
  if (!user) {
    return <main className="center"><div className="card">
      <div className="h2">Откройте через Telegram</div>
      <div className="sub">Это мини-приложение запускается из бота {process.env.NEXT_PUBLIC_BOT_NAME ?? ""}.</div>
      {authError && <div className="warn">Ошибка: {authError}</div>}
    </div></main>;
  }

  // ===== UI =====
  return (
    <div className="container fade-in">
      <header className="row header">
        <div>
          <div className="h1">Nvuti-style</div>
          <div className="sub">Проведённая честность • WebApp {process.env.NEXT_PUBLIC_BOT_NAME ?? ""}</div>
        </div>
        <div className="row gap8">
          <span className="badge">UID: {user?.id}</span>
          <span className="badge">Баланс: <b className="k">{balance} ₽</b></span>
          <button className="btn-outline" onClick={openDeposit}>Пополнить</button>
        </div>
      </header>

      <main className="grid">
        <section className="card lift">
          <label htmlFor="betAmount" className="label">Сумма ставки (1–10 000 ₽)</label>
          <input
            id="betAmount" name="betAmount"
            className="input"
            type="number" min={1} max={10000}
            value={amount}
            onChange={(e) => setAmount(Math.max(1, Math.min(10000, parseInt(e.target.value || "0", 10))))}
          />

          <div className="row gap8 wrap">
            {[100, 500, 1000].map(v => (
              <button key={`chip_${v}`} className="chip" onClick={() => setAmount(v)}>{v} ₽</button>
            ))}
          </div>

          <div className="row between">
            <div>
              <label htmlFor="chance" className="label">Шанс (1–95%)</label>
              <input
                id="chance" name="chance"
                className="slider"
                type="range" min={1} max={95}
                value={chance}
                onChange={(e) => setChance(parseInt(e.target.value, 10))}
              />
            </div>
            <div className="badge">{chance}%</div>
          </div>

          <div className="row gap8">
            <button className="btn-outline" onClick={() => setDir("under")} disabled={dir === "under"}>Меньше</button>
            <button className="btn-outline" onClick={() => setDir("over")} disabled={dir === "over"}>Больше</button>
          </div>

          <div className="row between">
            <div className="sub">Коэффициент: <b className="k">×{coef}</b></div>
            <div className="sub">Потенц. выплата: <b className="k">{Math.floor(amount * coef)} ₽</b></div>
          </div>

          <div>
            <button className="btn pulse" onClick={place} disabled={busy || amount > balance}>
              {amount > balance ? "Недостаточно средств" : "Сделать ставку"}
            </button>
          </div>
        </section>

        <section className="card">
          <div className="row between">
            <b>Последние раунды</b>
            <a className="sub" href="#" onClick={(e) => { e.preventDefault(); alert("Опубликуйте старые serverSeed для проверки."); }}>
              Проверка честности
            </a>
          </div>
          <ul className="list">
            {log.slice(0, 10).map((b: any, i) => (
              <li key={`bet_${b?.id ?? i}`}>
                <span className="k">{String(b?.outcome?.value ?? 0).padStart(6, "0")}</span> — {b?.dir === "under" ? "меньше" : "больше"} при {b?.chance}% →
                {" "}{b?.outcome?.win ? "победа" : "проигрыш"}; выплата <b className="k">{b?.outcome?.payout ?? 0}</b>
                <div className="sub">coef ×{b?.outcome?.coef} • commit {(b?.outcome?.proof?.serverSeedHash ?? "").slice(0, 10)}… • nonce {b?.nonce}</div>
              </li>
            ))}
          </ul>
        </section>

        {isAdmin && (
          <section className="card">
            <div className="row between"><b>Админ • Пополнения</b><button className="btn-outline" onClick={refreshPending}>Обновить</button></div>
            {pending.length === 0 ? <div className="sub">Ожидающих заявок нет.</div> : (
              <ul className="list">
                {pending.map(p => (
                  <li key={`dep_${p.id}`} className="row between wrap">
                    <span>#{p.id.slice(-6)} • user {p.userId} • {p.amount} ₽ • {new Date(p.createdAt).toLocaleString()}</span>
                    <span className="row gap8">
                      <button className="chip ok" onClick={() => actPending(p.id, "approve")}>Подтвердить</button>
                      <button className="chip warn" onClick={() => actPending(p.id, "decline")}>Отклонить</button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </main>

      {/* ДЕМО-лента активности (включается переменной NEXT_PUBLIC_DEMO_FEED=1) */}
      {demoFeedOn && (
        <section className="demo">
          <div className="demo-title">Лента активности</div>
          <div className="ticker">
            <div>
              {demo.concat(demo).slice(0, 40).map((b: any, i: number) => (
                <span key={`demo_${b.id}_${i}`} style={{ marginRight: 24 }}>
                  #{String(b.id).slice(-6)} • <span className="k">{String(b?.outcome?.value ?? 0).padStart(6, "0")}</span> → {b?.outcome?.win ? "✔" : "✖"}
                </span>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Модал пополнения */}
      {depositOpen && (
        <div className="overlay" onClick={closeDeposit}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="h2">Пополнение баланса</div>

            <label htmlFor="depAmount" className="label">Сумма</label>
            <input
              id="depAmount" name="depAmount"
              className="input" type="number" min={1}
              value={depositAmt}
              onChange={(e) => setDepositAmt(Math.max(1, parseInt(e.target.value || "0", 10)))}
            />

            <div className="info">
              Реквизиты для перевода:<br />
              <b>{process.env.NEXT_PUBLIC_DEPOSIT_DETAILS ?? "Укажите NEXT_PUBLIC_DEPOSIT_DETAILS"}</b>
              <div className="sub">После оплаты нажмите «Я оплатил» — заявка уйдёт администратору на подтверждение.</div>
            </div>
            <div className="row gap8">
              <button className="btn-outline" onClick={closeDeposit}>Отмена</button>
              <button className="btn" onClick={submitDeposit}>Я оплатил</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}