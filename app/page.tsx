'use client';

import { useEffect, useMemo, useState } from 'react';

declare global { interface Window { Telegram?: any } }
type TUser = { id: number; first_name?: string; username?: string };
type PendingDeposit = { id: string; userId: number; amount: number; createdAt: number; status: string };

function getInitData(): string {
  if (typeof window === 'undefined') return '';
  const tg = window.Telegram?.WebApp;
  if (tg?.initData) return tg.initData;
  const url = new URL(window.location.href);
  const m = (url.hash || '').match(/tgWebAppData=([^&]+)/);
  if (m?.[1]) return decodeURIComponent(m[1]);
  const q = url.searchParams.get('tgWebAppData');
  if (q) return decodeURIComponent(q);
  return '';
}

export default function Home() {
  // --- AUTH ---
  const [user, setUser] = useState<TUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const initData = useMemo(() => getInitData(), []);

  // --- GAME / BALANCE ---
  const [balance, setBalance] = useState<number>(0);
  const [amount, setAmount] = useState<number>(100);
  const [chance, setChance] = useState<number>(50);
  const [dir, setDir] = useState<'under' | 'over'>('under');
  const [coef, setCoef] = useState<number>(0);
  const [log, setLog] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  // --- DEPOSITS (modal) ---
  const [depositOpen, setDepositOpen] = useState(false);
  const [depositAmt, setDepositAmt] = useState<number>(500);
  const [depositMode, setDepositMode] = useState<'card' | 'fk'>('card'); // <- переключатель

  // --- ADMIN ---
  const [pending, setPending] = useState<PendingDeposit[]>([]);
  const isAdmin = useMemo(() => {
    const ids = (process.env.NEXT_PUBLIC_ADMIN_IDS ?? '')
      .split(',')
      .map((s) => Number(s.trim()))
      .filter(Boolean);
    return !!user && ids.includes(user.id);
  }, [user]);

  // --- REQUISITES (with fallback) ---
  const depositDetails =
    process.env.NEXT_PUBLIC_DEPOSIT_DETAILS ||
    process.env.NEXT_PUBLIC_DEPOSITS_DETAILS ||
    '';

  // --- Telegram UI prepare & login ---
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    tg?.ready?.();
    tg?.expand?.();
    (async () => {
      try {
        const r = await fetch('/api/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ initData }),
        });
        const data = await r.json();
        if (data?.ok && data?.user) {
          setUser(data.user as TUser);
          if (typeof data.balance === 'number') setBalance(data.balance); // <- СРАЗУ ставим баланс из Redis
        } else {
          setAuthError(data?.error || 'auth_failed');
        }
      } catch {
        setAuthError('network_error');
      } finally {
        setAuthLoading(false);
      }
    })();
  }, [initData]);

  // --- coef recalc ---
  useEffect(() => {
    const edgeBp = Number(process.env.NEXT_PUBLIC_HOUSE_EDGE_BP ?? 150);
    const edge = (10000 - edgeBp) / 10000;
    const fair = 100 / Math.max(1, Math.min(95, chance));
    setCoef(parseFloat((fair * edge).toFixed(4)));
  }, [chance]);

  // (необязательно) периодический мягкий рефреш баланса (после внешних пополнений)
  useEffect(() => {
    if (!user) return;
    const h = setInterval(async () => {
      try {
        const r = await fetch('/api/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ initData }),
          cache: 'no-store',
        });
        const d = await r.json();
        if (d?.ok && typeof d.balance === 'number') setBalance(d.balance);
      } catch {}
    }, 20000);
    return () => clearInterval(h);
  }, [user, initData]);

  // --- actions ---
  async function place() {
    if (!user) return;
    setBusy(true);
    try {
      const res = await fetch('/api/bet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData, amount, chance, dir }),
      });
      const data = await res.json();
      if (data.ok) {
        setBalance(data.balance);
        setLog((prev) => [data.bet, ...prev].slice(0, 30));
      } else {
        alert(data.error || 'Ошибка');
      }
    } catch {
      alert('Сеть/сервер недоступен');
    } finally {
      setBusy(false);
    }
  }

  // --- deposit flow (CARD) ---
  function openDeposit() {
    setDepositMode('card');
    setDepositOpen(true);
    setDepositAmt(500);
  }
  function closeDeposit() {
    setDepositOpen(false);
  }
  async function submitDeposit() {
    try {
      const r = await fetch('/api/deposit/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData, amount: depositAmt }),
      });
      const data = await r.json();
      if (data.ok) {
        alert('Заявка отправлена администратору. После подтверждения средства поступят на баланс.');
        setDepositOpen(false);
      } else {
        alert(data.error || 'Не удалось создать заявку');
      }
    } catch {
      alert('Сеть/сервер недоступен');
    }
  }

  // --- admin panel ---
  async function refreshPending() {
    const r = await fetch('/api/deposit/pending', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData }),
    });
    const data = await r.json();
    if (data.ok) setPending(data.pending as PendingDeposit[]);
    else alert(data.error || 'Ошибка загрузки');
  }
  async function actPending(id: string, action: 'approve' | 'decline') {
    const r = await fetch('/api/deposit/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData, requestId: id, action }),
    });
    const data = await r.json();
    if (data.ok) {
      alert(`Заявка ${action === 'approve' ? 'подтверждена' : 'отклонена'}`);
      await refreshPending();
    } else {
      alert(data.error || 'Ошибка');
    }
  }
  useEffect(() => {
    if (isAdmin) refreshPending();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  // --- DEMO activity feed (optional) ---
  const demoFeedOn = String(process.env.NEXT_PUBLIC_DEMO_FEED ?? '') === '1';
  const [demo, setDemo] = useState<any[]>([]);
  useEffect(() => {
    if (!demoFeedOn) return;
    const int = setInterval(() => {
      const id = Math.random().toString(36).slice(2, 8);
      const val = Math.floor(Math.random() * 1_000_000);
      const win = Math.random() < 0.48;
      const amt = [50, 100, 200, 500, 1000, 2500][Math.floor(Math.random() * 6)];
      const c = [10, 25, 50, 70, 90][Math.floor(Math.random() * 5)];
      setDemo((prev) =>
        [
          {
            id: `demo_${Date.now()}_${id}`,
            outcome: {
              value: val,
              win,
              coef: +(100 / c * 0.985).toFixed(2),
              payout: win ? Math.floor(amt * (100 / c * 0.985)) : 0,
            },
          },
          ...prev,
        ].slice(0, 50),
      );
    }, 2000);
    return () => clearInterval(int);
  }, [demoFeedOn]);

  // --- GATES ---
  if (authLoading) {
    return (
      <main className="center">
        <div className="card">
          <div className="h2">Подключение к Telegram…</div>
        </div>
      </main>
    );
  }
  if (!user) {
    return (
      <main className="center">
        <div className="card">
          <div className="h2">Откройте через Telegram</div>
          <div className="sub">
            Это мини-приложение запускается из бота {process.env.NEXT_PUBLIC_BOT_NAME ?? ''}.
          </div>
          {authError && <div className="warn">Ошибка: {authError}</div>}
        </div>
      </main>
    );
  }

  return (
    <div className="container fade-in">
      <header className="row header">
        <div>
          <div className="h1">Nvuti-style</div>
          <div className="sub">
            Проведённая честность • WebApp {process.env.NEXT_PUBLIC_BOT_NAME ?? ''}
          </div>
        </div>
        <div className="row gap8">
          <span className="badge">UID: {user?.id}</span>
          <span className="badge">
            Баланс: <b className="k">{balance} ₽</b>
          </span>
          <button className="btn-outline" onClick={openDeposit}>
            Пополнить
          </button>
        </div>
      </header>

      <main className="grid">
        <section className="card lift">
          <div className="label">Сумма ставки (1–10 000 ₽)</div>
          <input
            className="input"
            type="number"
            min={1}
            max={10000}
            value={amount}
            onChange={(e) => setAmount(Math.max(1, Math.min(10000, parseInt(e.target.value || '0', 10))))}
          />
          <div className="row gap8 wrap">
            {[100, 500, 1000].map((v) => (
              <button key={v} className="chip" onClick={() => setAmount(v)}>
                {v} ₽
              </button>
            ))}
          </div>

          <div className="row between">
            <div>
              <div className="label">Шанс (1–95%)</div>
              <input
                className="slider"
                type="range"
                min={1}
                max={95}
                value={chance}
                onChange={(e) => setChance(parseInt(e.target.value, 10))}
              />
            </div>
            <div className="badge">{chance}%</div>
          </div>

          <div className="row gap8">
            <button className="btn-outline" onClick={() => setDir('under')} disabled={dir === 'under'}>
              Меньше
            </button>
            <button className="btn-outline" onClick={() => setDir('over')} disabled={dir === 'over'}>
              Больше
            </button>
          </div>

          <div className="row between">
            <div className="sub">
              Коэффициент: <b className="k">×{coef}</b>
            </div>
            <div className="sub">
              Потенц. выплата: <b className="k">{Math.floor(amount * coef)} ₽</b>
            </div>
          </div>

          <div>
            <button className="btn pulse" onClick={place} disabled={busy}>
              Сделать ставку
            </button>
          </div>
        </section>

        <section className="card">
          <div className="row between">
            <b>Последние раунды</b>
            <a
              className="sub"
              href="#"
              onClick={(e) => {
                e.preventDefault();
                alert('Опубликуйте старые serverSeed для проверки.');
              }}
            >
              Проверка честности
            </a>
          </div>
          <ul className="list">
            {log.slice(0, 10).map((b: any, i) => (
              <li key={i}>
                <span className="k">{b.outcome.value.toString().padStart(6, '0')}</span> —{' '}
                {b.dir === 'under' ? 'меньше' : 'больше'} при {b.chance}% →{' '}
                {b.outcome.win ? 'победа' : 'проигрыш'}; выплата <b className="k">{b.outcome.payout}</b>
                <div className="sub">
                  coef ×{b.outcome.coef} • commit {b.outcome.proof.serverSeedHash.slice(0, 10)}… • nonce{' '}
                  {b.nonce}
                </div>
              </li>
            ))}
          </ul>
        </section>

        {isAdmin && (
          <section className="card">
            <div className="row between">
              <b>Админ • Пополнения</b>
              <button className="btn-outline" onClick={refreshPending}>
                Обновить
              </button>
            </div>
            {pending.length === 0 ? (
              <div className="sub">Ожидающих заявок нет.</div>
            ) : (
              <ul className="list">
                {pending.map((p) => (
                  <li key={p.id} className="row between wrap">
                    <span>
                      #{p.id.slice(-6)} • user {p.userId} • {p.amount} ₽ •{' '}
                      {new Date(p.createdAt).toLocaleString()}
                    </span>
                    <span className="row gap8">
                      <button className="chip ok" onClick={() => actPending(p.id, 'approve')}>
                        Подтвердить
                      </button>
                      <button className="chip warn" onClick={() => actPending(p.id, 'decline')}>
                        Отклонить
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </main>

      {/* ДЕМО-лента активности (явно помечена) */}
      {demoFeedOn && (
        <section className="demo">
          <div className="demo-title">Лента активности</div>
          <div className="ticker">
            <div>
              {demo
                .concat(demo)
                .slice(0, 40)
                .map((b: any, i: number) => (
                  <span key={i} style={{ marginRight: 24 }}>
                    #{b.id.slice(-6)} •{' '}
                    <span className="k">{b.outcome.value.toString().padStart(6, '0')}</span> →{' '}
                    {b.outcome.win ? '✔' : '✖'}
                  </span>
                ))}
            </div>
          </div>
        </section>
      )}

      {/* Модал пополнения: 2 способа — КАРТА / КАССА (FK) */}
      {depositOpen && (
        <div className="overlay" onClick={closeDeposit}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="h2">Пополнение баланса</div>

            {/* Переключатель */}
            <div className="row gap8" style={{ marginBottom: 12 }}>
              <button
                className={depositMode === 'card' ? 'chip ok' : 'chip'}
                onClick={() => setDepositMode('card')}
              >
                Банковская карта
              </button>
              <button
                className={depositMode === 'fk' ? 'chip ok' : 'chip'}
                onClick={() => setDepositMode('fk')}
              >
                Касса (FKWallet)
              </button>
            </div>

            <div className="label">Сумма</div>
            <input
              className="input"
              type="number"
              min={1}
              value={depositAmt}
              onChange={(e) => setDepositAmt(Math.max(1, parseInt(e.target.value || '0', 10)))}
            />

            {depositMode === 'card' ? (
              <>
                <div className="info">
                  Реквизиты для перевода:
                  <br />
                  <b>{depositDetails || 'Реквизиты пока не заданы'}</b>
                  <div className="sub">
                    После оплаты нажмите «Я оплатил» — заявка уйдёт администратору на подтверждение.
                  </div>
                </div>
                <div className="row gap8">
                  <button className="btn-outline" onClick={closeDeposit}>
                    Отмена
                  </button>
                  <button className="btn" onClick={submitDeposit}>
                    Я оплатил
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="info">
                  Оплата через кассу (FKWallet / FreeKassa). Нажмите «Оплатить в кассе» — откроется
                  страница оплаты. После успешной оплаты баланс увеличится автоматически.
                </div>
                <div className="row gap8">
                  <button className="btn-outline" onClick={closeDeposit}>
                    Отмена
                  </button>
                  <button
                    className="btn"
                    onClick={async () => {
                      try {
                        const r = await fetch('/api/fkwallet/invoice', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ initData, amount: depositAmt }),
                        });
                        const d = await r.json();
                        if (d.ok && d.url) {
                          window.location.href = d.url;
                        } else {
                          alert(d.error || 'Не удалось создать счёт');
                        }
                      } catch {
                        alert('Сеть/сервер недоступен');
                      }
                    }}
                  >
                    Оплатить в кассе
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}