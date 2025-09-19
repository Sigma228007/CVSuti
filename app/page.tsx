'use client';

import React, { useEffect, useMemo, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { fetchBalance } from '@/lib/api';
import { getInitData } from '@/lib/webapp';

function tryOpenExternal(url: string): boolean {
  try {
    const tg = (window as any)?.Telegram?.WebApp;
    if (tg?.openLink) { tg.openLink(url, { try_instant_view: false }); return true; }
  } catch {}
  try {
    const a = document.createElement('a');
    a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
    document.body.appendChild(a); a.click(); a.remove(); return true;
  } catch {}
  try { window.open(url, '_blank', 'noopener,noreferrer'); return true; } catch {}
  try { window.location.href = url; return true; } catch {}
  return false;
}

export default function Page() {
  return (
    <Suspense fallback={<main style={{ padding: 24 }}>Загрузка…</main>}>
      <PageInner />
    </Suspense>
  );
}

function PageInner() {
  const router = useRouter();
  const [amount, setAmount] = useState<number>(500);
  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);

  // диагностика (временно — можно убрать, когда всё ок)
  const [lastUrl, setLastUrl] = useState<string>('');
  const [lastError, setLastError] = useState<string>('');

  const initData = useMemo(() => getInitData(), []);

  // баланс — тянем только в TG
  useEffect(() => {
    let stop = false;
    async function load() {
      if (!initData) { setBalance(null); return; }
      try { const b = await fetchBalance(); if (!stop) setBalance(b); } catch { if (!stop) setBalance(null); }
    }
    load();
    const t = setInterval(load, 10000);
    return () => { stop = true; clearInterval(t); };
  }, [initData]);

  async function handlePay() {
    if (!amount || amount <= 0) return;
    setLoading(true);
    setLastError('');
    setLastUrl('');
    try {
      const r = await fetch('/api/fkwallet/invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Init-Data': initData || '' },
        body: JSON.stringify({ amount, initData }),
      });

      let data: any = null;
      let rawText = '';
      try { data = await r.json(); } catch { rawText = await r.text().catch(()=> ''); }

      if (!r.ok || !data?.ok || !data?.url || !data?.id) {
        const msg = data?.error || rawText || `Server error (${r.status})`;
        setLastError(String(msg));
        alert('Ошибка инвойса: ' + msg);
        return;
      }

      const url = String(data.url);
      const id  = String(data.id);
      setLastUrl(url);

      // 1) ОТКРЫВАЕМ кассу СЕЙЧАС (жест клика)
      tryOpenExternal(url);

      // 2) ДАЁМ 500–800 мс форы iOS/Telegram, чтобы открыть внешний браузер
      await new Promise((res) => setTimeout(res, 600));

      // 3) Переходим на экран ожидания (он только пулинг статуса)
      router.push(`/pay/${encodeURIComponent(id)}?url=${encodeURIComponent(url)}`);
    } catch (e: any) {
      setLastError(String(e?.message || e));
      alert('Ошибка сети: ' + (e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: 24, fontFamily: 'Inter, Arial, sans-serif', color: '#e6eef3' }}>
      <h1 style={{ color: '#fff', marginBottom: 16 }}>GVsuti — Пополнение</h1>

      <div style={{ marginTop: 8, background: '#0f1720', padding: 20, borderRadius: 12, maxWidth: 900 }}>
        <div style={{ marginBottom: 12 }}>
          <span style={{ fontSize: 14, background: '#111827', padding: '6px 10px', borderRadius: 8, color: '#93c5fd' }}>
            Баланс: {balance === null ? '— (вне Telegram недоступно)' : `${balance} ₽`}
          </span>
        </div>

        <label style={{ display: 'block', marginBottom: 8, color: '#cbd5e1' }}>Сумма</label>
        <input
          type="number" min={1} value={amount} onChange={(e)=>setAmount(Number(e.target.value))}
          style={{ padding: 10, width: 220, borderRadius: 10, border: '1px solid #1f2937', background: '#0b1220', color: '#e6eef3', outline: 'none', marginBottom: 14 }}
        />

        <p style={{ marginTop: 4, marginBottom: 14, color: '#9aa9bd' }}>
          Оплата откроется во внешнем браузере. После успешной оплаты закройте вкладку и вернитесь в Telegram.
        </p>

        <button
          onClick={handlePay} disabled={loading || !amount || amount <= 0}
          style={{ padding: '12px 18px', background: loading ? '#128a71' : '#19b894', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 600 }}
        >
          {loading ? 'Подготовка…' : 'Оплатить'}
        </button>

        {(lastError || lastUrl) && (
          <div className="info" style={{ marginTop: 14 }}>
            {lastError && <div style={{ color: '#f87171', marginBottom: 8 }}>Ошибка: {lastError}</div>}
            {lastUrl && (
              <div>
                Ссылка кассы: <a href={lastUrl} target="_blank" rel="noreferrer" style={{ color: '#93c5fd' }}>{lastUrl}</a>
                <div style={{ marginTop: 6 }}>
                  <button className="btn-outline" onClick={()=>tryOpenExternal(lastUrl)}>Открыть кассу вручную</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}