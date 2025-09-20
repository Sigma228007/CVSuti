"use client";
import React, { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

const ALLOW_OUTSIDE = [/^\/pay(\/|$)/i, /^\/fk(\/|$)/i];

export default function Guard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const [ready, setReady] = useState(false);
  const inTelegram = useMemo(() => {
    try { return Boolean((window as any)?.Telegram?.WebApp?.initData); } catch { return false; }
  }, []);

  useEffect(() => {
    // если реально запущены в Telegram — навсегда помечаем устройство как «пропущенное»
    if (inTelegram) {
      try { localStorage.setItem("tg_authed_once", "1"); } catch {}
    }
    setReady(true);
  }, [inTelegram]);

  const allowedByPath = ALLOW_OUTSIDE.some((re) => re.test(pathname));
  let authedOnce = false;
  try { authedOnce = localStorage.getItem("tg_authed_once") === "1"; } catch {}

  if (!ready) return null;

  if (inTelegram || authedOnce || allowedByPath) {
    return <>{children}</>;
  }

  return (
    <main className="center">
      <div className="card">
        <div className="h2">Доступ только через Telegram</div>
        <div className="sub" style={{ marginTop: 6 }}>
          Открой мини-приложение через нашего бота. После первого входа ограничения снимаются, чтобы не мешать оплате.
        </div>
      </div>
    </main>
  );
}