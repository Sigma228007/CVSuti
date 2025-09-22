"use client";
import { useEffect } from "react";
import { saveInitData } from "@/lib/webapp";

export default function InitAuth() {
  useEffect(() => {
    const initAuth = async () => {
      try {
        const w = window as any;
        const tg = w?.Telegram?.WebApp;
        
        // Инициализируем Telegram WebApp
        if (tg?.ready) {
          tg.ready();
          tg.expand(); // Раскрываем на весь экран
        }

        // Получаем initData всеми способами
        let initData = '';
        
        // 1. Из Telegram WebApp
        if (tg?.initData) {
          initData = tg.initData;
        }
        
        // 2. Из URL параметров
        if (!initData) {
          const url = new URL(window.location.href);
          initData = url.searchParams.get('tgWebAppData') || 
                     url.searchParams.get('initData') || 
                     '';
        }

        // 3. Из hash
        if (!initData) {
          const hashParams = new URLSearchParams(window.location.hash.slice(1));
          initData = hashParams.get('tgWebAppData') || 
                     hashParams.get('initData') || 
                     '';
        }

        if (initData) {
          // Сохраняем для последующего использования
          saveInitData(initData);

          // Отправляем на сервер
          await fetch('/api/auth', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Init-Data': initData,
            },
            body: JSON.stringify({ initData }),
            credentials: 'include'
          });
        }

      } catch (error) {
        console.error('Init auth error:', error);
      }
    };

    initAuth();
  }, []);

  return null;
}