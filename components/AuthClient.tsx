"use client";
import React, { useEffect, useState } from "react";

type AuthState = {
  ok?: boolean;
  user?: { id: number };
  balance?: number;
  requireTelegram?: boolean;
  error?: string;
};

export default function AuthClient() {
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [loading, setLoading] = useState(false);

  async function doAuth(initData?: string | null) {
    setLoading(true);
    try {
      const b = initData ? { initData } : {};
      const r = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: Object.keys(b).length ? JSON.stringify(b) : undefined,
      });
      const j = await r.json();
      setAuth(j);
    } catch (e: any) {
      setAuth({ ok: false, error: e?.message || "fetch failed" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Попробуем взять initData из URL (если WebApp передаёт ?initData=...).
    const u = new URL(location.href);
    const initData = u.searchParams.get("initData") || u.searchParams.get("tgWebAppData") || null;
    doAuth(initData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refresh() {
    // повторный запрос (используем те же параметры поиска initData)
    setAuth(null);
    const u = new URL(location.href);
    const initData = u.searchParams.get("initData") || u.searchParams.get("tgWebAppData") || null;
    await doAuth(initData);
  }

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    setAuth({ ok: false });
    // перезагрузим страницу, чтобы сбросить состояние UI
    location.reload();
  }

  if (loading) return <div>Loading...</div>;

  if (!auth) return <div>Идёт авторизация...</div>;

  if (auth.requireTelegram) {
    return (
      <div>
        <div style={{ color: "orange" }}>
          Для первого входа откройте мини-приложение через Telegram (через бота). После входа пополнение будет доступно.
        </div>
        <div style={{ marginTop: 8 }}>
          <button onClick={() => {
            // подсказка: если есть NEXT_PUBLIC_BASE_URL в env, можно открыть ссылку на мини-приложение
            const bot = process.env.NEXT_PUBLIC_BOT_LINK;
            window.open(bot, "_blank");
          }}>Открыть бота (Telegram)</button>
        </div>
      </div>
    );
  }

  if (!auth.ok) {
    return <div style={{ color: "red" }}>Ошибка авторизации: {auth.error || "unknown"} <button onClick={refresh}>Попробовать снова</button></div>;
  }

  return (
    <div>
      <div>UID: {auth.user?.id ?? "—"}</div>
      <div>Баланс: {typeof auth.balance === "number" ? `${auth.balance.toFixed(2)} ₽` : "—"}</div>
      <div style={{ marginTop: 8 }}>
        <button onClick={refresh}>Обновить</button>{" "}
        <button onClick={logout}>Выйти</button>
      </div>
    </div>
  );
}