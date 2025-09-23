'use client';

import { useEffect } from 'react';

export default function InitAuth() {
  useEffect(() => {
    console.log('InitAuth component mounted');
    
    const checkTelegramData = async () => {
      try {
        const tg = (window as any).Telegram?.WebApp;
        
        if (tg?.initData) {
          console.log('Telegram WebApp detected, initData:', tg.initData);
          
          const response = await fetch('/api/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ initData: tg.initData }),
          });
          
          const data = await response.json();
          console.log('Auth response:', data);
          
          if (data.ok) {
            console.log('User authenticated successfully');
            // Сохраняем минимальные данные для Guard
            localStorage.setItem('tg_auth', 'true');
            localStorage.setItem('tg_uid', data.uid.toString());
            localStorage.setItem('tg_user', JSON.stringify(data.user));
          }
        } else {
          console.log('No Telegram WebApp detected');
          // Проверяем существующую авторизацию
          const existingAuth = localStorage.getItem('tg_auth');
          if (existingAuth !== 'true') {
            localStorage.removeItem('tg_uid');
            localStorage.removeItem('tg_user');
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
      }
    };

    checkTelegramData();
  }, []);

  return null;
}