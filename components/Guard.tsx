"use client";

import React from "react";

function hasAnyTgSign(): boolean {
  try {
    // 1) глобальный объект
    // @ts-ignore
    if (typeof window !== "undefined" && window.Telegram?.WebApp) return true;
    // 2) кука sid, которую ставит /api/auth (или твоя логика)
    if (document.cookie.split("; ").some((c) => c.startsWith("sid="))) return true;
    // 3) юзер-агент / реферер
    const ua = navigator.userAgent.toLowerCase();
    const ref = document.referrer.toLowerCase();
    if (ua.includes("telegram") || ref.includes("t.me") || ref.includes("telegram.org")) return true;
  } catch {}
  return false;
}

export default function Guard({ children }: { children: React.ReactNode }) {
  const [ok, setOk] = React.useState<boolean>(false);

  React.useEffect(() => {
    setOk(hasAnyTgSign());
    // плюс: если TMA загрузится позже — дернём ещё раз
    const t = setInterval(() => {
      if (!ok && hasAnyTgSign()) {
        setOk(true);
        clearInterval(t);
      }
    }, 800);
    return () => clearInterval(t);
  }, [ok]);

  if (ok) return <>{children}</>;

  return (
    <div className="min-h-screen grid place-items-center bg-[#0B0F14] text-white p-6">
      <div className="rounded-xl bg-[#121823] p-5 text-center max-w-md shadow-lg">
        <div className="text-lg font-semibold mb-2">Доступ только через Telegram</div>
        <div className="text-sm opacity-80">
          Откройте мини-приложение через нашего бота. После первого входа ограничения снимаются, чтобы не мешать оплате.
        </div>
      </div>
    </div>
  );
}