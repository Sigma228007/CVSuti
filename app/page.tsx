'use client';

import React, { useEffect, useState } from 'react';

function getInitDataFromLocation(): string | undefined {
  try {
    const params = new URLSearchParams(window.location.search);
    return (
      params.get('initData') ||
      params.get('initdata') ||
      params.get('tgWebAppData') ||
      undefined
    );
  } catch {
    return undefined;
  }
}

async function postAuth(initData?: string) {
  try {
    const body: any = initData ? { initData } : {};
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const j = await res.json();
    return { ok: res.ok, json: j };
  } catch (e: any) {
    return { ok: false, json: { ok: false, error: e?.message || String(e) } };
  }
}

export default function Page() {
  const [loading, setLoading] = useState(true);
  const [uid, setUid] = useState<number | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function init() {
      setLoading(true);
      setError(null);

      // 1) Попробуем взять initData из Telegram WebApp object
      let initData: string | undefined;
      try {
        const tg = (window as any)?.Telegram?.WebApp;
        if (tg?.initData) initData = tg.initData;
        // Some wrappers use tgWebAppData in query string instead
      } catch {}

      // 2) если не для telegram webapp — из query params
      if (!initData) initData = getInitDataFromLocation();

      // 3) если нашли — POST /api/auth initData
      const resp = await postAuth(initData);
      if (!mounted) return;
      if (resp.ok && resp.json?.ok) {
        setUid(resp.json.uid ?? null);
        setBalance(resp.json.balance ?? null);
      } else {
        // УДАЛЕН ПРОБЛЕМНЫЙ GET ЗАПРОС
        // Просто устанавливаем ошибку
        setError(resp.json?.error || 'Not authenticated');
      }
      setLoading(false);
    }
    init();
    return () => { mounted = false; };
  }, []);

  // Try to open telegram auth (if env is WebApp)
  function openTelegramAuth() {
    try {
      const tg = (window as any)?.Telegram?.WebApp;
      if (tg && typeof tg.openAuth === 'function') {
        // open native auth if available
        tg.openAuth();
        return;
      }
    } catch {}
    // fallback: ask user to open bot in Telegram manually
    alert('Откройте мини-приложение через нашего бота в Telegram (или откройте страницу в WebApp).');
  }

  return (
    <main style={{ padding: 20, fontFamily: 'Inter, Arial, sans-serif', color: '#e6eef3' }}>
      <h1 style={{ marginBottom: 12 }}>GVSuti — мини-казино</h1>

      <div style={{
        maxWidth: 900,
        background: '#0f1720',
        padding: 18,
        borderRadius: 12,
        boxShadow: '0 6px 24px rgba(0,0,0,0.25)'
      }}>
        {loading ? (
          <div>Загрузка…</div>
        ) : uid ? (
          <>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontWeight: 700 }}>UID:</div>
              <div>{uid}</div>
              <div style={{ marginLeft: 'auto', fontWeight: 700 }}>Баланс:</div>
              <div>{(balance ?? 0).toFixed(2)} ₽</div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button className="btn" onClick={() => window.location.href = '/pay'}>Пополнить</button>
              <button className="btn-outline" onClick={() => window.location.href = '/withdraw'}>Вывести</button>
              <button className="btn-outline" onClick={() => window.location.href = '/profile'}>Профиль</button>
            </div>

            <div style={{ marginTop: 12, color: '#9aa9bd' }}>
              <small>Быстрые ставки: 100 / 500 / 1000 ₽ (настройки в UI)</small>
            </div>
          </>
        ) : (
          <>
            <div style={{ marginBottom: 12, color: '#e6eef3' }}>
              Для использования приложения необходим вход через Telegram.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn" onClick={openTelegramAuth}>Войти через Telegram</button>
              <button className="btn-outline" onClick={() => {
                // try to open auth by prompting user to pass initData via query
                const id = prompt('Если у вас есть initData — вставьте его сюда (dev).');
                if (id) {
                  // send initData manually
                  postAuth(id).then((r) => {
                    if (r.ok && r.json.ok) {
                      window.location.reload();
                    } else {
                      alert('Auth failed: ' + (r.json?.error || JSON.stringify(r.json)));
                    }
                  });
                }
              }}>Ввести initData вручную</button>
            </div>

            {error && <div style={{ marginTop: 12, color: '#fca5a5' }}>Ошибка: {error}</div>}
          </>
        )}
      </div>

      <section style={{ marginTop: 18 }}>
        <h2 style={{ fontSize: 18 }}>Последние 10 игр</h2>
        <div className="card" style={{ marginTop: 8 }}>
          <div className="sub">Здесь будет список последних игр (демо)</div>
          {/* TODO: подключите реальную ленту */}
        </div>
      </section>
    </main>
  );
}