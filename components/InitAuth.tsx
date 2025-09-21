"use client";
import { useEffect } from "react";

function getAnyInitData(): { initData?: string; uid?: number } {
  const tg = (globalThis as any).Telegram?.WebApp;
  if (tg?.initData || tg?.initDataUnsafe?.user?.id) {
    return {
      initData: tg?.initData || "",
      uid: tg?.initDataUnsafe?.user?.id ? Number(tg.initDataUnsafe.user.id) : undefined,
    };
  }
  const qs = new URLSearchParams(window.location.search);
  const q = qs.get("tgWebAppData");
  if (q) return { initData: q };
  const rawUid = qs.get("uid");
  if (rawUid && Number.isFinite(Number(rawUid))) return { uid: Number(rawUid) };
  return {};
}

export default function InitAuth() {
  useEffect(() => {
    (async () => {
      const payload = getAnyInitData();
      await fetch("/api/auth", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          // важное: явно говорим серверу, что это запуск из Telegram-вебвью
          "x-telegram-like": (globalThis as any).Telegram?.WebApp ? "1" : "0",
          ...(payload.initData ? { "x-telegram-init-data": payload.initData } : {}),
          ...(payload.uid ? { "x-telegram-user-id": String(payload.uid) } : {}),
        },
        body: JSON.stringify(payload),
        credentials: "include",
      }).catch(() => {});
    })();
  }, []);

  return null;
}