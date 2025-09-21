"use client";

import { useEffect, useState } from "react";

export default function Guard({ children }: { children: React.ReactNode }) {
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    // простая эвристика: если есть cookie sid — считаем, что авторизованы
    setHasSession(document.cookie.includes("sid="));
  }, []);

  if (hasSession === null) return null;

  if (!hasSession) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black/70 z-50">
        <div className="rounded-xl bg-neutral-900 text-white max-w-md w-[92%] p-5 shadow-lg">
          <div className="text-lg font-semibold mb-2">Доступ только через Telegram</div>
          <div className="text-sm opacity-80">
            Откройте мини-приложение через нашего бота. После первого входа ограничения снимаются, чтобы не мешать оплате.
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}