"use client";
import React, { useEffect, useState } from "react";

export default function Guard({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = () => {
    // Простая проверка localStorage - без серверных запросов
    const savedAuth = localStorage.getItem('tg_auth');
    const savedUid = localStorage.getItem('tg_uid');
    
    // Явно преобразуем в boolean
    const authenticated = savedAuth === 'true' && Boolean(savedUid);
    setIsAuthenticated(authenticated);
    setIsLoading(false);
  };

  if (isLoading) {
    return (
      <div className="center">
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <div className="h2">Проверка авторизации...</div>
          <div className="sub">Загрузка приложения</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="center">
        <div className="card" style={{ textAlign: 'center', maxWidth: '400px' }}>
          <div className="h2" style={{ color: '#f59e0b', marginBottom: '16px' }}>
            Требуется авторизация
          </div>
          <div className="sub" style={{ marginBottom: '20px' }}>
            Для доступа к приложению необходимо войти через Telegram
          </div>
          
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button 
              className="btn"
              onClick={() => {
                // Пробуем открыть в Telegram
                const tg = (window as any).Telegram?.WebApp;
                if (tg) {
                  tg.expand();
                  window.location.reload();
                } else {
                  window.location.reload();
                }
              }}
            >
              Войти через Telegram
            </button>
            <button 
              className="btn-outline"
              onClick={() => window.location.reload()}
            >
              Обновить страницу
            </button>
          </div>
          
          <div className="info" style={{ marginTop: '16px' }}>
            <small>Откройте приложение через бота в Telegram для автоматической авторизации</small>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}