import { signAdminPayload } from "./sign";

const BOT_TOKEN = process.env.BOT_TOKEN!;
const ADMIN_CHAT = Number(process.env.ADMIN_CHAT_ID || process.env.ADMIN_IDS?.split(",")[0] || 0);
if (!BOT_TOKEN) throw new Error("BOT_TOKEN is required");

async function tgSend(chatId: number, payload: any) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, ...payload })
  });
}

function baseUrl() {
  return (process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/+$/, "");
}

export async function notifyDepositAdmin(dep: { id: string; userId: number; amount: number }) {
  if (!ADMIN_CHAT) return;
  const base = baseUrl();
  const key = process.env.ADMIN_SIGN_KEY || "";

  const sig = signAdminPayload({ id: dep.id }, key);
  const approveUrl = `${base}/api/deposit/approve?id=${encodeURIComponent(dep.id)}&user=${dep.userId}&amount=${dep.amount}&sig=${sig}`;
  const declineUrl = `${base}/api/deposit/decline?id=${encodeURIComponent(dep.id)}&user=${dep.userId}&amount=${dep.amount}&sig=${sig}`;

  const text =
    "<b>Новый запрос на пополнение</b>\n" +
    `ID: <code>${dep.id}</code>\n` +
    `User: <a href="tg://user?id=${dep.userId}">${dep.userId}</a>\n` +
    `Сумма: <b>${dep.amount}₽</b>`;

  await tgSend(ADMIN_CHAT, {
    text,
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [{ text: "✅ Подтвердить", url: approveUrl }],
        [{ text: "❌ Отклонить",   url: declineUrl  }],
      ]
    },
    disable_web_page_preview: true
  });
}

export async function notifyUserDepositApproved(dep: { userId: number; amount: number }) {
  await tgSend(dep.userId, { text: `✅ Зачислено ${dep.amount}₽ на баланс.` });
}

export async function notifyUserDepositDeclined(dep: { userId: number; amount: number }) {
  await tgSend(dep.userId, { text: `❌ Пополнение на ${dep.amount}₽ отклонено.` });
}