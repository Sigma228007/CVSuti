'use client';

import React, { useEffect, useMemo, useState, Suspense } from 'react';
import { apiPost } from '@/lib/api';
import { getInitData } from '@/lib/webapp';

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

export default function ProfilePage() {
  return (
    <Suspense fallback={<main className="container"><div className="card">Загрузка профиля…</div></main>}>
      <ProfileInner />
    </Suspense>
  );
}

function ProfileInner() {
  const initData = useMemo(() => getInitData(), []);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [withdraws, setWithdraws] = useState<Withdraw[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'deposits'|'withdraws'>('deposits');

  // пагинация на клиенте
  const PAGE = 20;
  const [showDep, setShowDep] = useState(PAGE);
  const [showWdr, setShowWdr] = useState(PAGE);

  useEffect(() => {
    let stop = false;
    async function load() {
      if (!initData) return;
      setLoading(true);
      try {
        const res = await apiPost<{ ok: boolean; deposits: Deposit[]; withdrawals: Withdraw[] }>(
          '/api/user/history',
          { initData, limit: 10000 } // берём “всё” с сервера
        );
        if (!stop && res?.ok) {
          // Отсортируем (на всякий случай) по createdAt убыванию
          const deps = [...(res.deposits || [])].sort((a,b)=>b.createdAt - a.createdAt);
          const wds  = [...(res.withdrawals || [])].sort((a,b)=>b.createdAt - a.createdAt);
          setDeposits(deps);
          setWithdraws(wds);
        }
      } catch {
      } finally {
        if (!stop) setLoading(false);
      }
    }
    load();
    // автообновление раз в 20 cек
    const t = setInterval(load, 20000);
    return () => { stop = true; clearInterval(t); };
  }, [initData]);

  // статистика
  const stats = useMemo(() => {
    const depApproved = deposits.filter(d=>d.status==='approved');
    const depPending  = deposits.filter(d=>d.status==='pending');
    const depDeclined = deposits.filter(d=>d.status==='declined');
    const wdApproved  = withdraws.filter(w=>w.status==='approved');
    const wdPending   = withdraws.filter(w=>w.status==='pending');
    const wdDeclined  = withdraws.filter(w=>w.status==='declined');

    const sum = (arr:{amount:number}[]) => arr.reduce((s,x)=>s+Number(x.amount||0), 0);

    const totalIn  = sum(depApproved);
    const totalOut = sum(wdApproved);
    const net      = totalIn - totalOut;

    return {
      totalIn, totalOut, net,
      depCount: deposits.length,
      wdCount: withdraws.length,
      depPending: depPending.length,
      wdPending: wdPending.length,
      depDeclined: depDeclined.length,
      wdDeclined: wdDeclined.length,
    };
  }, [deposits, withdraws]);

  function CardStat({ title, value, sub }: { title: string; value: string; sub?: string }) {
    return (
      <div className="card lift" style={{ padding: 16 }}>
        <div className="sub" style={{ marginBottom: 6 }}>{title}</div>
        <div className="h2" style={{ margin: 0 }}>{value}</div>
        {sub && <div className="sub" style={{ marginTop: 6 }}>{sub}</div>}
      </div>
    );
  }

  return (
    <main className="container">
      <div className="row between header">
        <div className="h1">Профиль</div>
        <a className="btn-outline" href="/" style={{ textDecoration: 'none' }}>← На главную</a>
      </div>

      {/* Сводка: адаптивная сетка */}
      <section className="grid" style={{ gridTemplateColumns: '1fr', gap: 12 }}>
        <div className="grid" style={{ gap: 12 }}>
          <CardStat title="Всего пополнено" value={`${stats.totalIn} ₽`} sub={`успешных операций: ${deposits.filter(d=>d.status==='approved').length}`} />
          <CardStat title="Всего выведено" value={`${stats.totalOut} ₽`} sub={`успешных операций: ${withdraws.filter(w=>w.status==='approved').length}`} />
        </div>
        <div className="grid" style={{ gap: 12 }}>
          <CardStat title="Чистый итог" value={`${stats.net >= 0 ? '+' : ''}${stats.net} ₽`} />
          <CardStat title="Ожидают подтверждения" value={`${stats.depPending + stats.wdPending}`} sub={`пополнений: ${stats.depPending} • выводов: ${stats.wdPending}`} />
        </div>
      </section>

      {/* Табы */}
      <section className="card" style={{ marginTop: 16 }}>
        <div className="row wrap" style={{ gap: 8, marginBottom: 12 }}>
          <button
            className="chip"
            onClick={()=>setTab('deposits')}
            style={{ borderColor: tab==='deposits' ? '#60a5fa' : 'rgba(148,163,184,.25)', background: tab==='deposits' ? 'rgba(96,165,250,.15)' : 'rgba(148,163,184,.12)' }}
          >
            Пополнения ({deposits.length})
          </button>
          <button
            className="chip"
            onClick={()=>setTab('withdraws')}
            style={{ borderColor: tab==='withdraws' ? '#60a5fa' : 'rgba(148,163,184,.25)', background: tab==='withdraws' ? 'rgba(96,165,250,.15)' : 'rgba(148,163,184,.12)' }}
          >
            Выводы ({withdraws.length})
          </button>
          <div className="sub" style={{ marginLeft: 'auto' }}>
            {loading ? 'Обновляем…' : 'Актуально'}
          </div>
        </div>

        {/* Таблицы/списки — адаптивные карточки */}
        {tab === 'deposits' ? (
          <div>
            {deposits.length === 0 && <div className="sub">Нет пополнений</div>}
            <div
              className="grid"
              style={{
                gap: 12,
                gridTemplateColumns: '1fr',
              }}
            >
              {deposits.slice(0, showDep).map((d) => (
                <div key={d.id} className="card">
                  <div className="row between wrap">
                    <div className="h2" style={{ fontSize: 16 }}>
                      +{d.amount} ₽ <span className="sub">• {d.method === 'fkwallet' ? 'FKWallet' : 'Карта'}</span>
                    </div>
                    <StatusBadge s={d.status} />
                  </div>
                  <div className="sub" style={{ marginTop: 6 }}>{fmtDate(d.createdAt)}</div>
                  {d.meta && (
                    <div className="info" style={{ marginTop: 8 }}>
                      <div className="sub">meta: {JSON.stringify(d.meta)}</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {showDep < deposits.length && (
              <div style={{ marginTop: 12 }}>
                <button className="btn-outline" onClick={()=>setShowDep(s=>s+PAGE)}>Показать ещё</button>
              </div>
            )}
          </div>
        ) : (
          <div>
            {withdraws.length === 0 && <div className="sub">Нет выводов</div>}
            <div
              className="grid"
              style={{
                gap: 12,
                gridTemplateColumns: '1fr',
              }}
            >
              {withdraws.slice(0, showWdr).map((w) => (
                <div key={w.id} className="card">
                  <div className="row between wrap">
                    <div className="h2" style={{ fontSize: 16 }}>
                      -{w.amount} ₽ <span className="sub">• {w.details ? 'реквизиты указаны' : 'реквизиты —'}</span>
                    </div>
                    <StatusBadge s={w.status} />
                  </div>
                  <div className="sub" style={{ marginTop: 6 }}>{fmtDate(w.createdAt)}</div>
                  {w.details && (
                    <div className="info" style={{ marginTop: 8 }}>
                      <div className="sub">Реквизиты: {typeof w.details === 'string' ? w.details : JSON.stringify(w.details)}</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {showWdr < withdraws.length && (
              <div style={{ marginTop: 12 }}>
                <button className="btn-outline" onClick={()=>setShowWdr(s=>s+PAGE)}>Показать ещё</button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Подсказки / демо-строка */}
      <div className="ticker">
        <div>История обновляется автоматически каждые 20 секунд • Нажмите на вкладки выше, чтобы переключиться между пополнениями и выводами • </div>
      </div>

      {/* Небольшая адаптивная донастройка */}
      <style jsx>{`
        @media (min-width: 900px){
          section.grid:first-of-type{
            grid-template-columns: 1fr 1fr;
          }
        }
        @media (min-width: 1200px){
          section.card .grid{
            grid-template-columns: 1fr 1fr;
          }
        }
      `}</style>
    </main>
  );
}