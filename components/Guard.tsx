"use client";
import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

// Страницы которые не требуют авторизации
const PUBLIC_PAGES = ['/fk/success', '/fk/error', '/fk/', '/api/'];

export default function Guard({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const pathname = usePathname();

  useEffect(() => {
    checkAuthStatus();
  }, [pathname]);

  const isPublicPage = PUBLIC_PAGES.some(page => pathname?.startsWith(page));

  const checkAuthStatus = () => {
    if (isPublicPage) {
      // Публичные страницы - пропускаем без проверки
      setIsAuthenticated(true);
      setIsLoading(false);
      return;
    }

    // Для защищенных страниц проверяем авторизацию
    const savedAuth = localStorage.getItem('tg_auth');
    const savedUid = localStorage.getItem('tg_uid');
    
    const authenticated = savedAuth === 'true' && Boolean(savedUid);
    setIsAuthenticated(authenticated);
    setIsLoading(false);
  };

  if (isLoading) {
    return (
      <div className="center">
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <div className="h2">Загрузка...</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated && !isPublicPage) {
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
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}