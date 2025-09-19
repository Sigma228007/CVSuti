'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';

function openBotDeepLink(bot: string, payload: string) {
  const botName = bot.replace(/^@/, '');
  const link = `https://t.me/${botName}?startapp=${encodeURIComponent(payload)}`;
  const tg = (window as any)?.Telegram?.WebApp;

  // ✅ единственный «правильный» путь — поручаем навигацию самому Telegram
  if (tg?.openTelegramLink) {
    tg.openTelegramLink(link);
    try { tg.close(); } catch {}
    return;
  }

  // 🔁 Подстраховка для редких окружений: покажем ссылку пользователю
  alert('Откройте мини-приложение по ссылке:\n' + link);
}

export default function PayPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const sp = useSearchParams();

  const [status, setStatus] = useState<'pending' | 'approved' | 'declined' | 'loading'>('loading');
  const [amount, setAmount] = useState<number | null>(null);
  const [opening, setOpening] = useState(false);

  // URL кассы передаётся из главной: /pay/[id]?url=...
  const payUrl = sp.get('url') || '';

  // Пуллим статус депозита
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

  // После успешной оплаты — вернуть в бота через deep-link
  useEffect(() => {
    if (status !== 'approved') return;
    const bot = (process.env.NEXT_PUBLIC_BOT_NAME || '').trim();
    const amt = amount ?? 0;

    if (bot) {
      const timer = setTimeout(() => openBotDeepLink(bot, `paid_${id}_${amt}`), 500);
      return () => clearTimeout(timer);
    }

    // Если бот не задан — мягкий запасной путь (останемся на сайте)
    const timer = setTimeout(() => {
      const q = new URLSearchParams({ paid: '1', amt: String(amt), t: String(Date.now()) });
      router.replace('/?' + q.toString());
    }, 800);
    return () => clearTimeout(timer);
  }, [status, amount, id, router]);

  function openInside() {
    if (!payUrl) return;
    setOpening(true);
    const tg = (window as any)?.Telegram?.WebApp;
    try {
      if (tg) {
        // Внутри Telegram webview открываем кассу в этом же окне
        window.location.href = payUrl;
      } else {
        // ПК/обычный браузер
        window.open(payUrl, '_blank', 'noopener,noreferrer');
      }
    } catch {
      window.open(payUrl, '_blank', 'noopener,noreferrer');
    }
  }

  if (status === 'loading') {
    return <div className="center"><div className="card">Загрузка…</div></div>;
  }

  if (status === 'approved') {
    return (
      <div className="center">
        <div className="card fade-in">
          <div className="h2">✅ Оплата прошла</div>
          <div className="sub">Возвращаем в мини-приложение…</div>
        </div>
      </div>
    );
  }

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

  // pending
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