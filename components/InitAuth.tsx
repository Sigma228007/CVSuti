"use client";
import { useEffect, useState } from "react";

function getAnyInitData(): { initData?: string; uid?: number } {
  // 1) Telegram.WebApp
  const tg = (globalThis as any).Telegram?.WebApp;
  if (tg?.initData || tg?.initDataUnsafe?.user?.id) {
    return {
      initData: tg?.initData || "",
      uid: tg?.initDataUnsafe?.user?.id ? Number(tg.initDataUnsafe.user.id) : undefined,
    };
  }
  // 2) tgWebAppData в query
  const qs = new URLSearchParams(window.location.search);
  const q = qs.get("tgWebAppData");
  if (q) return { initData: q };
  // 3) некоторые окружения кладут как просто uid
  const rawUid = qs.get("uid");
  if (rawUid && Number.isFinite(Number(rawUid))) {
    return { uid: Number(rawUid) };
  }
  return {};
}

export default function InitAuth() {
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const payload = getAnyInitData();
        await fetch("/api/auth", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            // дублируем initData в заголовок — сервер тоже попытается его прочитать
            ...(payload.initData ? { "x-telegram-init-data": payload.initData } : {}),
            ...(payload.uid ? { "x-telegram-user-id": String(payload.uid) } : {}),
          },
          body: JSON.stringify(payload),
          credentials: "include",
        }).catch(() => {});
      } finally {
        if (!cancelled) setDone(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ничего не рисуем — компонент «технический»
  return null;
}