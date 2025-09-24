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

// Компонент для инициализации аутентификации
function InitAuth() {
  useEffect(() => {
    const initializeAuth = async () => {
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
            localStorage.setItem('tg_token', data.token);
            
            if (!window.location.search.includes('token=')) {
              const newUrl = new URL(window.location.href);
              newUrl.searchParams.set('token', data.token);
              window.history.replaceState({}, '', newUrl.toString());
            }
          }
        }
      } catch (error) {
        console.error('Auth initialization failed:', error);
      }
    };

    initializeAuth();
  }, []);

  return null;
}

export default function Page() {
  const [balance, setBalance] = useState<number>(0);
  const [userData, setUserData] = useState<any>(null);
  const [uid, setUid] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<string>('');
  
  // Состояния для ставок
  const [betAmount, setBetAmount] = useState<string>('100'); // Изменено на string для ввода
  const [betChance, setBetChance] = useState<number>(50);
  const [betDirection, setBetDirection] = useState<'more' | 'less'>('more');
  const [lastBetResult, setLastBetResult] = useState<BetResult | null>(null);

  // Состояния для пополнения/вывода
  const [depositAmount, setDepositAmount] = useState<string>('500'); // Для ввода суммы
  const [withdrawAmount, setWithdrawAmount] = useState<string>('500'); // Для ввода суммы
  const [withdrawDetails, setWithdrawDetails] = useState<string>('');
  const [showWithdrawForm, setShowWithdrawForm] = useState<boolean>(false);

  // Лента активности и онлайн
  const [activityFeed, setActivityFeed] = useState<any[]>([]);
  const [onlineCount, setOnlineCount] = useState<number>(50);

  // Получаем токен для API запросов
  const getAuthHeaders = () => {
    const token = localStorage.getItem('tg_token');
    const initData = (window as any).Telegram?.WebApp?.initData;
    
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...(initData && { 'X-Telegram-Init-Data': initData })
    };
  };

  // Генерация ленты активности
  const generateActivityFeed = () => {
    const activities = [];
    const players = ['Alex', 'Maria', 'John', 'Anna', 'Mike', 'Sarah', 'David', 'Emma'];
    
    for (let i = 0; i < 15; i++) {
      activities.push({
        id: `game_${Date.now()}_${i}`,
        player: players[Math.floor(Math.random() * players.length)],
        amount: [10, 50, 100, 500, 1000][Math.floor(Math.random() * 5)],
        result: Math.random() > 0.4 ? 'win' : 'lose',
        payout: Math.floor(Math.random() * 2000),
        chance: [25, 50, 75, 90][Math.floor(Math.random() * 4)],
        timestamp: Date.now() - Math.random() * 3600000
      });
    }
    
    setActivityFeed(activities);
  };

  // Автоматическое обновление активности
  useEffect(() => {
    generateActivityFeed();
    
    const activityInterval = setInterval(() => {
      setActivityFeed(prev => {
        const newActivity = {
          id: `game_${Date.now()}`,
          player: ['Alex', 'Maria', 'John', 'Anna'][Math.floor(Math.random() * 4)],
          amount: [50, 100, 200, 500][Math.floor(Math.random() * 4)],
          result: Math.random() > 0.4 ? 'win' : 'lose',
          payout: Math.floor(Math.random() * 1000),
          chance: [25, 50, 75][Math.floor(Math.random() * 3)],
          timestamp: Date.now()
        };
        return [newActivity, ...prev.slice(0, 14)];
      });
    }, 1000);

    // Обновление онлайн
    const onlineInterval = setInterval(() => {
      setOnlineCount(prev => Math.min(100, Math.max(25, prev + (Math.random() > 0.5 ? 1 : -1))));
    }, 3000);

    return () => {
      clearInterval(activityInterval);
      clearInterval(onlineInterval);
    };
  }, []);

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
      } else {
        await reauthenticate();
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const fetchBalance = async () => {
    try {
      const response = await fetch('/api/balance', {
        headers: getAuthHeaders()
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
          localStorage.setItem('tg_token', data.token);
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
    const amountNum = parseInt(betAmount);
    if (isLoading || !uid || !amountNum || amountNum <= 0) return;
    
    setIsLoading(true);
    setLastBetResult(null);
    setMessage('');

    try {
      const response = await fetch('/api/bet', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          amount: amountNum,
          chance: betChance,
          dir: betDirection,
        }),
      });

      const result: BetResult = await response.json();
      setLastBetResult(result);

      if (result.ok) {
        await fetchBalance();
        
        try {
          const tg = (window as any).Telegram?.WebApp;
          if (result.result === 'win') {
            tg?.HapticFeedback?.impactOccurred?.('heavy');
            setMessage(`🎉 Выигрыш! +${result.payout}₽`);
          } else {
            tg?.HapticFeedback?.impactOccurred?.('medium');
            setMessage(`💸 Проигрыш: -${amountNum}₽`);
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

  // Реальное пополнение через FreeKassa
  const handleDeposit = async () => {
    const amountNum = parseInt(depositAmount);
    if (isLoading || !amountNum || amountNum <= 0) return;
    
    setIsLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/deposit/create', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ amount: amountNum }),
      });

      const data = await response.json();

      if (data.ok) {
        // Перенаправляем на страницу оплаты FreeKassa
        window.location.href = data.payUrl;
      } else {
        if (data.error === 'unauthorized') {
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

  // Реальный вывод с реквизитами
  const handleWithdraw = async () => {
    const amountNum = parseInt(withdrawAmount);
    if (isLoading || !uid || !amountNum || amountNum <= 0 || balance < amountNum) return;
    
    if (!withdrawDetails.trim()) {
      setMessage('❌ Укажите реквизиты для вывода');
      return;
    }
    
    setIsLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/withdraw/create', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ 
          amount: amountNum,
          details: withdrawDetails
        }),
      });

      const data = await response.json();

      if (data.ok) {
        setMessage(`✅ Заявка на вывод ${amountNum}₽ создана! Ожидайте одобрения.`);
        await fetchBalance();
        setShowWithdrawForm(false);
        setWithdrawDetails('');
        
        // Уведомление админу (в реальном коде - отправка в Telegram бота)
        console.log('📨 Уведомление админу о выводе:', {
          userId: uid,
          amount: amountNum,
          details: withdrawDetails
        });
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
        <InitAuth />
        <div className="card">Загрузка...</div>
      </main>
    );
  }

  return (
    <main className="container">
      <InitAuth />
      
      {/* Шапка с балансом и кнопками в правом верхнем углу */}
      <div className="card lift">
        <div className="row between">
          <div>
            <div className="h1">GVSuti Casino</div>
            <div className="sub">Онлайн: {onlineCount} 👥 | Реальный режим</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="h2">{balance.toFixed(2)} ₽</div>
            <div className="sub">Ваш баланс</div>
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

      <div className="grid">
        {/* Левая колонка - Основной функционал */}
        <div>
          {/* КАЗИНО: Ставки */}
          <div className="card">
            <div className="h2">🎰 Сделать ставку</div>
            
            <div style={{ marginBottom: '16px' }}>
              <label className="label">Сумма ставки (введите любую)</label>
              <input
                type="number"
                className="input"
                value={betAmount}
                onChange={(e) => setBetAmount(e.target.value)}
                placeholder="Введите сумму ставки"
                min="10"
                max="10000"
              />
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
                  className={`chip ${betDirection === 'more' ? 'active' : ''}`}
                  onClick={() => setBetDirection('more')}
                  disabled={isLoading}
                >
                  Больше {betChance}%
                </button>
                <button
                  className={`chip ${betDirection === 'less' ? 'active' : ''}`}
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
              disabled={isLoading || balance < parseInt(betAmount) || !betAmount}
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

          {/* Пополнение и вывод */}
          <div className="card">
            <div className="h2">💳 Управление балансом</div>
            
            {/* Пополнение */}
            <div style={{ marginBottom: '20px' }}>
              <label className="label">Пополнение (любая сумма)</label>
              <input
                type="number"
                className="input"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="Введите сумму пополнения"
                min="10"
                style={{ marginBottom: '10px' }}
              />
              <button
                className="btn"
                onClick={handleDeposit}
                disabled={isLoading || !depositAmount}
                style={{ width: '100%', background: 'linear-gradient(45deg, #10b981, #34d399)' }}
              >
                💳 Пополнить через FreeKassa
              </button>
            </div>

            {/* Вывод */}
            <div>
              <label className="label">Вывод средств</label>
              {!showWithdrawForm ? (
                <div>
                  <input
                    type="number"
                    className="input"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    placeholder="Введите сумму вывода"
                    min="10"
                    style={{ marginBottom: '10px' }}
                  />
                  <button
                    className="btn"
                    onClick={() => setShowWithdrawForm(true)}
                    disabled={isLoading || balance < parseInt(withdrawAmount) || !withdrawAmount}
                    style={{ width: '100%', background: 'linear-gradient(45deg, #f97316, #fb923c)' }}
                  >
                    🏧 Заказать вывод
                  </button>
                </div>
              ) : (
                <div>
                  <input
                    type="text"
                    className="input"
                    value={withdrawDetails}
                    onChange={(e) => setWithdrawDetails(e.target.value)}
                    placeholder="Введите реквизиты (карта, кошелек)"
                    style={{ marginBottom: '10px' }}
                  />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      className="btn"
                      onClick={handleWithdraw}
                      disabled={isLoading}
                      style={{ flex: 1, background: 'linear-gradient(45deg, #10b981, #34d399)' }}
                    >
                      ✅ Подтвердить
                    </button>
                    <button
                      className="btn"
                      onClick={() => setShowWithdrawForm(false)}
                      style={{ flex: 1, background: 'linear-gradient(45deg, #6b7280, #9ca3af)' }}
                    >
                      ❌ Отмена
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Правая колонка - Лента активности */}
        <div className="card">
          <div className="h2">🎮 Активность игроков</div>
          <div className="sub">Обновляется в реальном времени</div>
          
          <div style={{ maxHeight: '500px', overflowY: 'auto', marginTop: '12px' }}>
            {activityFeed.map((activity, index) => (
              <div key={activity.id} style={{
                background: 'rgba(255,255,255,0.03)',
                padding: '10px',
                borderRadius: '8px',
                marginBottom: '8px',
                borderLeft: `3px solid ${activity.result === 'win' ? '#22c55e' : '#ef4444'}`,
                animation: 'fadeIn 0.5s ease'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 'bold' }}>{activity.player}</span>
                  <span>{activity.amount}₽</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', opacity: 0.8 }}>
                  <span>Шанс: {activity.chance}%</span>
                  <span style={{ color: activity.result === 'win' ? '#22c55e' : '#ef4444' }}>
                    {activity.result === 'win' ? `+${activity.payout}₽` : 'Проигрыш'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Сообщения */}
      {message && (
        <div className="card" style={{ 
          borderColor: message.includes('✅') || message.includes('🎉') ? '#22c55e' : '#ef4444',
          marginTop: '16px'
        }}>
          <div className="sub">{message}</div>
        </div>
      )}
    </main>
  );
}