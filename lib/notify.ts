import { signAdminPayload } from "./sign";

const BOT_TOKEN = process.env.BOT_TOKEN!;
const ADMIN_CHAT = Number(process.env.ADMIN_CHAT_ID || process.env.ADMIN_IDS?.split(",")[0] || 0);
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

// Функция для отправки сообщений через Bot API
async function sendTelegramMessage(chatId: number, text: string, replyMarkup?: any) {
  if (!BOT_TOKEN) {
    console.error('BOT_TOKEN is not set');
    return false;
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML',
        reply_markup: replyMarkup,
        disable_web_page_preview: true
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Telegram API error:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error sending Telegram message:', error);
    return false;
  }
}

// Отправка уведомления админу о новом депозите
export async function notifyDepositAdmin(dep: { id: string; userId: number; amount: number; provider?: string }) {
  if (!ADMIN_CHAT || !BOT_TOKEN) {
    console.error('ADMIN_CHAT or BOT_TOKEN not set');
    return false;
  }

  try {
    const key = process.env.ADMIN_SIGN_KEY || "";
    const sig = signAdminPayload(
      { id: dep.id, user: dep.userId, amount: dep.amount },
      key
    );

    const approveUrl = `${BASE_URL}/api/deposit/approve?id=${dep.id}&sig=${sig}`;
    const declineUrl = `${BASE_URL}/api/deposit/decline?id=${dep.id}&sig=${sig}`;

    const message = `
💰 <b>Новый запрос на пополнение</b>
├ ID: <code>${dep.id}</code>
├ User: <a href="tg://user?id=${dep.userId}">${dep.userId}</a>
├ Сумма: <b>${dep.amount}₽</b>
└ Провайдер: ${dep.provider || 'unknown'}

⏰ <i>${new Date().toLocaleString('ru-RU')}</i>
    `.trim();

    const success = await sendTelegramMessage(ADMIN_CHAT, message, {
      inline_keyboard: [
        [
          { text: "✅ Подтвердить", url: approveUrl },
          { text: "❌ Отклонить", url: declineUrl }
        ]
      ]
    });

    return success;
  } catch (error) {
    console.error('Error in notifyDepositAdmin:', error);
    return false;
  }
}

// Уведомление пользователю об успешном пополнении
export async function notifyUserDepositApproved(dep: { userId: number; amount: number; id: string }) {
  const message = `
✅ <b>Пополнение успешно зачислено!</b>
├ Сумма: <b>${dep.amount}₽</b>
├ ID: <code>${dep.id}</code>
└ Дата: <i>${new Date().toLocaleString('ru-RU')}</i>

💡 <i>Обновите страницу для отображения нового баланса</i>
  `.trim();

  return await sendTelegramMessage(dep.userId, message);
}

// Уведомление пользователю об отклонении пополнения
export async function notifyUserDepositDeclined(dep: { userId: number; amount: number; id: string }) {
  const message = `
❌ <b>Пополнение отклонено</b>
├ Сумма: <b>${dep.amount}₽</b>
├ ID: <code>${dep.id}</code>
└ Дата: <i>${new Date().toLocaleString('ru-RU')}</i>

📞 <i>Если это ошибка - свяжитесь с поддержкой</i>
  `.trim();

  return await sendTelegramMessage(dep.userId, message);
}

// Уведомление админу о новом выводе
export async function notifyWithdrawAdmin(req: { id: string; userId: number; amount: number; details?: any }) {
  if (!ADMIN_CHAT || !BOT_TOKEN) {
    console.error('ADMIN_CHAT or BOT_TOKEN not set');
    return false;
  }

  try {
    const key = process.env.ADMIN_SIGN_KEY || "";
    const sig = signAdminPayload(
      { id: req.id, user: req.userId, amount: req.amount },
      key
    );

    const approveUrl = `${BASE_URL}/api/withdraw/approve?id=${req.id}&sig=${sig}`;
    const declineUrl = `${BASE_URL}/api/withdraw/decline?id=${req.id}&sig=${sig}`;

    const detailsStr = req.details ? `\n├ Реквизиты: <code>${JSON.stringify(req.details, null, 2).slice(0, 100)}...</code>` : '';

    const message = `
💸 <b>Новая заявка на вывод</b>
├ ID: <code>${req.id}</code>
├ User: <a href="tg://user?id=${req.userId}">${req.userId}</a>
├ Сумма: <b>${req.amount}₽</b>${detailsStr}
└ Дата: <i>${new Date().toLocaleString('ru-RU')}</i>
    `.trim();

    const success = await sendTelegramMessage(ADMIN_CHAT, message, {
      inline_keyboard: [
        [
          { text: "✅ Подтвердить", url: approveUrl },
          { text: "❌ Отклонить", url: declineUrl }
        ]
      ]
    });

    return success;
  } catch (error) {
    console.error('Error in notifyWithdrawAdmin:', error);
    return false;
  }
}

// Уведомление пользователю об успешном выводе
export async function notifyUserWithdrawApproved(p: { userId: number; amount: number; id: string }) {
  const message = `
✅ <b>Вывод успешно выполнен!</b>
├ Сумма: <b>${p.amount}₽</b>
├ ID: <code>${p.id}</code>
└ Дата: <i>${new Date().toLocaleString('ru-RU')}</i>

💸 <i>Средства отправлены на указанные реквизиты</i>
  `.trim();

  return await sendTelegramMessage(p.userId, message);
}

// Уведомление пользователю об отклонении вывода
export async function notifyUserWithdrawDeclined(p: { userId: number; amount: number; id: string }) {
  const message = `
❌ <b>Вывод отклонен</b>
├ Сумма: <b>${p.amount}₽</b>
├ ID: <code>${p.id}</code>
└ Дата: <i>${new Date().toLocaleString('ru-RU')}</i>

💡 <i>Средства возвращены на ваш баланс</i>
  `.trim();

  return await sendTelegramMessage(p.userId, message);
}

// Уведомление о новой ставке (для админа)
export async function notifyNewBet(bet: { userId: number; amount: number; chance: number; result: string; payout: number }) {
  if (!ADMIN_CHAT) return false;

  const message = `
🎰 <b>Новая ставка</b>
├ User: <a href="tg://user?id=${bet.userId}">${bet.userId}</a>
├ Ставка: <b>${bet.amount}₽</b>
├ Шанс: <b>${bet.chance}%</b>
├ Результат: <b>${bet.result === 'win' ? '✅ Выигрыш' : '❌ Проигрыш'}</b>
├ Выплата: <b>${bet.payout}₽</b>
└ Дата: <i>${new Date().toLocaleString('ru-RU')}</i>
  `.trim();

  return await sendTelegramMessage(ADMIN_CHAT, message);
}

// Уведомление о выигрыше пользователю
export async function notifyUserBetWin(userId: number, amount: number, payout: number) {
  const message = `
🎉 <b>Поздравляем с выигрышем!</b>
├ Ваша ставка: <b>${amount}₽</b>
├ Выигрыш: <b>${payout}₽</b>
├ Чистая прибыль: <b>${payout - amount}₽</b>
└ Дата: <i>${new Date().toLocaleString('ru-RU')}</i>

💰 <i>Средства зачислены на ваш баланс</i>
  `.trim();

  return await sendTelegramMessage(userId, message);
}

// Уведомление о проигрыше пользователю
export async function notifyUserBetLoss(userId: number, amount: number) {
  const message = `
😢 <b>Ставка не сыграла</b>
├ Сумма ставки: <b>${amount}₽</b>
└ Дата: <i>${new Date().toLocaleString('ru-RU')}</i>

🎰 <i>Удачи в следующий раз!</i>
  `.trim();

  return await sendTelegramMessage(userId, message);
}