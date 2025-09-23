"use client";
import React, { useEffect, useState } from "react";

export default function Guard({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      // Проверяем авторизацию на сервере
      const response = await fetch('/api/balance');
      if (response.ok) {
        const data = await response.json();
        if (data.ok) {
          setIsAuthenticated(true);
          localStorage.setItem('telegram_authenticated', 'true');
          localStorage.setItem('telegram_uid', data.uid.toString());
          setIsLoading(false);
          return;
        }
      }
    } catch (error) {
      console.log('Server auth check failed');
    }

    // Fallback: проверяем localStorage
    const savedAuth = localStorage.getItem('telegram_authenticated');
    setIsAuthenticated(savedAuth === 'true');
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
          Попробовать снова
        </button>
      </div>
    );
  }

  return <>{children}</>;
}