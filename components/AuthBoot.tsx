"use client";

import { useEffect } from "react";

function getInitData(): string | undefined {
  try { return (window as any)?.Telegram?.WebApp?.initData || undefined; } catch { return undefined; }
}

function getSoftUid(): number | undefined {
  try {
    const tg = (window as any)?.Telegram?.WebApp?.initDataUnsafe;
    const uid = tg?.user?.id;
    if (typeof uid === "number" && uid > 0) return uid;
  } catch {}
  return undefined;
}

export default function AuthBoot() {
  useEffect(() => {
    let stop = false;

    async function boot() {
      try {
        const initData = getInitData();
        const uid = getSoftUid();

        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (initData) headers["x-init-data"] = initData;
        if (uid) headers["x-uid"] = String(uid);

        const r = await fetch("/api/auth", {
          method: "POST",
          headers,
          body: JSON.stringify({ initData, uid }),
          cache: "no-store",
        });

        // не показываем алерты — просто даём Guard/странице решать дальше
        await r.json().catch(() => ({}));
      } catch {}
    }

    boot();

    return () => { stop = true; };
  }, []);

  return null;
}