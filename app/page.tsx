'use client';

import React, { useEffect, useState } from 'react';

export default function Page() {
  const [loading, setLoading] = useState(true);
  const [uid, setUid] = useState<number | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [userData, setUserData] = useState<any>(null);

  useEffect(() => {
    const loadUserData = () => {
      try {
        // Проверяем данные из localStorage
        const savedAuth = localStorage.getItem('telegram_authenticated');
        const savedUser = localStorage.getItem('telegram_user');
        const savedUid = localStorage.getItem('telegram_uid');

        if (savedAuth === 'true' && savedUser && savedUid) {
          setUid(Number(savedUid));
          setUserData(JSON.parse(savedUser));
          
          // Загружаем баланс с сервера
          fetchBalance(Number(savedUid));
        } else {
          setLoading(false);
        }
      } catch (error) {
        console.error('Error loading user data:', error);
        setLoading(false);
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
      } finally {
        setLoading(false);
      }
    };

    loadUserData();
  }, []);

  // Try to open telegram auth (if env is WebApp)
  function openTelegramAuth() {
    try {
      const tg = (window as any)?.Telegram?.WebApp;
      if (tg && typeof tg.openAuth === 'function') {
        tg.openAuth();
        return;
      }
    } catch {}
    alert('Откройте мини-приложение через нашего бота в Telegram.');
  }

  if (loading) {
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
        {uid ? (
          <>
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
            </div>

            <div style={{ marginTop: 12, color: '#9aa9bd' }}>
              <small>Быстрые ставки: 100 / 500 / 1000 ₽ (настройки в UI)</small>
            </div>
          </>
        ) : (
          <>
            <div style={{ marginBottom: 12, color: '#e6eef3' }}>
              Для использования приложения необходим вход через Telegram.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn" onClick={openTelegramAuth}>Войти через Telegram</button>
            </div>
          </>
        )}
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