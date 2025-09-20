'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

type Status = 'loading' | 'pending' | 'approved' | 'declined';

function getSearchParam(name: string): string | null {
  try {
    const sp = new URLSearchParams(window.location.search);
    return sp.get(name);
  } catch {
    return null;
  }
}

export default function PayAwaitPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  // URL кассы передали с главной: /pay/[id]?url=...
  const payUrl = useMemo(() => getSearchParam('url') || '', []);
  const [status, setStatus] = useState<Status>('loading');
  const [amount, setAmount] = useState<number | null>(null);
  const [opened, setOpened] = useState(false);
  const timer = useRef<any>(null);

  // стартуем ожидание
  useEffect(() => {
    setStatus('pending');

    async function tick() {
      try {
        const r = await fetch(`/api/pay/status?id=${encodeURIComponent(id)}`, { cache: 'no-store' });
        const d = await r.json();
        if (d?.ok) {
          setAmount(d.amount ?? null);
          if (d.status === 'approved' || d.status === 'declined') {
            setStatus(d.status as Status);

            // Запомним одноразовый маркер, чтобы на главной показать всплывашку
            try {
              sessionStorage.setItem(
                'gv:lastDep',
                JSON.stringify({
                  id,
                  status: d.status,
                  amount: d.amount ?? null,
                  ts: Date.now(),
                }),
              );
            } catch {}
          }
        }
      } catch {}
    }

    // первый вызов и затем интервал
    tick();
    timer.current = setInterval(tick, 2500);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [id]);

  // мягкая попытка сразу открыть кассу (если не получилось — есть кнопка)
  useEffect(() => {
    if (!payUrl || opened) return;
    setOpened(true);

    const tg = (window as any)?.Telegram?.WebApp;
    // В Telegram просим открыть во внешнем браузере (там FK работает корректно).
    if (tg?.openLink) {
      try {
        tg.openLink(payUrl, { try_instant_view: false });
        return;
      } catch {}
    }
    // Фоллбек (ПК)
    try {
      window.open(payUrl, '_blank', 'noopener,noreferrer');
    } catch {}
  }, [payUrl, opened]);

  function openCashier() {
    if (!payUrl) return;
    const tg = (window as any)?.Telegram?.WebApp;
    if (tg?.openLink) {
      try {
        tg.openLink(payUrl, { try_instant_view: false });
        return;
      } catch {}
    }
    try {
      window.open(payUrl, '_blank', 'noopener,noreferrer');
    } catch {}
  }

  const Banner = () => {
    if (status === 'approved') {
      try {
        (window as any)?.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.('success');
      } catch {}
      return (
        <div className="card fade-in" style={{ textAlign: 'center' }}>
          <div className="h2">✅ Оплата зачислена</div>
          {amount != null && <div className="sub">Сумма: {amount} ₽</div>}
          <div className="info" style={{ marginTop: 10 }}>
            Перезапустите мини-приложение (или нажмите «Обновить» на главной), чтобы увидеть новый баланс.
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button className="btn" onClick={() => router.push('/')}>На главную</button>
          </div>
        </div>
      );
    }
    if (status === 'declined') {
      try {
        (window as any)?.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.('error');
      } catch {}
      return (
        <div className="card fade-in" style={{ textAlign: 'center' }}>
          <div className="h2">❌ Платёж не прошёл</div>
          <div className="sub">Если это ошибка — попробуйте ещё раз.</div>
          <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button className="btn" onClick={() => router.push('/')}>На главную</button>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <main className="center" style={{ padding: 24 }}>
      {/* Баннер появится автоматически, как только /api/pay/status станет approved/declined */}
      {(status === 'approved' || status === 'declined') ? (
        <Banner />
      ) : (
        <div className="card fade-in" style={{ maxWidth: 560 }}>
          <div className="h2">Ожидаем оплату…</div>
          <div className="sub" style={{ marginTop: 6 }}>
            Если вы оплатили во внешнем браузере — вернитесь в Telegram, страница обновится автоматически.
          </div>

          <div className="info" style={{ marginTop: 12 }}>
            Если касса не открылась: нажмите «Открыть кассу» ниже. На ПК она откроется в новой вкладке, в Telegram — во внешнем браузере.
          </div>

          <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
            <button className="btn" onClick={openCashier}>Открыть кассу</button>
            <button className="btn-outline" onClick={() => router.push('/')}>Отмена</button>
          </div>

          <div className="ticker" style={{ marginTop: 14 }}>
            <div>Ждём подтверждение оплаты… • эта страница обновится автоматически • </div>
          </div>
        </div>
      )}
    </main>
  );
}