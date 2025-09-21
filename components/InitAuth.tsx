"use client";

import { useEffect } from "react";

function extractInitData(): string | null {
  if (typeof window === "undefined") return null;
  // 1) Из Telegram.WebApp
  const tg = (window as any).Telegram?.WebApp;
  if (tg?.initData && typeof tg.initData === "string" && tg.initData.length > 0) {
    try { tg.expand?.(); tg.ready?.(); } catch {}
    return tg.initData;
  }
  // 2) Из hash (#tgWebAppData=...)
  const m = window.location.hash.match(/tgWebAppData=([^&]+)/);
  if (m) return decodeURIComponent(m[1]);
  return null;
}

export default function InitAuth() {
  useEffect(() => {
    let cancelled = false;

    (async () => {
      // если уже создавали сессию этим устройством — не спамим
      if (document.cookie.includes("sid=")) return;

      const initData = extractInitData();

      // 1) обычный кейс — Telegram
      if (initData) {
        try {
          const r = await fetch("/api/auth", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ initData }),
          });
          if (!r.ok) throw new Error(await r.text());
          return;
        } catch {
          // игнор, покажет Guard
        }
      }

      // 2) локальный демо-режим (по желанию разработчика)
      const DEMO = false; // можно переключить на true только для локальных тестов
      if (DEMO) {
        const uid = Number(localStorage.getItem("gs-demo-uid") || 100001);
        localStorage.setItem("gs-demo-uid", String(uid));
        try {
          await fetch("/api/auth", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ demo: true, uid }),
          });
        } catch {}
      }
    })();

    return () => { cancelled = true; };
  }, []);

  return null;
}