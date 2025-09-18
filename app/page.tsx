'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type Dir = 'under' | 'over';

declare global {
  interface Window {
    Telegram?: any;
  }
}

function getInitData(): string {
  try {
    const tg = window?.Telegram?.WebApp;
    return tg?.initData || '';
  } catch {
    return '';
  }
}

export default function Page() {
  // -------- state --------
  const [balance, setBalance] = useState<number>(0);
  const [amount, setAmount] = useState<number>(100);
  const [chance, setChance] = useState<number>(50);
  const [dir, setDir] = useState<Dir>('under');

  const [depositOpen, setDepositOpen] = useState<boolean>(false);
  const [depositTab, setDepositTab] = useState<'card' | 'fk'>('card');
  const [depositAmt, setDepositAmt] = useState<number>(500);

  const [busy, setBusy] = useState<boolean>(false);
  const initData = useMemo(getInitData, []);
  const lastInvoice = useRef<{ url?: string } | null>(null);

  // -------- balance --------
  const fetchBalance = async () => {
    try {
      const r = await fetch('/api/balance', { method: 'GET', cache: 'no-store' });
      if (!r.ok) return;
      const d = await r.json();
      if (typeof d.balance === 'number') setBalance(d.balance);
    } catch {}
  };

  useEffect(() => {
    fetchBalance();
  }, []);

  // при возврате из внешнего браузера проверяем баланс
  useEffect(() => {
    const onFocus = () => fetchBalance();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  // -------- bet --------
  const placeBet = async () => {
    if (busy) return;
    try {
      setBusy(true);
      const r = await fetch('/api/bet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initData,
          amount: Number(amount),
          chance: Number(chance),
          dir,
        }),
      });
      const d = await r.json();
      if (!r.ok || !d?.ok) return alert(d?.error || 'Ошибка при ставке');
      if (typeof d.balance === 'number') setBalance(d.balance);
    } catch {
      alert('Сеть недоступна');
    } finally {
      setBusy(false);
    }
  };

  // -------- deposit (modal) --------
  const openDeposit = () => {
    setDepositAmt(500);
    setDepositTab('card');
    setDepositOpen(true);
  };
  const closeDeposit = () => setDepositOpen(false);

  // Банковская карта — заявка в админку
  const payByCard = async () => {
    if (busy) return;
    try {
      setBusy(true);
      const r = await fetch('/api/deposit/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData, amount: depositAmt }),
      });
      const d = await r.json();
      if (!r.ok || !d?.ok) return alert(d?.error || 'Не удалось создать заявку');

      alert('Заявка отправлена. После подтверждения баланс обновится.');
      closeDeposit();
      fetchBalance();
    } catch {
      alert('Сеть недоступна');
    } finally {
      setBusy(false);
    }
  };

  // Касса (FKWallet/FreeKassa) — инвойс во внешнем браузере
  const payByFK = async () => {
    if (busy) return;
    try {
      setBusy(true);
      const r = await fetch('/api/fkwallet/invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData, amount: depositAmt }),
      });
      const d = await r.json();

      if (!r.ok || !d?.ok) {
        // 401/403 часто означает ошибку в FK_* переменных/подписи
        return alert(d?.error || 'Не удалось создать счет в кассе');
      }

      if (d.url) {
        lastInvoice.current = { url: d.url };
        window.open(d.url, '_blank', 'noopener'); // внешняя вкладка
        alert('Счет открыт во внешнем браузере. После оплаты вернитесь в мини-приложение — баланс обновится автоматически.');
        closeDeposit();
      } else {
        alert('Касса не вернула ссылку на оплату.');
      }
    } catch {
      alert('Сеть недоступна');
    } finally {
      setBusy(false);
    }
  };

  // -------- ui helpers --------
  const coef = useMemo(() => {
    const edge = (10000 - 200) / 10000; // 2% дом (подстрой при желании)
    const fair = 100 / Math.max(1, Math.min(95, chance));
    return Math.max(1, Math.floor(fair * edge * 100) / 100);
  }, [chance]);

  // -------- render --------
  return (
    <div className="wrap">
      <header className="row between">
        <div />
        <div>
          Баланс: <b>{balance} ₽</b>
          <button className="btn-outline" style={{ marginLeft: 8 }} onClick={openDeposit}>
            Пополнить
          </button>
        </div>
      </header>

      <section className="card">
        <div className="label">Сумма ставки (1–10 000 ₽)</div>
        <input
          className="input"
          type="number"
          min={1}
          max={10000}
          value={amount}
          onChange={(e) => setAmount(Math.max(1, Math.min(10000, parseInt(e.target.value || '0', 10))))}
        />
        <div className="row gap8 wrap" style={{ marginTop: 8 }}>
          {[100, 500, 1000].map((v) => (
            <button key={v} className="chip" onClick={() => setAmount(v)}>{v} ₽</button>
          ))}
        </div>

        <div className="row between" style={{ marginTop: 12 }}>
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

        <div className="row" style={{ marginTop: 12, gap: 8 }}>
          <button className="btn-outline" onClick={() => setDir('under')} disabled={dir === 'under'}>
            Меньше
          </button>
          <button className="btn-outline" onClick={() => setDir('over')} disabled={dir === 'over'}>
            Больше
          </button>
        </div>

        <div className="row between" style={{ marginTop: 8 }}>
          <div className="muted">Коэффициент: <b>×{coef}</b></div>
          <div className="muted">Потенц. выплата: <b>{Math.floor(amount * coef)} ₽</b></div>
        </div>

        <div style={{ marginTop: 12 }}>
          <button className="btn" disabled={busy} onClick={placeBet}>Сделать ставку</button>
        </div>
      </section>

      {/* modal deposit */}
      {depositOpen && (
        <div className="overlay" onClick={closeDeposit}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="row gap8">
              <button
                className={`chip ${depositTab === 'card' ? 'active' : ''}`}
                onClick={() => setDepositTab('card')}
              >
                Банковская карта
              </button>
              <button
                className={`chip ${depositTab === 'fk' ? 'active' : ''}`}
                onClick={() => setDepositTab('fk')}
              >
                Касса (FKWallet)
              </button>
            </div>

            <div style={{ marginTop: 12 }}>
              <div className="label">Сумма</div>
              <input
                className="input"
                type="number"
                min={1}
                max={100000}
                value={depositAmt}
                onChange={(e) =>
                  setDepositAmt(Math.max(1, Math.min(100000, parseInt(e.target.value || '0', 10))))
                }
              />
            </div>

            {depositTab === 'fk' ? (
              <>
                <div className="info" style={{ marginTop: 12 }}>
                  Оплата через кассу (FKWallet / FreeKassa). Нажмите «Оплатить в кассе» — откроется
                  внешняя страница оплаты. После успешной оплаты вернитесь в мини-приложение —
                  баланс обновится автоматически.
                </div>
                <div className="row gap8" style={{ marginTop: 12 }}>
                  <button className="btn-outline" onClick={closeDeposit}>Отмена</button>
                  <button className="btn" disabled={busy} onClick={payByFK}>Оплатить в кассе</button>
                </div>
              </>
            ) : (
              <>
                <div className="info" style={{ marginTop: 12 }}>
                  Создастся заявка на пополнение. После подтверждения администратором баланс увеличится.
                </div>
                <div className="row gap8" style={{ marginTop: 12 }}>
                  <button className="btn-outline" onClick={closeDeposit}>Отмена</button>
                  <button className="btn" disabled={busy} onClick={payByCard}>Отправить заявку</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* при желании — бегущая строка событий */}
      <div className="ticker" style={{ marginTop: 24 }} />
    </div>
  );
}