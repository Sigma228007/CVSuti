'use client';

import React, { useEffect, useState } from 'react';

export default function Page() {
  const [balance, setBalance] = useState<number | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [uid, setUid] = useState<number | null>(null);

  useEffect(() => {
    // Загружаем данные пользователя из localStorage
    const loadUserData = () => {
      try {
        const savedUser = localStorage.getItem('telegram_user');
        const savedUid = localStorage.getItem('telegram_uid');
        
        if (savedUser && savedUid) {
          setUserData(JSON.parse(savedUser));
          setUid(Number(savedUid));
          fetchBalance(Number(savedUid));
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

    loadUserData();
  }, []);

  const handleLogout = () => {
    // Очищаем localStorage
    localStorage.removeItem('telegram_user');
    localStorage.removeItem('telegram_authenticated');
    localStorage.removeItem('telegram_uid');
    // Обновляем страницу
    window.location.reload();
  };

  if (!uid) {
    return (
      <main style={{ padding: 20, fontFamily: 'Inter, Arial, sans-serif', color: '#e6eef3' }}>
        <div>Загрузка...</div>
      </main>
    );
  }

  return (
    <main style={{ padding: 20, fontFamily: 'Inter, Arial, sans-serif', color: '#e6eef3' }}>
      <h1 style={{ marginBottom: 12 }}>GVSuti — мини-казино</h1>

      <div style={{
        maxWidth: 900,
        background: '#0f1720',
        padding: 18,
        borderRadius: 12,
        boxShadow: '0 6px 24px rgba(0,0,0,0.25)'
      }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontWeight: 700 }}>UID:</div>
          <div>{uid}</div>
          <div style={{ marginLeft: 'auto', fontWeight: 700 }}>Баланс:</div>
          <div>{(balance ?? 0).toFixed(2)} ₽</div>
        </div>

        {userData && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontWeight: 700 }}>Пользователь:</div>
            <div>{userData.first_name} {userData.username ? `(@${userData.username})` : ''}</div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button className="btn" onClick={() => window.location.href = '/pay'}>Пополнить</button>
          <button className="btn-outline" onClick={() => window.location.href = '/withdraw'}>Вывести</button>
          <button className="btn-outline" onClick={() => window.location.href = '/profile'}>Профиль</button>
          <button 
            className="btn-outline" 
            onClick={handleLogout}
            style={{ backgroundColor: '#dc3545', color: 'white' }}
          >
            Выйти
          </button>
        </div>

        <div style={{ marginTop: 12, color: '#9aa9bd' }}>
          <small>Быстрые ставки: 100 / 500 / 1000 ₽ (настройки в UI)</small>
        </div>
      </div>

      <section style={{ marginTop: 18 }}>
        <h2 style={{ fontSize: 18 }}>Последние 10 игр</h2>
        <div className="card" style={{ marginTop: 8 }}>
          <div className="sub">Здесь будет список последних игр (демо)</div>
        </div>
      </section>
    </main>
  );
}