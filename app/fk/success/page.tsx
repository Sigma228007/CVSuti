'use client';

import React, { useEffect, useMemo, useState } from 'react';

function buildBotLink(bot: string, payload: string) {
  const botName = bot.replace(/^@/, '');
  return {
    tg: `tg://resolve?domain=${botName}&startapp=${encodeURIComponent(payload)}`,
    https: `https://t.me/${botName}?startapp=${encodeURIComponent(payload)}`,
  };
}

export default function FkSuccessPage() {
  const [link, setLink] = useState<{tg:string; https:string} | null>(null);
  const [needClick, setNeedClick] = useState(false);

  const payload = useMemo(() => {
    const sp = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
    // Можешь передавать сюда, например, paid_<id>_<amt> из инвойса
    return sp.get('p') || 'paid_success';
  }, []);

  useEffect(() => {
    const bot = (process.env.NEXT_PUBLIC_BOT_NAME || '').trim();
    if (!bot) return;

    const l = buildBotLink(bot, payload);
    setLink(l);

    const tg = (window as any)?.Telegram?.WebApp;
    // Если страница открыта внутри Telegram webview — возвратим автоматически
    try {
      if (tg?.openTelegramLink) {
        tg.openTelegramLink(l.https);
        try { tg.close(); } catch {}
        return;
      }
    } catch {}

    // Иначе это внешний браузер (Safari/Chrome): нужен клик пользователя
    setNeedClick(true);
  }, [payload]);

  return (
    <main className="center">
      <div className="card fade-in" style={{ textAlign: 'center', maxWidth: 560 }}>
        <div className="h2">✅ Оплата прошла</div>
        <div className="sub" style={{ marginBottom: 14 }}>
          {needClick
            ? 'Нажмите кнопку, чтобы вернуться в мини-приложение Telegram.'
            : 'Возвращаем в мини-приложение…'}
        </div>

        {needClick && link && (
          <a
            href={link.https}
            target="_blank"
            rel="noopener noreferrer"
            className="btn"
            style={{ display: 'inline-block' }}
          >
            Открыть в Telegram
          </a>
        )}

        {needClick && link && (
          <div className="sub" style={{ marginTop: 12, fontSize: 12, opacity: 0.8 }}>
            Если не открылось, скопируйте ссылку вручную:<br />
            <code style={{ wordBreak: 'break-all' }}>{link.https}</code>
          </div>
        )}
      </div>
    </main>
  );
}