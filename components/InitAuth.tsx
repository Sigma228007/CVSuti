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
            
            // НЕ обновляем страницу - Guard сам перерендерит интерфейс
            console.log('Auth completed successfully');
          }
        } catch (error) {
          console.error('Auth error:', error);
        }
      } else {
        console.log('No initData available');
      }
    };

    // Запускаем проверку только один раз
    checkTelegramData();
  }, []);

  return null;
}