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

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
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

  // состояние инвойса
  const [invoiceId, setInvoiceId] = useState<string>('');
  const [invoiceUrl, setInvoiceUrl] = useState<string>('');
  const [openPromptVisible, setOpenPromptVisible] = useState(false);
  const [lastError, setLastError] = useState<string>('');

  const initData = useMemo(() => getInitData(), []);

  // баланс — тянем только в TG (иначе 401)
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
    setOpenPromptVisible(false);
    setInvoiceId('');
    setInvoiceUrl('');

    try {
      const r = await fetch('/api/fkwallet/invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Init-Data': initData || '' },
        body: JSON.stringify({ amount, initData }),
      });

      let data: any = null;
      let raw = '';
      try { data = await r.json(); } catch { raw = await r.text().catch(()=> ''); }

      if (!r.ok || !data?.ok || !data?.url || !data?.id) {
        const msg = data?.error || raw || `Server error (${r.status})`;
        setLastError(String(msg));
        alert('Ошибка инвойса: ' + msg);
        return;
      }

      const id = String(data.id);
      const url = String(data.url);
      setInvoiceId(id);
      setInvoiceUrl(url);

      // --- КЛЮЧЕВОЕ: НЕ уходим на /pay сразу ---
      // 1) Пробуем авто-открыть (на десктопе часто срабатывает)
      const autoOpened = tryOpenExternal(url);

      // 2) Если iOS/Telegram или авто-открытие не удалось — показываем карточку с кнопкой
      if (isIOS() || !autoOpened) {
        setOpenPromptVisible(true);
        return; // ждём явного клика пользователя
      }

      // 3) Если авто-открытие сработало (например, на ПК) — даём форы и уходим на /pay
      await new Promise((res) => setTimeout(res, 500));
      router.push(`/pay/${encodeURIComponent(id)}?url=${encodeURIComponent(url)}`);
    } catch (e: any) {
      setLastError(String(e?.message || e));
      alert('Ошибка сети: ' + (e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function confirmOpenAndGo() {
    if (!invoiceUrl || !invoiceId) return;
    // ЯВНОЕ действие пользователя — гарантированно открывает на iOS/Telegram
    tryOpenExternal(invoiceUrl);
    await new Promise((res) => setTimeout(res, 600));
    setOpenPromptVisible(false);
    // На экран ожидания — только после явного открытия
    router.push(`/pay/${encodeURIComponent(invoiceId)}?url=${encodeURIComponent(invoiceUrl)}`);
  }

  return (
    <main style={{ padding: 24, fontFamily: 'Inter, Arial, sans-serif', color: '#e6eef3' }}>
      <h1 style={{ color: '#fff', marginBottom: 16 }}>GVsuti — Пополнение</h1>

      <div style={{ marginTop: 8, background: '#0f1720', padding: 20, borderRadius: 12, maxWidth: 900, boxShadow: '0 6px 24px rgba(0,0,0,.25)' }}>
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

        {lastError && (
          <div className="info" style={{ marginTop: 14, color: '#f87171' }}>
            Ошибка: {lastError}
          </div>
        )}

        {/* Карточка-подсказка: нажмите, чтобы открыть кассу (остается до клика) */}
        {openPromptVisible && invoiceUrl && (
          <div className="overlay" style={{ background: 'rgba(0,0,0,.45)' }}>
            <div className="modal">
              <div className="h2">Открыть страницу оплаты</div>
              <div className="sub" style={{ marginTop: 6 }}>
                Нажмите кнопку ниже, чтобы открыть кассу во внешнем браузере.
              </div>

              <div style={{ marginTop: 14 }}>
                <button className="btn" onClick={confirmOpenAndGo}>Открыть страницу оплаты</button>
              </div>

              <div style={{ marginTop: 10, color: '#9aa9bd' }}>
                Если не открылось — попробуйте ещё раз:
                {' '}
                <a href={invoiceUrl} target="_blank" rel="noreferrer" style={{ color: '#93c5fd' }}>
                  {invoiceUrl}
                </a>
              </div>

              <div style={{ marginTop: 12 }}>
                <button className="btn-outline" onClick={() => setOpenPromptVisible(false)}>Отмена</button>
              </div>
            </div>
          </div>
        )}

        {/* На всякий случай — мини-блок снизу, если модал закрыли, а ссылку надо открыть снова */}
        {!openPromptVisible && invoiceUrl && (
          <div className="info" style={{ marginTop: 14 }}>
            Ссылка на оплату готова:&nbsp;
            <a href={invoiceUrl} target="_blank" rel="noreferrer" style={{ color: '#93c5fd' }}>
              открыть кассу
            </a>
            <div style={{ marginTop: 8 }}>
              <button className="btn-outline" onClick={confirmOpenAndGo}>Открыть и перейти к ожиданию</button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}