"use client";

import { useEffect, useRef } from "react";

export default function InitAuth() {
  const once = useRef(false);

  useEffect(() => {
    if (once.current) return;
    once.current = true;

    const tg = (window as any).Telegram?.WebApp;
    try {
      if (tg?.ready) tg.ready();
    } catch {}

    // Пытаемся вытащить initData всеми способами
    const url = new URL(window.location.href);
    const initFromUrl =
      url.searchParams.get("initData") || url.searchParams.get("tgWebAppData");

    const initFromTg = tg?.initData || "";
    const initData = initFromTg || initFromUrl || "";

    const user = tg?.initDataUnsafe?.user || null;

    // Отправляем на сервер и в заголовке, и в body — чтобы уж точно
    fetch("/api/auth", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-telegram-init-data": initData || "",
      },
      body: JSON.stringify({ initData, user }),
      credentials: "include",
    }).catch(() => {});
  }, []);

  return null;
}