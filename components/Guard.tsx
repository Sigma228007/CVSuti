"use client";
import { useEffect, useState } from "react";

function isTelegramLikeUA() {
  const ua = navigator.userAgent.toLowerCase();
  const ref = document.referrer.toLowerCase();
  return (
    ua.includes("telegram") ||
    ua.includes("tgmini") ||
    ua.includes("tginternal") ||
    ref.includes("t.me") ||
    ref.includes("telegram.org")
  );
}

export default function Guard({ children }: { children: React.ReactNode }) {
  const [show, setShow] = useState(true);

  useEffect(() => {
    // если есть кука uid — пропускаем
    const m = document.cookie.match(/(?:^|;\s*)uid=(\d+)/);
    if (m) { setShow(false); return; }

    // иначе если Telegram-like — тоже пропускаем (после InitAuth кука появится)
    if (isTelegramLikeUA()) { setShow(false); return; }
  }, []);

  if (show) {
    return (
      <div className="w-full min-h-[60vh] flex items-center justify-center">
        <div className="rounded-xl bg-neutral-900 px-5 py-4 text-center">
          <div className="font-semibold mb-1">Доступ только через Telegram</div>
          <div className="text-sm opacity-70">
            Откройте мини-приложение через нашего бота. После первого входа ограничения снимаются.
          </div>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}