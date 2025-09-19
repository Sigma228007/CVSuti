'use client';

import React, { useEffect, useMemo, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { fetchBalance, apiPost } from '@/lib/api';
import { getInitData } from '@/lib/webapp';

/* -------------------- helpers -------------------- */

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

/* -------------------- page -------------------- */

export default function Page() {
  return (
    <Suspense fallback={<main style={{ padding: 24 }}>Загрузка…</main>}>
      <PageInner />
    </Suspense>
  );
}

type Deposit = {
  id: string;
  userId: number;
  amount: number;
  method: 'card' | 'fkwallet';
  status: 'pending' | 'approved' | 'declined';
  createdAt: number;
  approvedAt?: number;
  declinedAt?: number;
  meta?: any;
};
type Withdraw = {
  id: string;
  userId: number;
  amount: number;
  details?: any;
  status: 'pending' | 'approved' | 'declined';
  createdAt: number;
  approvedAt?: number;
  declinedAt?: number;
};

function fmtDate(ts?: number) {
  if (!ts) return '—';
  try {
    const d = new Date(ts);
    return d.toLocaleString();
  } catch { return '—'; }
}
function StatusBadge({ s }: { s: 'pending'|'approved'|'declined'}) {
  if (s === 'approved') return <span className="badge chip ok">✅ Выполнено</span>;
  if (s === 'declined') return <span className="badge chip warn">❌ Отклонено</span>;
  return <span className="badge">⏳ В ожидании</span>;
}

function PageInner() {
  const router = useRouter();

  // ------- BALANCE / DEPOSIT -------
  const [amount, setAmount] = useState<number>(500);
  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);

  // инвойс (открытие кассы)
  const [invoiceId, setInvoiceId] = useState<string>('');
  const [invoiceUrl, setInvoiceUrl] = useState<string>('');
  const [openPromptVisible, setOpenPromptVisible] = useState(false);
  const [lastError, setLastError] = useState<string>('');

  // ------- WITHDRAW -------
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [wdAmount, setWdAmount] = useState<number>(500);
  const [wdDetails, setWdDetails] = useState<string>('');
  const [wdLoading, setWdLoading] = useState(false);

  // ------- HISTORY -------
  const [depHistory, setDepHistory] = useState<Deposit[]>([]);
  const [wdHistory, setWdHistory] = useState<Withdraw[]>([]);
  const [histLoading, setHistLoading] = useState(false);

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

  // история — по кнопке «Обновить» и авто каждые 20 сек
  async function loadHistory() {
    if (!initData) return;
    setHistLoading(true);
    try {
      const data = await apiPost<{ ok: boolean; deposits: Deposit[]; withdrawals: Withdraw[] }>(
        '/api/user/history',
        { initData, limit: 100 }
      );
      if (data?.ok) {
        setDepHistory(data.deposits || []);
        setWdHistory(data.withdrawals || []);
      }
    } catch (e) {
      // noop
    } finally {
      setHistLoading(false);
    }
  }
  useEffect(() => {
    if (!initData) return;
    let stop = false;
    loadHistory();
    const t = setInterval(() => { if (!stop) loadHistory(); }, 20000);
    return () => { stop = true; clearInterval(t); };
  }, [initData]);

  /* ------------ POPOLNENIE ------------ */
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

      const autoOpened = tryOpenExternal(url);
      if (isIOS() || !autoOpened) {
        // ждём явного клика
        setOpenPromptVisible(true);
        return;
      }
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
    tryOpenExternal(invoiceUrl);
    await new Promise((res) => setTimeout(res, 600));
    setOpenPromptVisible(false);
    router.push(`/pay/${encodeURIComponent(invoiceId)}?url=${encodeURIComponent(invoiceUrl)}`);
  }

  /* ------------ WITHDRAW ------------ */
  async function submitWithdraw() {
    if (!wdAmount || wdAmount <= 0) return;
    setWdLoading(true);
    try {
      const res = await fetch('/api/withdraw/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initData,
          amount: wdAmount,
          details: wdDetails ? { text: wdDetails } : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || `Server ${res.status}`);
      }
      alert('Заявка на вывод создана. Ожидайте подтверждения админом.');
      setWithdrawOpen(false);
      setWdDetails('');
      // обновим баланс и историю
      try { const b = await fetchBalance(); setBalance(b); } catch {}
      loadHistory();
    } catch (e: any) {
      alert('Ошибка: ' + (e?.message || e));
    } finally {
      setWdLoading(false);
    }
  }

  /* -------------------- UI -------------------- */

  return (
    <main className="container">
      <div className="row between header">
        <div className="h1">GVsuti — Кошелёк</div>
        <div className="badge">Баланс: {balance === null ? '—' : `${balance} ₽`}</div>
      </div>

      <div className="grid">
        {/* ---------- Блок пополнения ---------- */}
        <section className="card lift fade-in">
          <div className="h2">Пополнение через кассу</div>
          <div className="label">Сумма</div>
          <input
            className="input"
            type="number"
            min={1}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
          />
          <p className="sub" style={{ marginTop: 8 }}>
            Оплата откроется во внешнем браузере. После оплаты вернитесь в Telegram.
          </p>

          <div className="row gap8" style={{ marginTop: 12 }}>
            <button className="btn" onClick={handlePay} disabled={loading || !amount || amount <= 0}>
              {loading ? 'Подготовка…' : 'Оплатить'}
            </button>
            <button className="btn-outline" onClick={() => setWithdrawOpen(true)}>Вывод</button>
          </div>

          {lastError && (
            <div className="info" style={{ marginTop: 12, color: '#f87171' }}>
              Ошибка: {lastError}
            </div>
          )}

          {/* Модалка «Открыть страницу оплаты» */}
          {openPromptVisible && invoiceUrl && (
            <div className="overlay">
              <div className="modal">
                <div className="h2">Открыть страницу оплаты</div>
                <div className="sub" style={{ marginTop: 6 }}>
                  Нажмите кнопку ниже, чтобы открыть кассу во внешнем браузере.
                </div>
                <div style={{ marginTop: 12 }}>
                  <button className="btn" onClick={confirmOpenAndGo}>Открыть страницу оплаты</button>
                </div>
                <div style={{ marginTop: 10, color: '#9aa9bd' }}>
                  Если не открылось — попробуйте ссылку:&nbsp;
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
        </section>

        {/* ---------- История ---------- */}
        <section className="card lift fade-in">
          <div className="row between">
            <div className="h2">История</div>
            <button className="btn-outline" onClick={loadHistory} disabled={histLoading}>
              {histLoading ? 'Обновляем…' : 'Обновить'}
            </button>
          </div>

          <div className="h2" style={{ fontSize: 16, marginTop: 8 }}>Последние пополнения</div>
          <ul className="list">
            {depHistory.length === 0 && <li className="sub">Нет записей</li>}
            {depHistory.map((d) => (
              <li key={d.id}>
                <div className="row between wrap">
                  <div>
                    <div><b>+{d.amount} ₽</b> — {d.method === 'fkwallet' ? 'FKWallet' : 'Карта'}</div>
                    <div className="sub">{fmtDate(d.createdAt)}</div>
                  </div>
                  <StatusBadge s={d.status} />
                </div>
              </li>
            ))}
          </ul>

          <div className="h2" style={{ fontSize: 16, marginTop: 12 }}>Последние выводы</div>
          <ul className="list">
            {wdHistory.length === 0 && <li className="sub">Нет записей</li>}
            {wdHistory.map((w) => (
              <li key={w.id}>
                <div className="row between wrap">
                  <div>
                    <div><b>-{w.amount} ₽</b> — реквизиты: <span className="sub">{w.details ? JSON.stringify(w.details) : '—'}</span></div>
                    <div className="sub">{fmtDate(w.createdAt)}</div>
                  </div>
                  <StatusBadge s={w.status} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* ---------- Модалка «Вывод» ---------- */}
      {withdrawOpen && (
        <div className="overlay">
          <div className="modal">
            <div className="h2">Заявка на вывод</div>

            <div className="label">Сумма</div>
            <input
              className="input"
              type="number"
              min={1}
              value={wdAmount}
              onChange={(e)=>setWdAmount(Number(e.target.value))}
            />

            <div className="label">Реквизиты (карта/кошелёк, комментарий)</div>
            <textarea
              className="input"
              rows={3}
              value={wdDetails}
              onChange={(e)=>setWdDetails(e.target.value)}
              placeholder="Например: 2200 **** **** 1234, Иванов И.И."
            />

            <div className="row gap8" style={{ marginTop: 12 }}>
              <button className="btn" onClick={submitWithdraw} disabled={wdLoading || !wdAmount || wdAmount <= 0}>
                {wdLoading ? 'Отправляем…' : 'Отправить'}
              </button>
              <button className="btn-outline" onClick={()=>setWithdrawOpen(false)}>Отмена</button>
            </div>

            <div className="info" style={{ marginTop: 12 }}>
              После отправки заявки средства будут временно списаны с баланса до решения админа.
            </div>
          </div>
        </div>
      )}
    </main>
  );
}