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
            localStorage.setItem('tg_uid', data.user.id.toString());
            localStorage.setItem('tg_token', 'telegram_auth'); // Простой токен для совместимости
            
            if (!window.location.search.includes('token=')) {
              const newUrl = new URL(window.location.href);
              newUrl.searchParams.set('token', 'telegram_auth');
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
  
  const [betAmount, setBetAmount] = useState<number>(100);
  const [betChance, setBetChance] = useState<number>(50);
  const [betDirection, setBetDirection] = useState<'more' | 'less'>('more');
  const [lastBetResult, setLastBetResult] = useState<BetResult | null>(null);

  // Получаем заголовки для API запросов
  const getAuthHeaders = () => {
    const initData = (window as any).Telegram?.WebApp?.initData;
    
    return {
      'Content-Type': 'application/json',
      ...(initData && { 'X-Telegram-Init-Data': initData })
    };
  };

  // Проверка статуса депозита
  const checkDepositStatus = async (depositId: string) => {
    try {
      const response = await fetch(`/api/deposit/pending?id=${depositId}`, {
        method: 'GET',
        headers: getAuthHeaders()
      });
      
      const data = await response.json();
      if (data.ok) {
        if (data.deposit.status === 'approved') {
          setMessage(`✅ Баланс пополнен на ${data.deposit.amount}₽!`);
          await fetchBalance();
          
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.delete('deposit_id');
          window.history.replaceState({}, '', newUrl.toString());
        } else if (data.deposit.status === 'pending') {
          setMessage('⏳ Платеж обрабатывается...');
          setTimeout(() => checkDepositStatus(depositId), 5000);
        }
      }
    } catch (error) {
      console.error('Error checking deposit status:', error);
    }
  };

  useEffect(() => {
    loadUserData();
    
    const urlParams = new URLSearchParams(window.location.search);
    const depositId = urlParams.get('deposit_id');
    
    if (depositId) {
      checkDepositStatus(depositId);
    }
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
          localStorage.setItem('tg_uid', data.user.id.toString());
          setUserData(data.user);
          setUid(data.user.id);
          setBalance(data.balance || 0);
        }
      }
    } catch (error) {
      console.error('Reauth failed:', error);
    }
  };

  // Функция ставки - ИСПРАВЛЕНА
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
        setIsLoading(false);
        return;
      }

      const response = await fetch('/api/bet', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          initData, // Передаем initData в теле запроса
          amount: betAmount,
          chance: betChance,
          dir: betDirection,
        }),
      });

      const result: BetResult = await response.json();
      
      if (!response.ok) {
        if (response.status === 400) {
          setMessage(`Ошибка: ${result.error || 'Неправильные параметры ставки'}`);
        } else if (response.status === 401) {
          setMessage('Ошибка авторизации. Обновите страницу.');
          await reauthenticate();
        } else {
          setMessage(`Ошибка сервера: ${response.status}`);
        }
        return;
      }

      setLastBetResult(result);

      if (result.ok) {
        await fetchBalance();
        
        try {
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
      setMessage('Ошибка сети. Проверьте соединение.');
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
        headers: getAuthHeaders(),
        body: JSON.stringify({ amount }),
      });

      const data = await response.json();

      if (data.ok) {
        const returnUrl = new URL('/fk/success', window.location.origin);
        returnUrl.searchParams.set('deposit_id', data.deposit.id);
        
        window.location.href = `/pay/${data.deposit.id}?url=${encodeURIComponent(data.payUrl)}&return=${encodeURIComponent(returnUrl.toString())}`;
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

  // Вывод средств
  const handleWithdraw = async (amount: number) => {
    if (isLoading || balance < amount) return;
    
    if (!confirm(`Создать заявку на вывод ${amount}₽?`)) return;
    
    setIsLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/withdraw/create', {
        method: 'POST',
        headers: getAuthHeaders(),
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
        <InitAuth />
        <div className="card">Загрузка...</div>
      </main>
    );
  }

  return (
    <main className="container">
      <InitAuth />
      
      {/* Остальная часть кода без изменений */}
      {/* ... */}
    </main>
  );
}