'use client';

import { useEffect } from 'react';
import { generateToken } from '@/lib/session';

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
            
            // Сохраняем данные
            localStorage.setItem('tg_auth', 'true');
            localStorage.setItem('tg_uid', data.uid.toString());
            localStorage.setItem('tg_user', JSON.stringify(data.user));
            localStorage.setItem('tg_token', data.token);
            
            // Добавляем токен в URL для API запросов
            if (!window.location.search.includes('token=')) {
              const newUrl = new URL(window.location.href);
              newUrl.searchParams.set('token', data.token);
              window.history.replaceState({}, '', newUrl.toString());
            }
          }
        } else {
          console.log('No Telegram WebApp detected');
          // Проверяем существующий токен
          const existingToken = localStorage.getItem('tg_token');
          if (existingToken) {
            localStorage.setItem('tg_auth', 'true');
          } else {
            localStorage.removeItem('tg_auth');
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