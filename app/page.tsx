'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { fetchBalance } from '@/lib/api';
import { getInitData as getInitDataFromWebapp } from '@/lib/webapp';

export default function Page() {
  return (
    <Suspense fallback={<main style={{ padding: 24, color: '#e6eef3' }}>Загрузка…</main>}>
      <PageInner />
    </Suspense>
  );
}

function PageInner() {
  const [amount, setAmount] = useState<number>(500);
  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);

  const sp = useSearchParams();
  const router = useRouter();
  const initData = useMemo(() => getInitDataFromWebapp() || '', []);

  async function refreshBalanceSafe() {
    if (!initData) { setBalance(null); return; }
    try {
      const b = await fetchBalance();
      setBalance(b);
    } catch {
      setBalance(null);
    }
  }

  // первичная
  useEffect(() => { refreshBalanceSafe(); }, [initData]); // eslint-disable-line

  // если Telegram передал start_param (через initDataUnsafe), то форсим обновление
  useEffect(() => {
    try {
      const tg = (window as any)?.Telegram?.WebApp;
      const sp = tg?.initDataUnsafe?.start_param as string | undefined;
      if (sp && sp.startsWith('paid_')) {
        // моментально обновляем баланс
        refreshBalanceSafe();
      }
    } catch {}
  }, [initData]); // eslint-disable-line

  // также поддержим наш старый флажок ?paid=1, если вернулись не через Telegram
  useEffect(() => {
    const paid = sp.get('paid');
    if (paid === '1') {
      refreshBalanceSafe().then(() => {
        const url = new URL(window.location.href);
        url.searchParams.delete('paid');
        url.searchParams.delete('amt');
        url.searchParams.delete('t');
        router.replace(url.pathname + (url.searchParams.toString() ? `?${url.searchParams.toString()}` : ''));
      });
    }
  }, [sp]); // eslint-disable-line

  // рефреш при возврате в приложение
  useEffect(() => {
    function onFocus() { refreshBalanceSafe(); }
    function onVisible() { if (document.visibilityState === 'visible') refreshBalanceSafe(); }
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [initData]); // eslint-disable-line

  // ... остальной твой JSX с кнопкой "Оплатить" без изменений ...
  return (
    <main style={{ padding: 24, fontFamily: 'Inter, Arial, sans-serif', color: '#e6eef3' }}>
      {/* твой UI, кнопка оплаты и т.д. */}
      {/* важно: handlePay оставь как раньше */}
      <div style={{ marginBottom: 12 }}>
        <span style={{ fontSize: 14, background: '#111827', padding: '6px 10px', borderRadius: 8, color: '#93c5fd' }}>
          Баланс:&nbsp;{balance === null ? '—' : `${balance} ₽`}
        </span>
      </div>
      {/* ... */}
    </main>
  );
}