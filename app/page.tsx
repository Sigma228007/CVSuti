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

type WithdrawRequest = {
  id: string;
  amount: number;
  details: string;
  status: 'pending' | 'approved' | 'declined';
  createdAt: number;
};

type ActivityItem = {
  id: string;
  player: string;
  amount: number;
  result: 'win' | 'lose';
  payout: number;
  chance: number;
  rolled: number;
  timestamp: number;
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
  const [betAmount, setBetAmount] = useState<string>('100');
  const [betChance, setBetChance] = useState<number>(50);
  const [betDirection, setBetDirection] = useState<'more' | 'less'>('more');
  const [lastBetResult, setLastBetResult] = useState<BetResult | null>(null);

  // Состояния для пополнения/вывода
  const [depositAmount, setDepositAmount] = useState<string>('500');
  const [withdrawAmount, setWithdrawAmount] = useState<string>('500');
  const [withdrawDetails, setWithdrawDetails] = useState<string>('');
  const [showWithdrawForm, setShowWithdrawForm] = useState<boolean>(false);
  const [withdrawHistory, setWithdrawHistory] = useState<WithdrawRequest[]>([]);

  // Лента активности и онлайн
  const [activityFeed, setActivityFeed] = useState<ActivityItem[]>([]);
  const [onlineCount, setOnlineCount] = useState<number>(50);

  // Популярные юзернеймы которые будут повторяться
  const popularUsernames = [
    'ProGamer123', 'DarkWolf', 'LuckyStar', 'GoldHunter', 'FastPlayer',
    'SmartKing', 'CoolMaster', 'RedQueen', 'BlueGhost', 'SilverLord',
    'ProGamer123', 'DarkWolf', 'LuckyStar', // Повторы для реалистичности
    'MegaWinner', 'CryptoKing', 'BonusHunter', 'JackpotSeeker'
  ];

  // Генератор юзернеймов с повторениями
  const generateUsername = () => {
    // 30% chance to return popular (repeating) username
    if (Math.random() < 0.3) {
      return popularUsernames[Math.floor(Math.random() * popularUsernames.length)];
    }
    
    // 70% chance for unique username
    const prefixes = ['Dark', 'Light', 'Red', 'Blue', 'Gold', 'Silver', 'Fast', 'Smart', 'Cool', 'Pro'];
    const suffixes = ['Player', 'Gamer', 'Wolf', 'Hunter', 'King', 'Queen', 'Master', 'Lord', 'Star', 'Ghost'];
    const numbers = Math.floor(Math.random() * 1000);
    
    return `${prefixes[Math.floor(Math.random() * prefixes.length)]}${suffixes[Math.floor(Math.random() * suffixes.length)]}${numbers}`;
  };

  // Получаем заголовки для API
  const getAuthHeaders = () => {
    const token = localStorage.getItem('tg_token');
    const initData = (window as any).Telegram?.WebApp?.initData;
    
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...(initData && { 'X-Telegram-Init-Data': initData })
    };
  };

  // Загрузка истории выводов
  const loadWithdrawHistory = async () => {
    try {
      // В реальном приложении здесь будет запрос к API
      // Заглушка с тестовыми данными
      const mockHistory: WithdrawRequest[] = [
        { id: '1', amount: 500, details: 'Карта ****1234', status: 'pending', createdAt: Date.now() - 3600000 },
        { id: '2', amount: 1000, details: 'Qiwi: +79123456789', status: 'approved', createdAt: Date.now() - 86400000 },
        { id: '3', amount: 300, details: 'ЮMoney: 410011234567890', status: 'declined', createdAt: Date.now() - 172800000 }
      ];
      setWithdrawHistory(mockHistory);
    } catch (error) {
      console.error('Error loading withdraw history:', error);
    }
  };

  // Отмена вывода
  const cancelWithdraw = async (withdrawId: string) => {
    setIsLoading(true);
    try {
      // В реальном приложении здесь будет запрос к API
      setWithdrawHistory(prev => 
        prev.map(req => req.id === withdrawId ? { ...req, status: 'declined' } : req)
      );
      setMessage('✅ Заявка на вывод отменена');
      
      // Возвращаем средства на баланс
      const withdraw = withdrawHistory.find(req => req.id === withdrawId);
      if (withdraw) {
        setBalance(prev => prev + withdraw.amount);
      }
    } catch (error) {
      setMessage('❌ Ошибка при отмене вывода');
    } finally {
      setIsLoading(false);
    }
  };

  // Создание случайной активности
  const createRandomActivity = (isUserBet = false, userData: any = null, betData: any = null): ActivityItem => {
    const win = Math.random() * 100 < (betData?.chance || 50);
    const amount = betData?.amount || [50, 100, 200, 500, 1000, 2000, 5000][Math.floor(Math.random() * 7)];
    const chance = betData?.chance || Math.floor(Math.random() * 96) + 5;
    
    const baseMultiplier = 95 / chance;
    const payout = win ? Math.floor(amount * baseMultiplier) : 0;
    
    // Число от 1 до 999999
    const rolled = Math.floor(Math.random() * 999999) + 1;
    
    return {
      id: `game_${Date.now()}_${Math.random()}`,
      player: isUserBet ? (userData?.first_name || 'Вы') : generateUsername(),
      amount: amount,
      result: win ? 'win' : 'lose',
      payout: payout,
      chance: chance,
      rolled: rolled,
      timestamp: Date.now()
    };
  };

  // Генерация ленты активности
  const generateActivityFeed = () => {
    const activities: ActivityItem[] = [];
    for (let i = 0; i < 20; i++) {
      activities.push(createRandomActivity());
    }
    setActivityFeed(activities);
  };

  // Автоматическое обновление активности в 2 раза быстрее (каждые 500мс)
  useEffect(() => {
    generateActivityFeed();
    loadWithdrawHistory();
    
    const activityInterval = setInterval(() => {
      setActivityFeed(prev => {
        const newActivities = [createRandomActivity(), createRandomActivity()];
        return [...newActivities, ...prev.slice(0, 18)]; // Сохраняем 20 последних
      });
    }, 500); // Было 1000мс, стало 500мс

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

  // Функция ставки БЕЗ уведомлений в личные сообщения
  const placeBet = async () => {
    const amountNum = parseInt(betAmount);
    if (isLoading || !uid || !amountNum || amountNum <= 0) return;
    
    setIsLoading(true);
    setLastBetResult(null);

    try {
      const rolled = Math.floor(Math.random() * 999999) + 1;
      const winThreshold = betChance * 10000;
      
      const win = betDirection === 'more' ? rolled >= winThreshold : rolled < winThreshold;
      const baseMultiplier = 95 / betChance;
      const payout = win ? Math.floor(amountNum * baseMultiplier) : 0;

      const result: BetResult = {
        ok: true,
        result: win ? 'win' : 'lose',
        chance: betChance,
        rolled: rolled,
        payout: payout,
        balanceDelta: win ? payout - amountNum : -amountNum
      };

      setLastBetResult(result);

      const response = await fetch('/api/bet', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          amount: amountNum,
          chance: betChance,
          dir: betDirection,
        }),
      });

      if (response.ok) {
        await fetchBalance();
        
        const userActivity = createRandomActivity(true, userData, {
          amount: amountNum,
          chance: betChance,
          win: win
        });
        
        setActivityFeed(prev => [userActivity, ...prev.slice(0, 19)]);
        
        // БЕЗ УВЕДОМЛЕНИЙ В ЛИЧНЫЕ СООБЩЕНИЯ
        // Тихий режим - результат только в интерфейсе
        
      } else {
        const errorData = await response.json();
        setMessage(`Ошибка: ${errorData.error}`);
      }
    } catch (error: any) {
      setMessage('Ошибка сети');
    } finally {
      setIsLoading(false);
    }
  };

  // Пополнение
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
        setMessage(`✅ Заявка на пополнение ${amountNum}₽ создана!`);
        window.location.href = data.payUrl;
      } else {
        setMessage(`Ошибка: ${data.error}`);
      }
    } catch (err: any) {
      setMessage('Ошибка сети');
    } finally {
      setIsLoading(false);
    }
  };

  // Вывод
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
      // В реальном приложении здесь будет запрос к API
      const newWithdraw: WithdrawRequest = {
        id: `wd_${Date.now()}`,
        amount: amountNum,
        details: withdrawDetails,
        status: 'pending',
        createdAt: Date.now()
      };
      
      setWithdrawHistory(prev => [newWithdraw, ...prev]);
      setBalance(prev => prev - amountNum);
      setMessage(`✅ Заявка на вывод ${amountNum}₽ создана!`);
      setShowWithdrawForm(false);
      setWithdrawDetails('');
      
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
      
      {/* Шапка */}
      <div className="card lift">
        <div className="row between">
          <div>
            <div className="h1">GVSuti Casino</div>
            <div className="sub">Онлайн: {onlineCount} 👥 | Числа 1-999.999</div>
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
        {/* Левая колонка */}
        <div>
          {/* Ставки */}
          <div className="card">
            <div className="h2">🎰 Сделать ставку</div>
            
            <div style={{ marginBottom: '16px' }}>
              <label className="label">Сумма ставки</label>
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
                min="1"
                max="99"
                step="1"
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label className="label">Ставка на число от 1 до 999.999:</label>
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
              <div style={{ 
                marginTop: '12px', 
                padding: '10px',
                background: 'rgba(255,255,255,0.05)',
                borderRadius: '8px',
                border: `1px solid ${lastBetResult.result === 'win' ? '#22c55e' : '#ef4444'}`
              }}>
                {lastBetResult.result === 'win' ? (
                  <span>✅ Выпало: {lastBetResult.rolled?.toLocaleString()} | Выигрыш: +{lastBetResult.payout}₽</span>
                ) : (
                  <span>❌ Выпало: {lastBetResult.rolled?.toLocaleString()} | Проигрыш: -{parseInt(betAmount)}₽</span>
                )}
              </div>
            )}
          </div>

          {/* Управление балансом */}
          <div className="card">
            <div className="h2">💳 Управление балансом</div>
            
            <div style={{ marginBottom: '20px' }}>
              <label className="label">Пополнение</label>
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
                💳 Пополнить
              </button>
            </div>

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

          {/* История выводов */}
          {withdrawHistory.length > 0 && (
            <div className="card">
              <div className="h2">📋 История выводов</div>
              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {withdrawHistory.map((withdraw) => (
                  <div key={withdraw.id} style={{
                    background: 'rgba(255,255,255,0.03)',
                    padding: '10px',
                    borderRadius: '8px',
                    marginBottom: '8px',
                    borderLeft: `3px solid ${
                      withdraw.status === 'approved' ? '#22c55e' : 
                      withdraw.status === 'declined' ? '#ef4444' : '#f59e0b'
                    }`
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 'bold' }}>{withdraw.amount}₽</span>
                      <span style={{
                        color: withdraw.status === 'approved' ? '#22c55e' : 
                               withdraw.status === 'declined' ? '#ef4444' : '#f59e0b',
                        fontSize: '12px'
                      }}>
                        {withdraw.status === 'approved' ? '✅ Одобрено' : 
                         withdraw.status === 'declined' ? '❌ Отклонено' : '⏳ Ожидание'}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', opacity: 0.8, marginBottom: '5px' }}>
                      {withdraw.details}
                    </div>
                    {withdraw.status === 'pending' && (
                      <button
                        onClick={() => cancelWithdraw(withdraw.id)}
                        disabled={isLoading}
                        style={{
                          width: '100%',
                          padding: '5px',
                          background: 'rgba(239,68,68,0.2)',
                          border: '1px solid rgba(239,68,68,0.5)',
                          borderRadius: '5px',
                          color: '#ef4444',
                          fontSize: '11px',
                          cursor: 'pointer'
                        }}
                      >
                        ❌ Отменить заявку
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Правая колонка - Лента активности */}
        <div className="card">
          <div className="h2">🎮 Активность игроков</div>
          <div className="sub">Обновляется каждые 0.5 секунды</div>
          
          <div style={{ maxHeight: '600px', overflowY: 'auto', marginTop: '12px' }}>
            {activityFeed.map((activity) => (
              <div key={activity.id} style={{
                background: 'rgba(255,255,255,0.03)',
                padding: '8px',
                borderRadius: '6px',
                marginBottom: '6px',
                borderLeft: `3px solid ${activity.result === 'win' ? '#22c55e' : '#ef4444'}`,
                animation: 'fadeIn 0.3s ease'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ 
                    fontWeight: 'bold', 
                    color: activity.player === 'Вы' ? '#60a5fa' : 'inherit',
                    fontSize: '11px'
                  }}>
                    {activity.player}
                  </span>
                  <span style={{ fontSize: '11px' }}>{activity.amount}₽</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', opacity: 0.8 }}>
                  <span>Число: {activity.rolled.toLocaleString()}</span>
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
          borderColor: message.includes('✅') ? '#22c55e' : '#ef4444',
          marginTop: '16px'
        }}>
          <div className="sub">{message}</div>
        </div>
      )}
    </main>
  );
}