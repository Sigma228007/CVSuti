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
    const savedAuth = localStorage.getItem('telegram_authenticated');
    const savedUid = localStorage.getItem('telegram_uid');
    
    if (savedAuth === 'true' && savedUid) {
      setIsAuthenticated(true);
    } else {
      setIsAuthenticated(false);
    }
    
    setIsLoading(false);
  };

  if (isLoading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh' 
      }}>
        <div>Проверка авторизации...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        flexDirection: 'column',
        padding: '20px',
        textAlign: 'center'
      }}>
        <h2>Требуется авторизация</h2>
        <p>Пожалуйста, войдите через Telegram</p>
        <div style={{ marginTop: '10px', color: '#9aa9bd', fontSize: '14px' }}>
          Если вы уже авторизованы, попробуйте обновить страницу
        </div>
        <button 
          onClick={() => window.location.reload()}
          style={{
            padding: '10px 20px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            marginTop: '10px'
          }}
        >
          Обновить страницу
        </button>
      </div>
    );
  }

  return <>{children}</>;
}