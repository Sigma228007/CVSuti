'use client';

import React, { useEffect, useState, useRef } from 'react';

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
  userId: number;
  amount: number;
  details: string;
  status: 'pending' | 'approved' | 'declined' | 'cancelled';
  createdAt: number;
  approvedAt?: number;
  declinedAt?: number;
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
  const initialized = useRef(false);
  
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

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

  // Refs для защиты от дублирования
  const activityInitialized = useRef(false);

  // Популярные юзернеймы которые будут повторяться
  const popularUsernames = [
    'ProGamer123', 'DarkWolf', 'LuckyStar', 'GoldHunter', 'FastPlayer',
    'SmartKing', 'CoolMaster', 'RedQueen', 'BlueGhost', 'SilverLord',
    'MegaWinner', 'CryptoKing', 'BonusHunter', 'JackpotSeeker'
  ];

  // Генератор юзернеймов с повторениями
  const generateUsername = () => {
    if (Math.random() < 0.3) {
      return popularUsernames[Math.floor(Math.random() * popularUsernames.length)];
    }
    
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

  // Загрузка реальной истории выводов пользователя
  const loadWithdrawHistory = async () => {
    try {
      const response = await fetch('/api/withdraw/history', {
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.ok && data.history) {
          setWithdrawHistory(data.history);
        } else {
          setWithdrawHistory([]);
        }
      } else {
        setWithdrawHistory([]);
      }
    } catch (error) {
      console.error('Error loading withdraw history:', error);
      setWithdrawHistory([]);
    }
  };

  // Отмена вывода пользователем
  const cancelWithdraw = async (withdrawId: string) => {
    if (isLoading) return;
    
    setIsLoading(true);
    try {
      const response = await fetch('/api/withdraw/cancel', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ withdrawId }),
      });

      const data = await response.json();

      if (data.ok) {
        // Перезагружаем историю и баланс
        await loadWithdrawHistory();
        await fetchBalance();
        setMessage('✅ Заявка на вывод отменена');
      } else {
        setMessage(`❌ ${data.error || 'Ошибка при отмене вывода'}`);
      }
    } catch (error) {
      setMessage('❌ Ошибка сети');
    } finally {
      setIsLoading(false);
    }
  };

  // Создание случайной активности
  const createRandomActivity = (isUserBet = false, userData: any = null, betData: any = null): ActivityItem => {
    const chance = Math.min(95, betData?.chance || Math.floor(Math.random() * 95) + 1);
    
    const totalNumbers = 999999;
    const winNumbersCount = Math.floor((chance / 100) * totalNumbers);
    
    let win = false;
    const rolled = Math.floor(Math.random() * 999999) + 1;
    
    if (betData?.direction === 'more' || Math.random() > 0.5) {
      const minWinNumber = totalNumbers - winNumbersCount + 1;
      win = rolled >= minWinNumber;
    } else {
      win = rolled <= winNumbersCount;
    }
    
    const baseMultiplier = 100 / chance;
    const payout = win ? Math.floor((betData?.amount || 100) * baseMultiplier) : 0;
    
    return {
      id: `game_${Date.now()}_${Math.random()}`,
      player: isUserBet ? (userData?.first_name || 'Вы') : generateUsername(),
      amount: betData?.amount || 100,
      result: win ? 'win' : 'lose',
      payout: payout,
      chance: chance,
      rolled: rolled,
      timestamp: Date.now()
    };
  };

  // Генерация ленты активности
  const generateActivityFeed = () => {
    if (activityInitialized.current) return;
    activityInitialized.current = true;
    
    const activities: ActivityItem[] = [];
    for (let i = 0; i < 20; i++) {
      activities.push(createRandomActivity());
    }
    setActivityFeed(activities);
  };

  // Загрузка данных пользователя
  const loadUserData = async () => {
    try {
      const savedUser = localStorage.getItem('tg_user');
      const savedUid = localStorage.getItem('tg_uid');
      
      if (savedUser && savedUid) {
        setUserData(JSON.parse(savedUser));
        setUid(Number(savedUid));
        await fetchBalance();
        await loadWithdrawHistory();
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
          await loadWithdrawHistory();
        }
      }
    } catch (error) {
      console.error('Reauth failed:', error);
    }
  };

  // Функция ставки
  const placeBet = async () => {
    if (isLoading) return;
    
    const amountNum = parseInt(betAmount);
    if (!uid || !amountNum || amountNum <= 0) return;
    
    setIsLoading(true);
    setLastBetResult(null);

    try {
      const response = await fetch('/api/bet', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          amount: amountNum,
          chance: Math.min(95, betChance),
          dir: betDirection,
          notify: false
        }),
      });

      if (response.ok) {
        const data = await response.json();
        
        if (data.ok) {
          setLastBetResult(data);
          await fetchBalance();
          
          const userActivity = createRandomActivity(true, userData, {
            amount: amountNum,
            chance: betChance,
            direction: betDirection,
            win: data.result === 'win'
          });
          
          setActivityFeed(prev => [userActivity, ...prev.slice(0, 19)]);
        } else {
          setMessage(`Ошибка: ${data.error}`);
        }
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
    if (isLoading) return;
    
    const amountNum = parseInt(depositAmount);
    if (!amountNum || amountNum <= 0) return;
    
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

  // Вывод средств
  const handleWithdraw = async () => {
    if (isLoading) return;
    
    const amountNum = parseInt(withdrawAmount);
    if (!uid || !amountNum || amountNum <= 0 || balance < amountNum) return;
    
    // Проверка минимальной суммы вывода (50 рублей)
    if (amountNum < 50) {
      setMessage('❌ Минимальная сумма вывода 50₽');
      return;
    }
    
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
        // Перезагружаем историю и баланс
        await loadWithdrawHistory();
        await fetchBalance();
        setMessage(`✅ Заявка на вывод ${amountNum}₽ создана! Ожидайте подтверждения админа.`);
        setShowWithdrawForm(false);
        setWithdrawDetails('');
      } else {
        setMessage(`❌ Ошибка: ${data.error}`);
      }
    } catch (err: any) {
      setMessage('❌ Ошибка сети');
    } finally {
      setIsLoading(false);
    }
  };

  // Получение статуса вывода в читаемом формате
  const getWithdrawStatusText = (status: string) => {
    switch (status) {
      case 'pending': return '⏳ Ожидание';
      case 'approved': return '✅ Одобрено';
      case 'declined': return '❌ Отклонено админом';
      case 'cancelled': return '❌ Отменено вами';
      default: return status;
    }
  };

  // Получение цвета статуса
  const getWithdrawStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#f59e0b';
      case 'approved': return '#22c55e';
      case 'declined': return '#ef4444';
      case 'cancelled': return '#6b7280';
      default: return '#6b7280';
    }
  };

  useEffect(() => {
    generateActivityFeed();
    loadUserData();
    
    const onlineInterval = setInterval(() => {
      setOnlineCount(prev => Math.min(100, Math.max(25, prev + (Math.random() > 0.5 ? 1 : -1))));
    }, 3000);

    const activityInterval = setInterval(() => {
      setActivityFeed(prev => {
        const newActivities = [createRandomActivity(), createRandomActivity()];
        return [...newActivities, ...prev.slice(0, 18)];
      });
    }, 500);

    return () => {
      clearInterval(activityInterval);
      clearInterval(onlineInterval);
    };
  }, []);

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
              <label className="label">Шанс выигрыша: {betChance}% (x{(100/betChance).toFixed(2)})</label>
              <input
                type="range"
                className="slider"
                value={betChance}
                onChange={(e) => setBetChance(Math.min(95, Number(e.target.value)))}
                min="1"
                max="95"
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
              <label className="label">Вывод средств (мин. 50₽)</label>
              {!showWithdrawForm ? (
                <div>
                  <input
                    type="number"
                    className="input"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    placeholder="Введите сумму вывода"
                    min="50"
                    style={{ marginBottom: '10px' }}
                  />
                  <button
                    className="btn"
                    onClick={() => setShowWithdrawForm(true)}
                    disabled={isLoading || balance < parseInt(withdrawAmount) || !withdrawAmount || parseInt(withdrawAmount) < 50}
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
          <div className="card">
            <div className="h2">📋 История выводов</div>
            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {withdrawHistory.length > 0 ? (
                withdrawHistory.map((withdraw) => (
                  <div key={withdraw.id} style={{
                    background: 'rgba(255,255,255,0.03)',
                    padding: '10px',
                    borderRadius: '8px',
                    marginBottom: '8px',
                    borderLeft: `3px solid ${getWithdrawStatusColor(withdraw.status)}`
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                      <span style={{ fontWeight: 'bold', fontSize: '14px' }}>{withdraw.amount}₽</span>
                      <span style={{
                        color: getWithdrawStatusColor(withdraw.status),
                        fontSize: '12px',
                        fontWeight: 'bold'
                      }}>
                        {getWithdrawStatusText(withdraw.status)}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', opacity: 0.8, marginBottom: '5px' }}>
                      {withdraw.details}
                    </div>
                    <div style={{ fontSize: '10px', opacity: 0.6 }}>
                      {new Date(withdraw.createdAt).toLocaleDateString('ru-RU')} {new Date(withdraw.createdAt).toLocaleTimeString('ru-RU')}
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
                          cursor: 'pointer',
                          marginTop: '5px'
                        }}
                      >
                        ❌ Отменить заявку
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <div style={{ 
                  textAlign: 'center', 
                  padding: '20px', 
                  opacity: 0.7,
                  fontSize: '14px'
                }}>
                  История выводов пуста
                </div>
              )}
            </div>
          </div>
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
                    {activity.result === 'win' ? `+${activity.payout}₽ (x${(100/activity.chance).toFixed(2)})` : 'Проигрыш'}
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

      <style jsx>{`
        .container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 16px;
        }
        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-top: 16px;
        }
        .card {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 12px;
          padding: 16px;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .lift {
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }
        .center {
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
        }
        .row {
          display: flex;
        }
        .between {
          justify-content: space-between;
          align-items: center;
        }
        .h1 {
          font-size: 24px;
          font-weight: bold;
          margin-bottom: 4px;
        }
        .h2 {
          font-size: 20px;
          font-weight: bold;
          margin-bottom: 4px;
        }
        .sub {
          font-size: 14px;
          opacity: 0.8;
        }
        .label {
          display: block;
          margin-bottom: 6px;
          font-size: 14px;
          font-weight: 500;
        }
        .input {
          width: 100%;
          padding: 10px;
          border-radius: 6px;
          border: 1px solid rgba(255, 255, 255, 0.2);
          background: rgba(255, 255, 255, 0.1);
          color: white;
          font-size: 14px;
        }
        .slider {
          width: 100%;
          height: 6px;
          border-radius: 3px;
          background: rgba(255, 255, 255, 0.2);
          outline: none;
        }
        .chip {
          padding: 8px 12px;
          border-radius: 20px;
          border: 1px solid rgba(255, 255, 255, 0.3);
          background: rgba(255, 255, 255, 0.1);
          color: white;
          cursor: pointer;
          transition: all 0.2s;
        }
        .chip.active {
          background: rgba(59, 130, 246, 0.5);
          border-color: rgba(59, 130, 246, 0.8);
        }
        .chip:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .btn {
          padding: 12px 16px;
          border-radius: 8px;
          border: none;
          background: linear-gradient(45deg, #3b82f6, #60a5fa);
          color: white;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (max-width: 768px) {
          .grid {
            grid-template-columns: 1fr;
          }
          .container {
            padding: 8px;
          }
        }
      `}</style>
    </main>
  );
}