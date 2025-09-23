'use client';

import React, { useEffect, useState } from 'react';

export default function Page() {
  const [balance, setBalance] = useState<number>(0);
  const [userData, setUserData] = useState<any>(null);
  const [uid, setUid] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<string>('');

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
        await fetchBalance(Number(savedUid));
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const fetchBalance = async (userId: number) => {
    try {
      const response = await fetch('/api/balance');
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

  // Пополнение баланса
  const handleDeposit = async (amount: number) => {
    if (isLoading) return;
    
    setIsLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/deposit/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      });

      const data = await response.json();

      if (data.ok) {
        // Перенаправляем на страницу ожидания оплаты
        window.location.href = `/pay/${data.deposit.id}?url=${encodeURIComponent(data.payUrl)}`;
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
  const handleWithdraw = async (amount: number) => {
    if (isLoading || balance < amount) return;
    
    if (!confirm(`Создать заявку на вывод ${amount}₽?`)) return;
    
    setIsLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/withdraw/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          amount,
          details: { method: 'standard' }
        }),
      });

      const data = await response.json();

      if (data.ok) {
        setMessage(`✅ Заявка на вывод ${amount}₽ создана! Ожидайте подтверждения.`);
        await fetchBalance(uid!);
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
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <div className="h2">Загрузка...</div>
        </div>
      </main>
    );
  }

  return (
    <main className="container">
      {/* Шапка с балансом */}
      <div className="card lift">
        <div className="row between">
          <div>
            <div className="h1">GVSuti</div>
            <div className="sub">Мини-казино</div>
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

      {/* Быстрое пополнение */}
      <div className="card">
        <div className="h2">Быстрое пополнение</div>
        <div className="sub">Выберите сумму для пополнения баланса</div>
        
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '16px' }}>
          {[100, 500, 1000, 2000, 5000].map((amount) => (
            <button
              key={amount}
              className="btn"
              onClick={() => handleDeposit(amount)}
              disabled={isLoading}
              style={{ flex: '1', minWidth: '80px' }}
            >
              +{amount}₽
            </button>
          ))}
        </div>
      </div>

      {/* Вывод средств */}
      <div className="card">
        <div className="h2">Вывод средств</div>
        <div className="sub">Заявка на вывод (обрабатывается вручную)</div>
        
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '16px' }}>
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

        {balance < 100 && (
          <div className="info" style={{ marginTop: '12px' }}>
            Минимальная сумма для вывода: 100₽
          </div>
        )}
      </div>

      {/* Действия */}
      <div className="card">
        <div className="h2">Действия</div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button 
            className="btn-outline" 
            onClick={() => window.location.href = '/profile'}
          >
            📊 Профиль и история
          </button>
          <button 
            className="btn-outline"
            onClick={() => {
              localStorage.clear();
              window.location.reload();
            }}
          >
            🔐 Выйти
          </button>
        </div>
      </div>

      {/* Сообщения */}
      {message && (
        <div className="card" style={{ borderColor: message.includes('✅') ? '#22c55e' : '#ef4444' }}>
          <div className="sub">{message}</div>
        </div>
      )}

      {/* Информация */}
      <div className="card">
        <div className="h2">Информация</div>
        <div className="sub" style={{ lineHeight: '1.5' }}>
          • Пополнение через FreeKassa<br/>
          • Вывод обрабатывается вручную<br/>
          • Поддержка: @{process.env.NEXT_PUBLIC_BOT_NAME || 'admin'}
        </div>
      </div>
    </main>
  );
}