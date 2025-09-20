"use client";

import { useEffect, useState } from "react";

function looksLikeTelegram(): boolean {
  try {
    const w = window as any;
    const tg = w?.Telegram?.WebApp;
    if (tg && typeof tg === "object") return true;
    const ua = navigator.userAgent || "";
    if (/Telegram/i.test(ua)) return true;
  } catch {}
  return false;
}

export default function Guard({ children }: { children: React.ReactNode }) {
  const [isTg, setIsTg] = useState<boolean>(true); // по умолчанию не блокируем

  useEffect(() => {
    try {
      // Безопасно дергаем ready/expand
      const w = window as any;
      const tg = w?.Telegram?.WebApp;
      if (tg && typeof tg.ready === "function") {
        try { tg.ready(); tg.expand?.(); } catch {}
      }
    } catch {}
    setIsTg(looksLikeTelegram());
  }, []);

  return (
    <>
      {!isTg && (
        <div className="fixed inset-x-0 bottom-4 flex justify-center z-50">
          <div className="rounded-xl bg-zinc-900/80 border border-zinc-700 px-4 py-3 text-sm shadow-xl backdrop-blur">
            Доступ только через Telegram. Откройте мини-приложение через бота.
            <span className="opacity-70"> (временное уведомление — вход не блокируется)</span>
          </div>
        </div>
      )}
      {children}
    </>
  );
}
