'use client';

import React, { useEffect, useState } from 'react';

type GameActivity = {
  id: string;
  player: string;
  amount: number;
  result: 'win' | 'lose';
  payout: number;
  chance: number;
  timestamp: number;
};

type WithdrawRequest = {
  id: string;
  amount: number;
  details: string;
  status: 'pending' | 'approved' | 'declined';
};

export default function Page() {
  const [balance, setBalance] = useState<number>(1000);
  const [userData, setUserData] = useState<any>(null);
  const [uid, setUid] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<string>('');
  
  // Ставки
  const [betAmount, setBetAmount] = useState<string>('100');
  const [customBetAmount, setCustomBetAmount] = useState<string>('');
  const [betChance, setBetChance] = useState<number>(50);
  const [betDirection, setBetDirection] = useState<'more' | 'less'>('more');
  const [lastBetResult, setLastBetResult] = useState<any>(null);

  // Пополнение/вывод
  const [depositAmount, setDepositAmount] = useState<string>('500');
  const [customDepositAmount, setCustomDepositAmount] = useState<string>('');
  const [withdrawAmount, setWithdrawAmount] = useState<string>('500');
  const [customWithdrawAmount, setCustomWithdrawAmount] = useState<string>('');
  const [withdrawDetails, setWithdrawDetails] = useState<string>('');
  const [showWithdrawForm, setShowWithdrawForm] = useState<boolean>(false);
  const [withdrawRequests, setWithdrawRequests] = useState<WithdrawRequest[]>([]);

  // Лента активности
  const [activityFeed, setActivityFeed] = useState<GameActivity[]>([]);
  const [onlineCount, setOnlineCount] = useState<number>(50);

  // Инициализация
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const tg = (window as any).Telegram?.WebApp;
        if (tg) {
          tg.expand();
          tg.enableClosingConfirmation();
          
          const user = tg.initDataUnsafe?.user || {
            id: Math.floor(Math.random() * 1000000),
            first_name: 'Игрок',
            username: 'player'
          };
          
          setUserData(user);
          setUid(user.id);
          setBalance(1000);
        } else {
          const user = { id: 999999, first_name: 'Тестовый', username: 'test' };
          setUserData(user);
          setUid(user.id);
        }
      } catch (error) {
        console.error('Auth error:', error);
      }
    };

    initializeAuth();
    generateInitialActivity();

    // Автоматическое добавление активности каждую секунду
    const activityInterval = setInterval(() => {
      addNewActivity();
    }, 1000);

    // Обновление онлайн счетчика
    const onlineInterval = setInterval(() => {
      setOnlineCount(prev => Math.min(100, Math.max(25, prev + (Math.random() > 0.5 ? 1 : -1))));
    }, 3000);

    return () => {
      clearInterval(activityInterval);
      clearInterval(onlineInterval);
    };
  }, []);

  // Генерация начальной ленты активности
  const generateInitialActivity = () => {
    const activities: GameActivity[] = [];
    const players = ['Alex', 'Maria', 'John', 'Anna', 'Mike', 'Sarah', 'David', 'Emma', 'Max', 'Sophia'];
    
    for (let i = 0; i < 15; i++) {
      activities.push(createRandomActivity());
    }
    
    setActivityFeed(activities);
  };

  // Создание случайной активности
  const createRandomActivity = (): GameActivity => {
    const players = ['Alex', 'Maria', 'John', 'Anna', 'Mike', 'Sarah', 'David', 'Emma', 'Max', 'Sophia'];
    const amounts = [10, 25, 50, 100, 250, 500, 1000];
    const chances = [25, 50, 75, 90];
    
    const win = Math.random() > 0.4;
    const amount = amounts[Math.floor(Math.random() * amounts.length)];
    const chance = chances[Math.floor(Math.random() * chances.length)];
    const payout = win ? Math.floor(amount * (100 / chance) * 0.95) : 0;
    
    return {
      id: `game_${Date.now()}_${Math.random()}`,
      player: players[Math.floor(Math.random() * players.length)],
      amount,
      result: win ? 'win' : 'lose',
      payout,
      chance,
      timestamp: Date.now()
    };
  };

  // Добавление новой активности
  const addNewActivity = () => {
    setActivityFeed(prev => {
      const newActivities = [createRandomActivity(), createRandomActivity()];
      return [...newActivities, ...prev.slice(0, 13)]; // Сохраняем только 15 последних
    });
  };

  // Обработка суммы ставки
  const handleBetAmountChange = (amount: string) => {
    if (amount === 'custom') {
      setBetAmount('custom');
    } else {
      setBetAmount(amount);
      setCustomBetAmount('');
    }
  };

  // Получение текущей суммы ставки
  const getCurrentBetAmount = () => {
    if (betAmount === 'custom') {
      return parseInt(customBetAmount) || 0;
    }
    return parseInt(betAmount) || 0;
  };

  // Быстрая ставка
  const placeBet = async () => {
    const amount = getCurrentBetAmount();
    if (isLoading || !uid || balance < amount || amount <= 0) {
      setMessage('❌ Неверная сумма ставки');
      return;
    }
    
    setIsLoading(true);
    setMessage('');

    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const win = Math.random() * 100 < betChance;
      const payout = win ? Math.floor(amount * (100 / betChance) * 0.95) : 0;
      const rolled = Math.floor(Math.random() * 10000) / 100;
      
      const result = {
        ok: true,
        result: win ? 'win' : 'lose',
        chance: betChance,
        rolled,
        payout,
        balanceDelta: win ? payout - amount : -amount
      };

      setLastBetResult(result);
      setBalance(prev => win ? prev + (payout - amount) : prev - amount);
      
      // Добавляем свою активность в ленту
      const newActivity: GameActivity = {
        id: `game_${Date.now()}`,
        player: userData?.first_name || 'Вы',
        amount: amount,
        result: win ? 'win' : 'lose',
        payout: win ? payout : 0,
        chance: betChance,
        timestamp: Date.now()
      };
      
      setActivityFeed(prev => [newActivity, ...prev.slice(0, 14)]);
      
      const tg = (window as any).Telegram?.WebApp;
      if (win) {
        tg?.HapticFeedback?.impactOccurred?.('heavy');
        setMessage(`🎉 Выигрыш! +${payout}₽`);
      } else {
        tg?.HapticFeedback?.impactOccurred?.('medium');
        setMessage(`💸 Проигрыш: -${amount}₽`);
      }
      
    } catch (error) {
      setMessage('Ошибка ставки');
    } finally {
      setIsLoading(false);
    }
  };

  // Пополнение баланса
  const handleDeposit = () => {
    const amount = depositAmount === 'custom' ? parseInt(customDepositAmount) : parseInt(depositAmount);
    if (amount && amount > 0) {
      setBalance(prev => prev + amount);
      setMessage(`✅ Баланс пополнен на ${amount}₽`);
      setDepositAmount('500');
      setCustomDepositAmount('');
    } else {
      setMessage('❌ Неверная сумма');
    }
  };

  // Заявка на вывод
  const handleWithdrawRequest = () => {
    const amount = withdrawAmount === 'custom' ? parseInt(customWithdrawAmount) : parseInt(withdrawAmount);
    
    if (!amount || amount <= 0) {
      setMessage('❌ Неверная сумма');
      return;
    }
    
    if (balance < amount) {
      setMessage('❌ Недостаточно средств');
      return;
    }
    
    if (!withdrawDetails.trim()) {
      setMessage('❌ Укажите реквизиты');
      return;
    }
    
    const newRequest: WithdrawRequest = {
      id: `wd_${Date.now()}`,
      amount,
      details: withdrawDetails,
      status: 'pending'
    };
    
    setWithdrawRequests(prev => [newRequest, ...prev]);
    setBalance(prev => prev - amount);
    setMessage(`✅ Заявка на вывод ${amount}₽ отправлена админу!`);
    setShowWithdrawForm(false);
    setWithdrawDetails('');
    
    // Симуляция отправки уведомления админу в Telegram
    simulateAdminNotification(newRequest);
  };

  // Симуляция отправки уведомления админу
  const simulateAdminNotification = (request: WithdrawRequest) => {
    console.log('📨 Уведомление админу:', {
      userId: uid,
      amount: request.amount,
      details: request.details,
      requestId: request.id
    });
    
    // В реальном приложении здесь будет отправка в Telegram бота
    setTimeout(() => {
      setMessage('⚡ Админ получил уведомление о выводе');
    }, 2000);
  };

  if (!uid) {
    return (
      <div className="center">
        <div className="card text-center">
          <div className="h1">GVSuti Casino</div>
          <div className="sub">Загрузка...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      {/* Шапка с кнопками в правом верхнем углу */}
      <div className="row between wrap mb-3">
        <div>
          <div className="h1">GVSuti Casino</div>
          <div className="sub">Онлайн: {onlineCount} 👥 | Ваш ID: {uid}</div>
        </div>
        
        <div className="row gap8">
          <div className="card" style={{padding: '12px', minWidth: '120px'}}>
            <div className="h2" style={{margin: '0', fontSize: '20px'}}>{balance.toFixed(0)} ₽</div>
            <div className="sub">Баланс</div>
          </div>
        </div>
      </div>

      {/* Основной контент */}
      <div className="grid">
        
        {/* Левая колонка - Ставки и управление */}
        <div style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
          
          {/* Панель быстрой ставки */}
          <div className="card fade-in">
            <div className="h2">🎯 Быстрая ставка</div>
            
            <div className="mb-3">
              <div className="sub">Сумма ставки</div>
              <div className="row wrap gap8 mb-3">
                {['10', '50', '100', '500', '1000', 'custom'].map((amount) => (
                  <div
                    key={amount}
                    className={`chip ${betAmount === amount ? 'active' : ''}`}
                    onClick={() => handleBetAmountChange(amount)}
                  >
                    {amount === 'custom' ? 'Другая' : `${amount}₽`}
                  </div>
                ))}
              </div>
              
              {betAmount === 'custom' && (
                <input
                  type="number"
                  className="input"
                  value={customBetAmount}
                  onChange={(e) => setCustomBetAmount(e.target.value)}
                  placeholder="Введите сумму"
                  style={{marginBottom: '12px'}}
                />
              )}
            </div>

            <div className="mb-3">
              <div className="sub">Шанс выигрыша: {betChance}%</div>
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

            <div className="mb-3">
              <div className="sub">Ставка на:</div>
              <div className="row gap8">
                <div
                  className={`chip ${betDirection === 'more' ? 'active' : ''}`}
                  onClick={() => setBetDirection('more')}
                  style={{flex: 1, textAlign: 'center'}}
                >
                  Больше {betChance}%
                </div>
                <div
                  className={`chip ${betDirection === 'less' ? 'active' : ''}`}
                  onClick={() => setBetDirection('less')}
                  style={{flex: 1, textAlign: 'center'}}
                >
                  Меньше {betChance}%
                </div>
              </div>
            </div>

            <button
              className="btn w-full"
              onClick={placeBet}
              disabled={isLoading || balance < getCurrentBetAmount()}
              style={{
                opacity: isLoading || balance < getCurrentBetAmount() ? 0.6 : 1
              }}
            >
              {isLoading ? '🎲 Крутим...' : `🎯 Поставить ${getCurrentBetAmount()}₽`}
            </button>

            {lastBetResult && (
              <div className="card mt-3" style={{
                background: lastBetResult.result === 'win' ? 'rgba(34,197,94,0.1)' : 'rgba(249,115,22,0.1)',
                borderColor: lastBetResult.result === 'win' ? '#22c55e' : '#f97316'
              }}>
                {lastBetResult.result === 'win' ? (
                  <span>✅ Выигрыш! Выпало: {lastBetResult.rolled} (+{lastBetResult.payout}₽)</span>
                ) : (
                  <span>❌ Проигрыш. Выпало: {lastBetResult.rolled}</span>
                )}
              </div>
            )}
          </div>

          {/* Управление балансом */}
          <div className="card fade-in">
            <div className="h2">💳 Управление балансом</div>
            
            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px'}}>
              
              {/* Пополнение */}
              <div>
                <div className="sub">Пополнение</div>
                <div className="row wrap gap8 mb-3">
                  {['100', '500', '1000', 'custom'].map((amount) => (
                    <div
                      key={amount}
                      className={`chip ${depositAmount === amount ? 'active' : ''}`}
                      onClick={() => setDepositAmount(amount)}
                    >
                      {amount === 'custom' ? 'Другая' : `${amount}₽`}
                    </div>
                  ))}
                </div>
                
                {depositAmount === 'custom' && (
                  <input
                    type="number"
                    className="input"
                    value={customDepositAmount}
                    onChange={(e) => setCustomDepositAmount(e.target.value)}
                    placeholder="Сумма"
                    style={{marginBottom: '12px'}}
                  />
                )}
                
                <button 
                  className="btn w-full btn-sm"
                  onClick={handleDeposit}
                  style={{background: 'linear-gradient(45deg, #10b981, #34d399)'}}
                >
                  Пополнить
                </button>
              </div>
              
              {/* Вывод */}
              <div>
                <div className="sub">Вывод средств</div>
                <div className="row wrap gap8 mb-3">
                  {['100', '500', '1000', 'custom'].map((amount) => (
                    <div
                      key={amount}
                      className={`chip ${withdrawAmount === amount ? 'active' : ''}`}
                      onClick={() => setWithdrawAmount(amount)}
                    >
                      {amount === 'custom' ? 'Другая' : `${amount}₽`}
                    </div>
                  ))}
                </div>
                
                {withdrawAmount === 'custom' && (
                  <input
                    type="number"
                    className="input"
                    value={customWithdrawAmount}
                    onChange={(e) => setCustomWithdrawAmount(e.target.value)}
                    placeholder="Сумма"
                    style={{marginBottom: '12px'}}
                  />
                )}
                
                <button 
                  className="btn w-full btn-sm"
                  onClick={() => setShowWithdrawForm(true)}
                  style={{background: 'linear-gradient(45deg, #f97316, #fb923c)'}}
                >
                  Вывести
                </button>
              </div>
            </div>

            {/* Форма вывода */}
            {showWithdrawForm && (
              <div className="card mt-3" style={{background: 'rgba(0,0,0,0.3)'}}>
                <div className="h3">Заявка на вывод</div>
                <input
                  type="text"
                  className="input mb-3"
                  value={withdrawDetails}
                  onChange={(e) => setWithdrawDetails(e.target.value)}
                  placeholder="Реквизиты (карта, кошелек и т.д.)"
                />
                <div className="row gap8">
                  <button 
                    className="btn btn-sm"
                    onClick={handleWithdrawRequest}
                    style={{flex: 1, background: 'linear-gradient(45deg, #10b981, #34d399)'}}
                  >
                    Подтвердить
                  </button>
                  <button 
                    className="btn btn-sm"
                    onClick={() => setShowWithdrawForm(false)}
                    style={{flex: 1, background: 'linear-gradient(45deg, #6b7280, #9ca3af)'}}
                  >
                    Отмена
                  </button>
                </div>
              </div>
            )}

            {/* Мои заявки на вывод */}
            {withdrawRequests.length > 0 && (
              <div className="mt-3">
                <div className="sub">Мои заявки на вывод</div>
                {withdrawRequests.map(req => (
                  <div key={req.id} className="card mb-3" style={{padding: '12px', background: 'rgba(255,255,255,0.05)'}}>
                    <div className="row between">
                      <span>{req.amount}₽</span>
                      <span style={{
                        color: req.status === 'approved' ? '#10b981' : 
                               req.status === 'declined' ? '#f97316' : '#f59e0b'
                      }}>
                        {req.status === 'approved' ? '✅ Одобрено' : 
                         req.status === 'declined' ? '❌ Отклонено' : '⏳ Ожидание'}
                      </span>
                    </div>
                    <div className="sub" style={{fontSize: '12px'}}>{req.details}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Правая колонка - Лента активности */}
        <div className="card fade-in">
          <div className="h2">🎮 Активность игроков</div>
          <div className="sub">Обновляется в реальном времени</div>
          
          <div style={{maxHeight: '500px', overflowY: 'auto', marginTop: '12px'}}>
            {activityFeed.map((activity, index) => (
              <div 
                key={activity.id} 
                className="card mb-3 fade-in"
                style={{
                  padding: '12px',
                  background: 'rgba(255,255,255,0.03)',
                  borderLeft: `4px solid ${activity.result === 'win' ? '#10b981' : '#f97316'}`
                }}
              >
                <div className="row between">
                  <span style={{fontWeight: '600'}}>{activity.player}</span>
                  <span>{activity.amount}₽</span>
                </div>
                <div className="row between">
                  <span className="sub">Шанс: {activity.chance}%</span>
                  <span style={{
                    color: activity.result === 'win' ? '#10b981' : '#f97316',
                    fontWeight: '600'
                  }}>
                    {activity.result === 'win' ? `+${activity.payout}₽` : 'Проигрыш'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Всплывающие сообщения */}
      {message && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: message.includes('✅') || message.includes('🎉') ? 
                     'linear-gradient(45deg, #10b981, #34d399)' : 
                     'linear-gradient(45deg, #f97316, #fb923c)',
          padding: '12px 24px',
          borderRadius: '25px',
          color: 'white',
          fontSize: '14px',
          fontWeight: '600',
          boxShadow: '0 8px 25px rgba(0,0,0,0.3)',
          zIndex: 1000
        }}>
          {message}
        </div>
      )}
    </div>
  );
}