import { signAdmin } from "@/lib/sign";

const BOT = process.env.BOT_TOKEN!;
const ADMIN_CHAT = process.env.ADMIN_CHAT_ID ? Number(process.env.ADMIN_CHAT_ID) : undefined;
const ADMIN_SIGN_KEY = process.env.ADMIN_SIGN_KEY!;
const API = BOT ? `https://api.telegram.org/bot${BOT}` : "";

function getBaseUrl() {
  // На Vercel так корректно получить прод-URL
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return ""; // локалка/не настроено
}

async function tgSend(chatId: number, payload: any) {
  if (!BOT || !chatId) return;
  try {
    await fetch(`${API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, ...payload }),
    });
  } catch {
    /* ignore */
  }
}

export async function notifyDepositAdmin(dep: { id: string; userId: number; amount: number }) {
  if (!ADMIN_CHAT) return;

  const base = getBaseUrl();
  const sig = signAdmin(dep.id, ADMIN_SIGN_KEY);
  const approveUrl = `${base}/api/deposit/approve?id=${encodeURIComponent(dep.id)}&sig=${encodeURIComponent(sig)}`;
  const declineUrl = `${base}/api/deposit/decline?id=${encodeURIComponent(dep.id)}&sig=${encodeURIComponent(sig)}`;

  const text =
    `🧾 Новый запрос на пополнение\n` +
    `ID: <code>${dep.id}</code>\n` +
    `User: <code>${dep.userId}</code>\n` +
    `Сумма: <b>${dep.amount}₽</b>`;

  await tgSend(ADMIN_CHAT, {
    text,
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [
          { text: "✅ Подтвердить", url: approveUrl },
          { text: "❌ Отклонить",  url: declineUrl  },
        ],
      ],
    },
    disable_web_page_preview: true,
  });
}

export async function notifyUserDepositApproved(dep: { userId: number; amount: number }) {
  await tgSend(dep.userId, {
    text: `✅ Зачислено ${dep.amount}₽ на баланс.`,
  });
}

export async function notifyUserDepositDeclined(dep: { userId: number; amount: number }) {
  await tgSend(dep.userId, {
    text: `❌ Пополнение на ${dep.amount}₽ отклонено. Если это ошибка — напишите поддержке.`,
  });
}