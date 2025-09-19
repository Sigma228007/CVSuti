import { signAdminPayload } from "./sign";

const BOT_TOKEN = process.env.BOT_TOKEN!;
const ADMIN_CHAT = Number(process.env.ADMIN_CHAT_ID || process.env.ADMIN_IDS?.split(",")[0] || 0);
const BASE = process.env.NEXT_PUBLIC_BASE_URL || "";

async function tgSend(chatId: number, payload: any) {
  if (!BOT_TOKEN) throw new Error("BOT_TOKEN is required");
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, ...payload })
  });
}

export async function notifyDepositAdmin(dep: { id: string; userId: number; amount: number }) {
  if (!ADMIN_CHAT || !BASE) return;

  const key = process.env.ADMIN_SIGN_KEY || "";
  const sig = signAdminPayload(
  { id: dep.id, user: dep.userId, amount: dep.amount },
  key
);
  const approveUrl = `${BASE}/api/deposit/approve?id=${encodeURIComponent(dep.id)}&user=${dep.userId}&amount=${dep.amount}&sig=${sig}`;
  const declineUrl = `${BASE}/api/deposit/decline?id=${encodeURIComponent(dep.id)}&user=${dep.userId}&amount=${dep.amount}&sig=${sig}`;

  const text =
    "<b>Новый запрос на пополнение</b>\n" +
    `ID: <code>${dep.id}</code>\n` +
    `User: <a href="tg://user?id=${dep.userId}">${dep.userId}</a>\n` +
    `Сумма: <b>${dep.amount}₽</b>`;

  await tgSend(ADMIN_CHAT, {
    text, parse_mode: "HTML",
    reply_markup: { inline_keyboard: [[{ text: "✅ Подтвердить", url: approveUrl }],[{ text: "❌ Отклонить", url: declineUrl }]] },
    disable_web_page_preview: true
  });
}

export async function notifyUserDepositApproved(dep: { userId: number; amount: number }) {
  await tgSend(dep.userId, { text: `✅ Зачислено ${dep.amount}₽ на баланс.` });
}
export async function notifyUserDepositDeclined(dep: { userId: number; amount: number }) {
  await tgSend(dep.userId, { text: `❌ Пополнение на ${dep.amount}₽ отклонено. Если это ошибка – напишите поддержке.` });
}

// === ВЫВОДЫ ===
export async function notifyWithdrawAdmin(req: { id: string; userId: number; amount: number; details?: any }) {
  if (!ADMIN_CHAT || !BASE) return;

  const key = process.env.ADMIN_SIGN_KEY || "";
  const sig = signAdminPayload(
    { id: req.id, user: req.userId, amount: req.amount },
    key
  );
  const approveUrl = `${BASE}/api/withdraw/approve?id=${encodeURIComponent(req.id)}&user=${req.userId}&amount=${req.amount}&sig=${sig}`;
  const declineUrl = `${BASE}/api/withdraw/decline?id=${encodeURIComponent(req.id)}&user=${req.userId}&amount=${req.amount}&sig=${sig}`;

  const detailsStr = req.details ? `<code>${JSON.stringify(req.details)}</code>` : '—';

  const text =
    "<b>Новая заявка на вывод</b>\n" +
    `ID: <code>${req.id}</code>\n` +
    `User: <a href="tg://user?id=${req.userId}">${req.userId}</a>\n` +
    `Сумма: <b>${req.amount}₽</b>\n` +
    `Реквизиты: ${detailsStr}`;

  await tgSend(ADMIN_CHAT, {
    text, parse_mode: "HTML",
    reply_markup: { inline_keyboard: [[{ text: "✅ Подтвердить", url: approveUrl }],[{ text: "❌ Отклонить", url: declineUrl }]] },
    disable_web_page_preview: true
  });
}

export async function notifyUserWithdrawApproved(p: { userId: number; amount: number }) {
  await tgSend(p.userId, { text: `✅ Заявка на вывод ${p.amount}₽ выполнена.` });
}
export async function notifyUserWithdrawDeclined(p: { userId: number; amount: number }) {
  await tgSend(p.userId, { text: `❌ Заявка на вывод ${p.amount}₽ отклонена. Средства возвращены на баланс.` });
}