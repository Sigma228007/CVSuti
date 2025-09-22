'use client';

import { useEffect } from 'react';

export default function InitAuth() {
  useEffect(() => {
    console.log('InitAuth component mounted');
    
    const checkTelegramData = () => {
      const tg = (window as any).Telegram;
      console.log('Telegram object:', tg);
      
      if (tg?.WebApp) {
        console.log('WebApp available');
        console.log('initData:', tg.WebApp.initData);
        
        if (tg.WebApp.initData) {
          // Автоматически отправляем на сервер для авторизации
          fetch('/api/auth', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ initData: tg.WebApp.initData }),
          })
          .then(response => response.json())
          .then(data => {
            console.log('Auth response:', data);
            if (data.success) {
              console.log('User authenticated:', data.user);
              // СОХРАНЯЕМ В LOCALSTORAGE
              localStorage.setItem('telegram_user', JSON.stringify(data.user));
              localStorage.setItem('telegram_authenticated', 'true');
            }
          })
          .catch(error => {
            console.error('Auth error:', error);
          });
        }
      }
    };

    checkTelegramData();
    setTimeout(checkTelegramData, 1000);

  }, []);

  return null;
}