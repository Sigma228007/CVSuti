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
        console.log('initDataUnsafe:', tg.WebApp.initDataUnsafe);
        
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
            }
          })
          .catch(error => {
            console.error('Auth error:', error);
          });
        } else {
          console.warn('initData is empty!');
        }
      } else {
        console.warn('Telegram WebApp not available');
      }
    };

    // Проверяем сразу и с задержкой
    checkTelegramData();
    setTimeout(checkTelegramData, 1000);
    setTimeout(checkTelegramData, 3000);

  }, []);

  return null;
}