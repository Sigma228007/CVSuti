'use client';

import { useEffect } from 'react';

export default function InitAuth() {
  useEffect(() => {
    console.log('InitAuth component mounted');
    
    const checkTelegramData = async () => {
      const tg = (window as any).Telegram;
      console.log('Telegram object:', tg);
      
      if (tg?.WebApp?.initData) {
        console.log('WebApp available, initData:', tg.WebApp.initData);
        
        try {
          const response = await fetch('/api/auth', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ initData: tg.WebApp.initData }),
          });
          
          const data = await response.json();
          console.log('Auth response:', data);
          
          if (data.ok) {
            console.log('User authenticated:', data.user);
            // Сохраняем в localStorage
            localStorage.setItem('telegram_user', JSON.stringify(data.user));
            localStorage.setItem('telegram_authenticated', 'true');
            localStorage.setItem('telegram_uid', data.uid.toString());
            
            // Обновляем страницу для применения авторизации
            window.location.reload();
          }
        } catch (error) {
          console.error('Auth error:', error);
        }
      } else {
        console.log('No initData available');
        // Проверяем существующую авторизацию
        checkExistingAuth();
      }
    };

    const checkExistingAuth = async () => {
      try {
        const response = await fetch('/api/balance');
        if (response.ok) {
          const data = await response.json();
          if (data.ok) {
            localStorage.setItem('telegram_authenticated', 'true');
            localStorage.setItem('telegram_uid', data.uid.toString());
          }
        }
      } catch (error) {
        console.log('Not authenticated on server');
      }
    };

    checkTelegramData();
  }, []);

  return null;
}