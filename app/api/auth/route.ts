import { NextRequest, NextResponse } from "next/server";
import { readUidFromCookies, writeUidCookie, extractUserFromInitData } from "@/lib/session";
import { ensureUser, getBalance } from "@/lib/store";

const BOT_TOKEN = process.env.BOT_TOKEN!;

export async function POST(req: NextRequest) {
  try {
    // Проверяем существующую сессию
    const existingUid = readUidFromCookies(req);
    if (existingUid) {
      const balance = await getBalance(existingUid);
      return NextResponse.json({ 
        ok: true, 
        uid: existingUid, 
        balance,
        fromCookie: true 
      });
    }

    // Пробуем получить initData из разных источников
    let initData: string | undefined;
    let userIdFromHeader: number | undefined;

    // 1. Из заголовков
    const headers = req.headers;
    initData = headers.get('x-init-data') || 
               headers.get('x-telegram-initdata') || 
               headers.get('x-tg-initdata') || 
               undefined;

    // 2. Из тела запроса
    if (!initData) {
      try {
        const body = await req.json();
        initData = body.initData || body.tgWebAppData;
        if (body.userId) userIdFromHeader = Number(body.userId);
      } catch {}
    }

    // 3. Из query параметров (для GET запросов)
    if (!initData) {
      const url = new URL(req.url);
      initData = url.searchParams.get('initData') || 
                 url.searchParams.get('tgWebAppData') || 
                 undefined;
    }

    // 4. Из cookies
    if (!initData) {
      const cookieInitData = req.cookies.get('tgInitData')?.value;
      if (cookieInitData) initData = cookieInitData;
    }

    // Если есть initData, пробуем распарсить
    if (initData) {
      const userData = extractUserFromInitData(initData, BOT_TOKEN);
      
      if (userData.ok && userData.id) {
        const uid = Number(userData.id);
        await ensureUser({ 
          id: uid, 
          first_name: userData.user?.first_name, 
          username: userData.user?.username 
        });

        const balance = await getBalance(uid);
        const response = NextResponse.json({ 
          ok: true, 
          uid, 
          balance,
          user: userData.user 
        });

        writeUidCookie(response, uid);
        return response;
      }
    }

    // Если есть userId из заголовков
    if (userIdFromHeader) {
      await ensureUser({ id: userIdFromHeader });
      const balance = await getBalance(userIdFromHeader);
      const response = NextResponse.json({ 
        ok: true, 
        uid: userIdFromHeader, 
        balance 
      });
      writeUidCookie(response, userIdFromHeader);
      return response;
    }

    // Если ничего не найдено
    return NextResponse.json({ 
      ok: false, 
      error: "Требуется авторизация через Telegram",
      requireTelegram: true 
    }, { status: 401 });

  } catch (error: any) {
    return NextResponse.json({ 
      ok: false, 
      error: error.message || "Ошибка авторизации" 
    }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const existingUid = readUidFromCookies(req);
    if (existingUid) {
      const balance = await getBalance(existingUid);
      return NextResponse.json({ 
        ok: true, 
        uid: existingUid, 
        balance 
      });
    }

    const url = new URL(req.url);
    const initData = url.searchParams.get('initData') || 
                     url.searchParams.get('tgWebAppData');

    if (initData) {
      const userData = extractUserFromInitData(initData, BOT_TOKEN);
      if (userData.ok && userData.id) {
        const uid = Number(userData.id);
        await ensureUser({ 
          id: uid, 
          first_name: userData.user?.first_name, 
          username: userData.user?.username 
        });

        const balance = await getBalance(uid);
        const response = NextResponse.json({ 
          ok: true, 
          uid, 
          balance,
          user: userData.user 
        });

        writeUidCookie(response, uid);
        return response;
      }
    }

    return NextResponse.json({ 
      ok: false, 
      error: "Требуется авторизация" 
    }, { status: 401 });

  } catch (error: any) {
    return NextResponse.json({ 
      ok: false, 
      error: error.message || "Ошибка сервера" 
    }, { status: 500 });
  }
}