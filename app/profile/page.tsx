"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type HistDeposit = { id: string; amount: number; status: string; ts?: number; provider?: string };
type HistWithdraw = { id: string; amount: number; status: string; ts?: number; details?: any };
type UserHistory = {
  deposits: HistDeposit[];
  withdrawals: HistWithdraw[];
  pending: (HistDeposit | HistWithdraw)[];
  totals?: { dep: number; wd: number; net: number; games?: number; wins?: number };
};

function getInitData(): string {
  try {
    // @ts-ignore
    const tg = window?.Telegram?.WebApp;
    if (tg?.initData) return tg.initData as string;
  } catch {}
  try {
    const p = new URLSearchParams(window.location.search);
    return p.get("tgWebAppData") || p.get("initData") || "";
  } catch {}
  return "";
}

function formatRub(n: number) {
  return Number(n || 0).toFixed(2).replace(".", ",") + " ₽";
}

export default function ProfilePage() {
  const router = useRouter();
  const initData = useMemo(() => getInitData(), []);
  const [tab, setTab] = useState<"dep" | "wd" | "pend">("dep");
  const [hist, setHist] = useState<UserHistory | null>(null);

  async function loadHist() {
    try {
      const res = await fetch(`/api/user/history?ts=${Date.now()}`, {
        headers: { "X-Init-Data": initData },
        cache: "no-store",
      });
      const j = await res.json();
      if (res.ok && j?.ok) setHist(j);
    } catch {}
  }

  useEffect(() => {
    loadHist();
    const t = setInterval(loadHist, 5000);
    return () => clearInterval(t);
  }, [initData]);

  const list = tab === "dep" ? hist?.deposits : tab === "wd" ? hist?.withdrawals : hist?.pending;

  return (
    <main className="container">
      <div className="row between header">
        <div className="h1">Профиль</div>
        <button className="btn-outline" onClick={() => router.push("/")}>На главную</button>
      </div>

      <div className="grid">
        <div className="card">
          <div className="h2">Статистика</div>
          <ul className="list">
            <li className="row between"><span className="sub">Всего пополнено</span><b>{formatRub(hist?.totals?.dep || 0)}</b></li>
            <li className="row between"><span className="sub">Всего выведено</span><b>{formatRub(hist?.totals?.wd || 0)}</b></li>
            <li className="row between"><span className="sub">Чистый результат</span><b>{formatRub(hist?.totals?.net || 0)}</b></li>
            <li className="row between"><span className="sub">Сыграно игр</span><b>{hist?.totals?.games ?? 0}</b></li>
            <li className="row between"><span className="sub">Побед</span><b>{hist?.totals?.wins ?? 0}</b></li>
          </ul>
        </div>

        <div className="card">
          <div className="row gap8" style={{ marginBottom: 10 }}>
            <button className={`chip ${tab === "dep" ? "ok" : ""}`} onClick={() => setTab("dep")}>Пополнения</button>
            <button className={`chip ${tab === "wd" ? "ok" : ""}`} onClick={() => setTab("wd")}>Выводы</button>
            <button className={`chip ${tab === "pend" ? "ok" : ""}`} onClick={() => setTab("pend")}>Ожидают</button>
          </div>

          <ul className="list">
            {(!list || list.length === 0) && <li className="sub">Пока пусто.</li>}
            {list?.map((r: any) => (
              <li key={r.id} className="row between">
                <div className="sub">
                  <div><b>{r.id}</b></div>
                  <div style={{ opacity: 0.8 }}>
                    {("provider" in r && r.provider) ? `Источник: ${r.provider}` : null}
                    {("details" in r && r.details) ? `Реквизиты: ${typeof r.details === "string" ? r.details : JSON.stringify(r.details)}` : null}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div><b>{formatRub(r.amount || 0)}</b></div>
                  <div className={`chip ${r.status === "approved" ? "ok" : r.status === "pending" ? "" : "warn"}`}>{r.status}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div className="h2">Поддержка</div>
        <div className="sub">Напиши админу: <a href={`https://t.me/${(process.env.NEXT_PUBLIC_BOT_NAME || "").replace("@","")}`} target="_blank">через бота</a></div>
      </div>
    </main>
  );
}