"use client";
import { useEffect } from "react";

export default function InitAuth() {
  useEffect(() => {
    const initData = (window as any)?.Telegram?.WebApp?.initData || "";
    // Тихо создаём серверную сессию (куку sid)
    fetch("/api/auth", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ initData }),
      credentials: "include", // очень важно, чтобы кука установилась
    }).catch(() => {});
  }, []);

  return null;
}