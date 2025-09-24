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
  const [lastBetResult, setLastBetResult] = useState<BetResult | null>(null);

  // Пополнение/вывод
  const [depositAmount, setDepositAmount] = useState<string>('500');
  const [customDepositAmount, setCustomDepositAmount] = useState<string>('');
  const [withdrawAmount, setWithdrawAmount] = useState<string>('500');
  const [customWithdrawAmount, setCustomWithdrawAmount] = useState<string>('');
  const [withdrawDetails, setWithdrawDetails] = useState<string>('');
  const [showWithdrawForm, setShowWithdrawForm] = useState<boolean>(false);
  const [withdrawRequests, setWithdrawRequests] = useState<WithdrawRequest[]>([]);

  // Админ-панель
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [adminWithdrawals, setAdminWithdrawals] = useState<WithdrawRequest[]>([]);

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
          
          const initData = tg.initData;
          if (initData) {
            const user = tg.initDataUnsafe?.user || {
              id: Math.floor(Math.random() * 1000000),
              first_name: 'Игрок',
              username: 'player'
            };
            
            setUserData(user);
            setUid(user.id);
            setBalance(1000);
            
            // Проверяем админа
            if (user.id === 999217382) { // Ваш UID
              setIsAdmin(true);
              loadAdminWithdrawals();
            }
            
            localStorage.setItem('tg_user', JSON.stringify(user));
            localStorage.setItem('tg_uid', user.id.toString());
          }
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
    generateActivityFeed();
    
    const onlineInterval = setInterval(() => {
      setOnlineCount(prev => Math.min(100, Math.max(25, prev + (Math.random() > 0.5 ? 1 : -1))));
    }, 5000);

    return () => clearInterval(onlineInterval);
  }, []);

  // Загрузка заявок на вывод для админа
  const loadAdminWithdrawals = () => {
    const requests: WithdrawRequest[] = [
      { id: 'wd_1', amount: 500, details: 'Карта **** 1234', status: 'pending' },
      { id: 'wd_2', amount: 1000, details: 'Qiwi: +79123456789', status: 'pending' },
      { id: 'wd_3', amount: 300, details: 'ЮMoney: 410011234567890', status: 'pending' }
    ];
    setAdminWithdrawals(requests);
  };

  // Генерация ленты активности
  const generateActivityFeed = () => {
    const activities: GameActivity[] = [];
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
      
      const result: BetResult = {
        ok: true,
        result: win ? 'win' : 'lose',
        chance: betChance,
        rolled,
        payout,
        balanceDelta: win ? payout - amount : -amount
      };

      setLastBetResult(result);
      setBalance(prev => win ? prev + (payout - amount) : prev - amount);
      
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
    setBalance(prev => prev - amount); // Резервируем средства
    setMessage(`✅ Заявка на вывод ${amount}₽ создана!`);
    setShowWithdrawForm(false);
    setWithdrawDetails('');
    
    // Если админ онлайн, добавляем в его список
    if (isAdmin) {
      setAdminWithdrawals(prev => [newRequest, ...prev]);
    }
  };

  // Одобрение вывода (админ)
  const approveWithdrawal = (requestId: string) => {
    setAdminWithdrawals(prev => 
      prev.map(req => req.id === requestId ? { ...req, status: 'approved' } : req)
    );
    
    setWithdrawRequests(prev =>
      prev.map(req => req.id === requestId ? { ...req, status: 'approved' } : req)
    );
    
    setMessage('✅ Вывод одобрен');
  };

  // Отклонение вывода (админ)
  const declineWithdrawal = (requestId: string) => {
    const request = adminWithdrawals.find(req => req.id === requestId);
    if (request) {
      setBalance(prev => prev + request.amount); // Возвращаем средства
    }
    
    setAdminWithdrawals(prev => 
      prev.map(req => req.id === requestId ? { ...req, status: 'declined' } : req)
    );
    
    setWithdrawRequests(prev =>
      prev.map(req => req.id === requestId ? { ...req, status: 'declined' } : req)
    );
    
    setMessage('❌ Вывод отклонен');
  };

  if (!uid) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        background: 'linear-gradient(135deg, #1e3c72, #2a5298)',
        color: 'white'
      }}>
        <div>Загрузка...</div>
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f0f0f, #1a1a1a)',
      color: 'white',
      padding: '20px',
      fontFamily: 'Arial, sans-serif'
    }}>
      {/* Шапка */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '20px',
        flexWrap: 'wrap'
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>🎰 GVSuti Casino</h1>
          <div style={{ fontSize: '14px', opacity: 0.8 }}>Онлайн: {onlineCount} 👥</div>
          {isAdmin && <div style={{ color: 'gold', fontSize: '12px' }}>⚡ Режим администратора</div>}
        </div>
        
        <div style={{ display: 'flex', gap: '10px', flexDirection: 'column', alignItems: 'flex-end' }}>
          <div style={{ background: 'rgba(255,255,255,0.1)', padding: '10px 15px', borderRadius: '10px', textAlign: 'right' }}>
            <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{balance.toFixed(2)} ₽</div>
            <div style={{ fontSize: '12px', opacity: 0.8 }}>Баланс</div>
          </div>
        </div>
      </div>

      {/* Основной контент */}
      <div style={{ display: 'grid', gridTemplateColumns: isAdmin ? '1fr 400px' : '1fr 300px', gap: '20px' }}>
        
        {/* Левая колонка - Ставки */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '20px', borderRadius: '15px' }}>
            <h2 style={{ marginTop: 0 }}>🎯 Быстрая ставка</h2>
            
            <div style={{ marginBottom: '15px' }}>
              <div style={{ marginBottom: '10px' }}>Сумма ставки</div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
                {['10', '50', '100', '500', '1000', 'custom'].map((amount) => (
                  <button
                    key={amount}
                    onClick={() => handleBetAmountChange(amount)}
                    style={{
                      background: betAmount === amount ? 'green' : 'rgba(255,255,255,0.1)',
                      border: 'none',
                      padding: '10px 15px',
                      borderRadius: '5px',
                      color: 'white',
                      cursor: 'pointer'
                    }}
                  >
                    {amount === 'custom' ? 'Другая' : `${amount}₽`}
                  </button>
                ))}
              </div>
              
              {betAmount === 'custom' && (
                <input
                  type="number"
                  value={customBetAmount}
                  onChange={(e) => setCustomBetAmount(e.target.value)}
                  placeholder="Введите сумму"
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '5px',
                    border: '1px solid rgba(255,255,255,0.2)',
                    background: 'rgba(255,255,255,0.1)',
                    color: 'white'
                  }}
                />
              )}
            </div>

            <div style={{ marginBottom: '15px' }}>
              <div style={{ marginBottom: '10px' }}>Шанс выигрыша: {betChance}%</div>
              <input
                type="range"
                value={betChance}
                onChange={(e) => setBetChance(Number(e.target.value))}
                min="5"
                max="95"
                step="5"
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <div style={{ marginBottom: '10px' }}>Ставка на:</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setBetDirection('more')}
                  style={{
                    background: betDirection === 'more' ? 'green' : 'rgba(255,255,255,0.1)',
                    border: 'none',
                    padding: '10px 15px',
                    borderRadius: '5px',
                    color: 'white',
                    cursor: 'pointer',
                    flex: 1
                  }}
                >
                  Больше {betChance}%
                </button>
                <button
                  onClick={() => setBetDirection('less')}
                  style={{
                    background: betDirection === 'less' ? 'green' : 'rgba(255,255,255,0.1)',
                    border: 'none',
                    padding: '10px 15px',
                    borderRadius: '5px',
                    color: 'white',
                    cursor: 'pointer',
                    flex: 1
                  }}
                >
                  Меньше {betChance}%
                </button>
              </div>
            </div>

            <button
              onClick={placeBet}
              disabled={isLoading || balance < getCurrentBetAmount()}
              style={{
                background: isLoading || balance < getCurrentBetAmount() ? 'gray' : 'linear-gradient(45deg, #FF6B6B, #4ECDC4)',
                border: 'none',
                padding: '15px',
                borderRadius: '10px',
                color: 'white',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: isLoading || balance < getCurrentBetAmount() ? 'not-allowed' : 'pointer',
                width: '100%'
              }}
            >
              {isLoading ? '🎲 Крутим...' : `🎯 Поставить ${getCurrentBetAmount()}₽`}
            </button>

            {lastBetResult && (
              <div style={{
                marginTop: '15px',
                padding: '10px',
                background: lastBetResult.result === 'win' ? 'rgba(0,255,0,0.1)' : 'rgba(255,0,0,0.1)',
                borderRadius: '5px',
                border: `1px solid ${lastBetResult.result === 'win' ? 'green' : 'red'}`
              }}>
                {lastBetResult.result === 'win' ? (
                  <span>✅ Выигрыш! Выпало: {lastBetResult.rolled} (+{lastBetResult.payout}₽)</span>
                ) : (
                  <span>❌ Проигрыш. Выпало: {lastBetResult.rolled}</span>
                )}
              </div>
            )}
          </div>

          {/* Пополнение и вывод */}
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '20px', borderRadius: '15px' }}>
            <h3>💳 Управление балансом</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
              <div>
                <div style={{ marginBottom: '10px' }}>Пополнение</div>
                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '10px' }}>
                  {['100', '500', '1000', 'custom'].map((amount) => (
                    <button
                      key={amount}
                      onClick={() => setDepositAmount(amount)}
                      style={{
                        background: depositAmount === amount ? 'green' : 'rgba(255,255,255,0.1)',
                        border: 'none',
                        padding: '5px 10px',
                        borderRadius: '3px',
                        color: 'white',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      {amount === 'custom' ? 'Другая' : `${amount}₽`}
                    </button>
                  ))}
                </div>
                
                {depositAmount === 'custom' && (
                  <input
                    type="number"
                    value={customDepositAmount}
                    onChange={(e) => setCustomDepositAmount(e.target.value)}
                    placeholder="Сумма"
                    style={{ width: '100%', padding: '8px', borderRadius: '5px', marginBottom: '10px' }}
                  />
                )}
                
                <button onClick={handleDeposit} style={{ width: '100%', padding: '10px', background: 'green', border: 'none', borderRadius: '5px', color: 'white', cursor: 'pointer' }}>
                  Пополнить
                </button>
              </div>
              
              <div>
                <div style={{ marginBottom: '10px' }}>Вывод</div>
                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '10px' }}>
                  {['100', '500', '1000', 'custom'].map((amount) => (
                    <button
                      key={amount}
                      onClick={() => setWithdrawAmount(amount)}
                      style={{
                        background: withdrawAmount === amount ? 'green' : 'rgba(255,255,255,0.1)',
                        border: 'none',
                        padding: '5px 10px',
                        borderRadius: '3px',
                        color: 'white',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      {amount === 'custom' ? 'Другая' : `${amount}₽`}
                    </button>
                  ))}
                </div>
                
                {withdrawAmount === 'custom' && (
                  <input
                    type="number"
                    value={customWithdrawAmount}
                    onChange={(e) => setCustomWithdrawAmount(e.target.value)}
                    placeholder="Сумма"
                    style={{ width: '100%', padding: '8px', borderRadius: '5px', marginBottom: '10px' }}
                  />
                )}
                
                <button onClick={() => setShowWithdrawForm(true)} style={{ width: '100%', padding: '10px', background: 'red', border: 'none', borderRadius: '5px', color: 'white', cursor: 'pointer' }}>
                  Вывести
                </button>
              </div>
            </div>

            {/* Форма вывода */}
            {showWithdrawForm && (
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '15px', borderRadius: '10px', marginTop: '10px' }}>
                <h4>Заявка на вывод</h4>
                <input
                  type="text"
                  value={withdrawDetails}
                  onChange={(e) => setWithdrawDetails(e.target.value)}
                  placeholder="Реквизиты (карта, кошелек и т.д.)"
                  style={{ width: '100%', padding: '10px', borderRadius: '5px', marginBottom: '10px', background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)' }}
                />
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={handleWithdrawRequest} style={{ flex: 1, padding: '10px', background: 'green', border: 'none', borderRadius: '5px', color: 'white', cursor: 'pointer' }}>
                    Подтвердить
                  </button>
                  <button onClick={() => setShowWithdrawForm(false)} style={{ flex: 1, padding: '10px', background: 'gray', border: 'none', borderRadius: '5px', color: 'white', cursor: 'pointer' }}>
                    Отмена
                  </button>
                </div>
              </div>
            )}

            {/* Мои заявки на вывод */}
            {withdrawRequests.length > 0 && (
              <div style={{ marginTop: '15px' }}>
                <h4>Мои заявки</h4>
                {withdrawRequests.map(req => (
                  <div key={req.id} style={{ padding: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '5px', marginBottom: '5px', fontSize: '12px' }}>
                    <div>Сумма: {req.amount}₽ | Статус: 
                      <span style={{ color: req.status === 'approved' ? 'green' : req.status === 'declined' ? 'red' : 'orange' }}>
                        {req.status === 'approved' ? ' Одобрено' : req.status === 'declined' ? ' Отклонено' : ' В обработке'}
                      </span>
                    </div>
                    <div style={{ opacity: 0.8 }}>Реквизиты: {req.details}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Правая колонка */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Лента активности */}
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '15px', maxHeight: '300px', overflowY: 'auto' }}>
            <h3 style={{ marginTop: 0 }}>🎮 Активность игроков</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {activityFeed.map((activity) => (
                <div key={activity.id} style={{ background: 'rgba(255,255,255,0.05)', padding: '8px', borderRadius: '5px', fontSize: '11px', borderLeft: `3px solid ${activity.result === 'win' ? 'green' : 'red'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 'bold' }}>{activity.player}</span>
                    <span>{activity.amount}₽</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', opacity: 0.8 }}>
                    <span>Шанс: {activity.chance}%</span>
                    <span style={{ color: activity.result === 'win' ? 'green' : 'red' }}>
                      {activity.result === 'win' ? `+${activity.payout}₽` : 'Проигрыш'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Админ-панель */}
          {isAdmin && (
            <div style={{ background: 'rgba(255,215,0,0.1)', padding: '15px', borderRadius: '15px', border: '1px solid gold' }}>
              <h3 style={{ marginTop: 0, color: 'gold' }}>⚡ Админ-панель</h3>
              <div style={{ fontSize: '12px', marginBottom: '10px' }}>Заявки на вывод:</div>
              
              {adminWithdrawals.length === 0 ? (
                <div style={{ opacity: 0.7, fontSize: '12px' }}>Нет заявок</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {adminWithdrawals.map(req => (
                    <div key={req.id} style={{ background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '5px', fontSize: '11px' }}>
                      <div><strong>{req.amount}₽</strong> - {req.details}</div>
                      <div style={{ opacity: 0.8 }}>Статус: 
                        <span style={{ color: req.status === 'approved' ? 'green' : req.status === 'declined' ? 'red' : 'orange' }}>
                          {req.status === 'approved' ? ' Одобрено' : req.status === 'declined' ? ' Отклонено' : ' Ожидание'}
                        </span>
                      </div>
                      
                      {req.status === 'pending' && (
                        <div style={{ display: 'flex', gap: '5px', marginTop: '5px' }}>
                          <button 
                            onClick={() => approveWithdrawal(req.id)}
                            style={{ flex: 1, padding: '5px', background: 'green', border: 'none', borderRadius: '3px', color: 'white', cursor: 'pointer', fontSize: '10px' }}
                          >
                            Одобрить
                          </button>
                          <button 
                            onClick={() => declineWithdrawal(req.id)}
                            style={{ flex: 1, padding: '5px', background: 'red', border: 'none', borderRadius: '3px', color: 'white', cursor: 'pointer', fontSize: '10px' }}
                          >
                            Отклонить
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Сообщения */}
      {message && (
        <div style={{
          position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
          background: message.includes('✅') || message.includes('🎉') ? 'green' : 'red',
          padding: '10px 20px', borderRadius: '20px', color: 'white', fontSize: '14px'
        }}>
          {message}
        </div>
      )}
    </div>
  );
}