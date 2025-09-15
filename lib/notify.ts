import { sign } from '@/lib/sign';

const BASE =
  process.env.NEXT_PUBLIC_BASE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

function adminChatId() {
  const chat = process.env.ADMIN_CHAT_ID;
  if (chat && chat.trim()) return chat.trim();
  const first = (process.env.ADMIN_IDS || '').split(',')[0]?.trim();
  return first || '';
}

export async function notifyDepositAdmin(dep: { id: string; userId: number; amount: number }) {
  const text =
    `💳 <b>Новый запрос на пополнение</b>\n` +
    `ID: <code>${dep.id}</code>\n` +
    `User: <a href="tg://user?id=${dep.userId}">${dep.userId}</a>\n` +
    `Сумма: <b>${dep.amount}₽</b>`;

  const k = sign(dep.id);
  const approveUrl = `${BASE}/api/deposit/approve?id=${encodeURIComponent(dep.id)}&k=${k}`;
  const declineUrl = `${BASE}/api/deposit/decline?id=${encodeURIComponent(dep.id)}&k=${k}`;

  const chatId = adminChatId();
  if (!chatId) throw new Error('ADMIN_CHAT_ID/ADMIN_IDS not configured');

  await fetch(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      reply_markup: {
        inline_keyboard: [[
          { text: '✅ Подтвердить', url: approveUrl },
          { text: '❌ Отклонить', url: declineUrl },
        ]],
      },
    }),
  });
}