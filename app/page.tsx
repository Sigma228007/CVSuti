'use client';

import React, { useEffect, useState } from 'react';

type BetResult = {
  ok: boolean;
  result?: 'win' | 'lose';
  chance?: number;
  rolled?: number;
  payout?: number;
  balanceDelta?: number;
  error?: string;
};

export default function Page() {
  const [balance, setBalance] = useState<number>(0);
  const [userData, setUserData] = useState<any>(null);
  const [uid, setUid] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<string>('');
  
  // Состояния для ставок
  const [betAmount, setBetAmount] = useState<number>(100);
  const [betChance, setBetChance] = useState<number>(50);
  const [betDirection, setBetDirection] = useState<'more' | 'less'>('more');
  const [lastBetResult, setLastBetResult] = useState<BetResult | null>(null);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const savedUser = localStorage.getItem('tg_user');
      const savedUid = localStorage.getItem('tg_uid');
      
      if (savedUser && savedUid) {
        setUserData(JSON.parse(savedUser));
        setUid(Number(savedUid));
        await fetchBalance();
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const fetchBalance = async () => {
    try {
      const response = await fetch('/api/balance', {
        credentials: 'include' // Важно: включаем cookies
      });
      if (response.ok) {
        const data = await response.json();
        if (data.ok) {
          setBalance(data.balance);
        }
      } else {
        console.log('Balance fetch failed, trying to reauth...');
        await reauthenticate();
      }
    } catch (error) {
      console.error('Error fetching balance:', error);
    }
  };

  const reauthenticate = async () => {
    try {
      const tg = (window as any).Telegram?.WebApp;
      const initData = tg?.initData;
      
      if (initData) {
        const response = await fetch('/api/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ initData }),
        });
        
        const data = await response.json();
        if (data.ok) {
          localStorage.setItem('tg_user', JSON.stringify(data.user));
          localStorage.setItem('tg_uid', data.uid.toString());
          setUserData(data.user);
          setUid(data.uid);
          setBalance(data.balance);
        }
      }
    } catch (error) {
      console.error('Reauth failed:', error);
    }
  };

  // Функция ставки
  const placeBet = async () => {
    if (isLoading || !uid) return;
    
    setIsLoading(true);
    setLastBetResult(null);
    setMessage('');

    try {
      const tg = (window as any).Telegram?.WebApp;
      const initData = tg?.initData;

      if (!initData) {
        setMessage('Ошибка авторизации');
        return;
      }

      const response = await fetch('/api/bet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initData,
          amount: betAmount,
          chance: betChance,
          dir: betDirection,
        }),
      });

      const result: BetResult = await response.json();
      setLastBetResult(result);

      if (result.ok) {
        await fetchBalance(); // Обновляем баланс
        
        // Виброотклик в Telegram
        try {
          const tg = (window as any).Telegram?.WebApp;
          if (result.result === 'win') {
            tg?.HapticFeedback?.impactOccurred?.('heavy');
            setMessage(`🎉 Выигрыш! +${result.payout}₽`);
          } else {
            tg?.HapticFeedback?.impactOccurred?.('medium');
            setMessage(`💸 Проигрыш: -${betAmount}₽`);
          }
        } catch {}
      } else {
        setMessage(`Ошибка: ${result.error}`);
      }
    } catch (error: any) {
      setMessage('Ошибка сети');
    } finally {
      setIsLoading(false);
    }
  };

  // Пополнение баланса
  const handleDeposit = async (amount: number) => {
    if (isLoading) return;
    
    setIsLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/deposit/create', {
        method: 'POST',
        credentials: 'include', // Важно: cookies
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      });

      const data = await response.json();

      if (data.ok) {
        window.location.href = `/pay/${data.deposit.id}?url=${encodeURIComponent(data.payUrl)}`;
      } else {
        if (data.error === 'no session') {
          await reauthenticate();
          setMessage('Сессия устарела. Попробуйте еще раз.');
        } else {
          setMessage(`Ошибка: ${data.error}`);
        }
      }
    } catch (err: any) {
      setMessage('Ошибка сети');
    } finally {
      setIsLoading(false);
    }
  };

  // Вывод средств
  const handleWithdraw = async (amount: number) => {
    if (isLoading || balance < amount) return;
    
    if (!confirm(`Создать заявку на вывод ${amount}₽?`)) return;
    
    setIsLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/withdraw/create', {
        method: 'POST',
        credentials: 'include', // Важно: cookies
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          amount,
          details: { method: 'standard' }
        }),
      });

      const data = await response.json();

      if (data.ok) {
        setMessage(`✅ Заявка на вывод ${amount}₽ создана!`);
        await fetchBalance();
      } else {
        setMessage(`❌ Ошибка: ${data.error}`);
      }
    } catch (err: any) {
      setMessage('❌ Ошибка сети');
    } finally {
      setIsLoading(false);
    }
  };

  if (!uid) {
    return (
      <main className="center">
        <div className="card">Загрузка...</div>
      </main>
    );
  }

  return (
    <main className="container">
      {/* Шапка с балансом */}
      <div className="card lift">
        <div className="row between">
          <div>
            <div className="h1">GVSuti Casino</div>
            <div className="sub">Ваш надежный игровой клуб</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="h2">{balance.toFixed(2)} ₽</div>
            <div className="sub">Баланс</div>
          </div>
        </div>

        {userData && (
          <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="row between">
              <span className="sub">Игрок:</span>
              <span>{userData.first_name} {userData.username ? `(@${userData.username})` : ''}</span>
            </div>
            <div className="row between">
              <span className="sub">UID:</span>
              <span>{uid}</span>
            </div>
          </div>
        )}
      </div>

      {/* КАЗИНО: Ставки */}
      <div className="card">
        <div className="h2">🎰 Сделать ставку</div>
        
        <div style={{ marginBottom: '16px' }}>
          <label className="label">Сумма ставки</label>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {[10, 50, 100, 500, 1000].map((amount) => (
              <button
                key={amount}
                className={`chip ${betAmount === amount ? 'ok' : ''}`}
                onClick={() => setBetAmount(amount)}
                disabled={isLoading}
              >
                {amount}₽
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label className="label">Шанс выигрыша: {betChance}%</label>
          <input
            type="range"
            className="slider"
            value={betChance}
            onChange={(e) => setBetChance(Number(e.target.value))}
            min="5"
            max="95"
            step="5"
          />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label className="label">Ставка на:</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className={`chip ${betDirection === 'more' ? 'ok' : ''}`}
              onClick={() => setBetDirection('more')}
              disabled={isLoading}
            >
              Больше {betChance}%
            </button>
            <button
              className={`chip ${betDirection === 'less' ? 'ok' : ''}`}
              onClick={() => setBetDirection('less')}
              disabled={isLoading}
            >
              Меньше {betChance}%
            </button>
          </div>
        </div>

        <button
          className="btn"
          onClick={placeBet}
          disabled={isLoading || balance < betAmount}
          style={{ width: '100%' }}
        >
          {isLoading ? '🎲 Крутим...' : `🎯 Поставить ${betAmount}₽`}
        </button>

        {lastBetResult && (
          <div className="info" style={{ marginTop: '12px', 
            borderColor: lastBetResult.result === 'win' ? '#22c55e' : '#ef4444' }}>
            {lastBetResult.result === 'win' ? (
              <span>✅ Выигрыш! Выпало: {lastBetResult.rolled} (+{lastBetResult.payout}₽)</span>
            ) : (
              <span>❌ Проигрыш. Выпало: {lastBetResult.rolled}</span>
            )}
          </div>
        )}
      </div>

      {/* Пополнение */}
      <div className="card">
        <div className="h2">💳 Пополнение</div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[100, 500, 1000, 2000, 5000].map((amount) => (
            <button
              key={amount}
              className="btn-outline"
              onClick={() => handleDeposit(amount)}
              disabled={isLoading}
              style={{ flex: '1', minWidth: '80px' }}
            >
              +{amount}₽
            </button>
          ))}
        </div>
      </div>

      {/* Вывод */}
      <div className="card">
        <div className="h2">🏧 Вывод средств</div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[100, 500, 1000, 2000].map((amount) => (
            <button
              key={amount}
              className={`btn-outline ${balance < amount ? 'disabled' : ''}`}
              onClick={() => handleWithdraw(amount)}
              disabled={isLoading || balance < amount}
              style={{ flex: '1', minWidth: '80px' }}
            >
              -{amount}₽
            </button>
          ))}
        </div>
      </div>

      {/* Сообщения */}
      {message && (
        <div className="card" style={{ 
          borderColor: message.includes('✅') || message.includes('🎉') ? '#22c55e' : '#ef4444' 
        }}>
          <div className="sub">{message}</div>
        </div>
      )}

      {/* Навигация */}
      <div className="card">
        <div className="h2">📊 Управление</div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button className="btn-outline" onClick={() => window.location.href = '/profile'}>
            История операций
          </button>
          <button className="btn-outline" onClick={() => window.location.reload()}>
            Обновить
          </button>
        </div>
      </div>
    </main>
  );
}