'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';

function buildBotLinks(bot: string, payload: string) {
  const botName = bot.replace(/^@/, '');
  return {
    tg: `tg://resolve?domain=${botName}&startapp=${encodeURIComponent(payload)}`,
    https: `https://t.me/${botName}?startapp=${encodeURIComponent(payload)}`,
  };
}

export default function PayPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const sp = useSearchParams();

  const [status, setStatus] = useState<'pending' | 'approved' | 'declined' | 'loading'>('loading');
  const [amount, setAmount] = useState<number | null>(null);
  const [opening, setOpening] = useState(false);

  const [needManualOpen, setNeedManualOpen] = useState(false);
  const [manualTg, setManualTg] = useState<string | null>(null);
  const [manualHttps, setManualHttps] = useState<string | null>(null);

  const payUrl = sp.get('url') || '';

  // подтягиваем статус депозита
  useEffect(() => {
    let stop = false;
    async function tick() {
      try {
        const r = await fetch(`/api/pay/status?id=${encodeURIComponent(id)}`, { cache: 'no-store' });
        const d = await r.json();
        if (!stop && d?.ok) {
          setStatus(d.status);
          setAmount(d.amount);
        }
      } catch {}
    }
    tick();
    const t = setInterval(tick, 2000);
    return () => { stop = true; clearInterval(t); };
  }, [id]);

  // попытка автоперехода (может быть заблокирован — поэтому всегда есть fallback-кнопка)
  useEffect(() => {
    if (status !== 'approved') return;

    const bot = (process.env.NEXT_PUBLIC_BOT_NAME || '').trim();
    const amt = amount ?? 0;

    if (!bot) {
      // запасной путь если бот не задан
      const timer = setTimeout(() => {
        const q = new URLSearchParams({ paid: '1', amt: String(amt), t: String(Date.now()) });
        router.replace('/?' + q.toString());
      }, 800);
      return () => clearTimeout(timer);
    }

    const { tg, https } = buildBotLinks(bot, `paid_${id}_${amt}`);
    setManualTg(tg);
    setManualHttps(https);

    const wtg = (window as any)?.Telegram?.WebApp;

    // Попробуем автопереход (может не сработать из-за sandbox/политик iOS):
    const timer = setTimeout(() => {
      try {
        if (wtg?.openTelegramLink) {
          // 1) сначала tg://
          try { wtg.openTelegramLink(tg); } catch {}
          // 2) затем https:// (на некоторых десктоп-клиентах воспринимается лучше)
          setTimeout(() => { try { wtg.openTelegramLink(https); } catch {} }, 180);
          // 3) пробуем закрыть webview (моб. Telegram)
          setTimeout(() => { try { wtg.close(); } catch {} }, 350);
          // на случай если не сработало — покажем кнопку
          setTimeout(() => setNeedManualOpen(true), 700);
          return;
        }
      } catch {}

      // Telegram Web / неизвестный клиент — сразу просим клик по кнопке
      setNeedManualOpen(true);
    }, 400);

    return () => clearTimeout(timer);
  }, [status, amount, id, router]);

  // клик по кнопке «Открыть в Telegram» (всегда в рамках user-gesture)
  function handleOpenBot() {
    const tgLink = manualTg || '';
    const httpsLink = manualHttps || '';
    const wtg = (window as any)?.Telegram?.WebApp;

    // 1) нативный вызов
    try { wtg?.openTelegramLink?.(tgLink); } catch {}
    try { wtg?.openTelegramLink?.(httpsLink); } catch {}

    // 2) прямой переход (если открыто не в Telegram, а в браузере)
    try { window.location.href = tgLink; } catch {}
    // 3) запасной
    try { window.open(httpsLink, '_blank', 'noopener,noreferrer'); } catch {}
  }

  function openInside() {
    if (!payUrl) return;
    setOpening(true);
    const tg = (window as any)?.Telegram?.WebApp;
    try {
      if (tg) {
        window.location.href = payUrl;  // внутри webview
      } else {
        window.open(payUrl, '_blank', 'noopener,noreferrer'); // ПК/браузер
      }
    } catch {
      window.open(payUrl, '_blank', 'noopener,noreferrer');
    }
  }

  if (status === 'loading') {
    return <div className="center"><div className="card">Загрузка…</div></div>;
  }

  // === approved ===
  if (status === 'approved') {
    return (
      <div className="center">
        <div className="card fade-in" style={{ textAlign: 'center', maxWidth: 560 }}>
          <div className="h2">✅ Оплата прошла</div>
          {!needManualOpen ? (
            <div className="sub">Возвращаем в мини-приложение…</div>
          ) : (
            <>
              <div className="sub" style={{ marginBottom: 12 }}>
                Если не открылось автоматически, нажмите кнопку:
              </div>
              <button className="btn" onClick={handleOpenBot}>Открыть в Telegram</button>
              {manualHttps && (
                <div className="sub" style={{ marginTop: 12, fontSize: 12, opacity: .8 }}>
                  Если не сработало, скопируйте ссылку вручную:<br />
                  <code style={{ wordBreak: 'break-all' }}>{manualHttps}</code>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // === declined ===
  if (status === 'declined') {
    return (
      <div className="center">
        <div className="card fade-in">
          <div className="h2">❌ Платёж отклонён</div>
          <div className="sub">Если это ошибка — напишите в поддержку.</div>
          <div style={{ marginTop: 12 }}>
            <button className="btn" onClick={() => router.push('/')}>На главную</button>
          </div>
        </div>
      </div>
    );
  }

  // === pending ===
  return (
    <main className="center">
      <div className="card fade-in">
        <div className="h2">Оплата {amount ? `${amount} ₽` : ''}</div>
        <div className="sub" style={{ marginBottom: 12 }}>
          Нажмите «Открыть кассу». После оплаты статус обновится автоматически.
        </div>

        <button className="btn" onClick={openInside} disabled={!payUrl || opening}>
          {opening ? 'Открываю…' : 'Открыть кассу'}
        </button>

        {process.env.NEXT_PUBLIC_ALLOW_TEST_PAY === '1' && (
          <div style={{ marginTop: 12 }}>
            <button
              className="btn-outline"
              onClick={async () => {
                try {
                  const res = await fetch('/api/dev/fk/simulate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id, amount }),
                  });
                  const data = await res.json();
                  if (!res.ok || !data?.ok) {
                    alert('Симуляция не удалась: ' + (data?.error || res.status));
                    return;
                  }
                  const r = await fetch(`/api/pay/status?id=${encodeURIComponent(id)}`, { cache: 'no-store' });
                  const d = await r.json();
                  if (r.ok && d?.ok) {
                    setStatus(d.status);
                    setAmount(d.amount);
                  }
                } catch (e: any) {
                  alert('Ошибка симуляции: ' + (e?.message || e));
                }
              }}
            >
              Симулировать callback FK (dev)
            </button>
          </div>
        )}

        <div className="ticker" style={{ marginTop: 16 }}>
          <div>Ожидаем подтверждение оплаты… • страница обновится автоматически • </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <button className="btn-outline" onClick={() => router.push('/')}>Отмена</button>
        </div>
      </div>
    </main>
  );
}