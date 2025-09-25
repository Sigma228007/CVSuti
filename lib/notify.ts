import { signAdminPayload } from "./sign";

const BOT_TOKEN = process.env.BOT_TOKEN!;
const ADMIN_CHAT = Number(process.env.ADMIN_CHAT_ID || process.env.ADMIN_IDS?.split(",")[0] || 0);

async function sendTelegramMessage(chatId: number, text: string, replyMarkup?: any) {
  if (!BOT_TOKEN) {
    console.error('BOT_TOKEN is not set');
    return false;
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML',
        reply_markup: replyMarkup,
        disable_web_page_preview: true
      })
    });

    return response.ok;
  } catch (error) {
    console.error('Error sending Telegram message:', error);
    return false;
  }
}

// Уведомление админу о новом депозите
export async function notifyDepositAdmin(dep: { id: string; userId: number; amount: number; provider?: string }) {
  if (!ADMIN_CHAT || !BOT_TOKEN) {
    console.log('Skipping admin notification: ADMIN_CHAT or BOT_TOKEN not set');
    return false;
  }

  try {
    const key = process.env.ADMIN_SIGN_KEY || "default_key";
    const sig = signAdminPayload({ id: dep.id, user: dep.userId, amount: dep.amount }, key);

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const approveUrl = `${baseUrl}/api/deposit/approve?id=${dep.id}&sig=${sig}`;
    const declineUrl = `${baseUrl}/api/deposit/decline?id=${dep.id}&sig=${sig}`;

    const message = `
💰 <b>Новый запрос на пополнение</b>
├ ID: <code>${dep.id}</code>
├ User: ${dep.userId}
├ Сумма: <b>${dep.amount}₽</b>
└ Провайдер: ${dep.provider || 'unknown'}

⏰ <i>${new Date().toLocaleString('ru-RU')}</i>
    `.trim();

    return await sendTelegramMessage(ADMIN_CHAT, message, {
      inline_keyboard: [
        [{ text: "✅ Подтвердить", url: approveUrl }],
        [{ text: "❌ Отклонить", url: declineUrl }]
      ]
    });
  } catch (error) {
    console.error('Error in notifyDepositAdmin:', error);
    return false;
  }
}

// Уведомление пользователю об успешном пополнении
export async function notifyUserDepositApproved(dep: { userId: number; amount: number; id: string }) {
  if (!BOT_TOKEN) return false;

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
  if (!BOT_TOKEN) return false;

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
    console.log('Skipping admin notification: ADMIN_CHAT or BOT_TOKEN not set');
    return false;
  }

  try {
    const key = process.env.ADMIN_SIGN_KEY || "default_key";
    const sig = signAdminPayload({ id: req.id, user: req.userId, amount: req.amount }, key);

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    
    // Правильные URL для кнопок
    const approveUrl = `${baseUrl}/api/withdraw/approve?id=${req.id}&sig=${encodeURIComponent(sig)}`;
    const declineUrl = `${baseUrl}/api/withdraw/decline?id=${req.id}&sig=${encodeURIComponent(sig)}`;

    const detailsStr = req.details ? `\n├ Реквизиты: <code>${typeof req.details === 'string' ? req.details : JSON.stringify(req.details)}</code>` : '';

    const message = `
💸 <b>Новая заявка на вывод</b>
├ ID: <code>${req.id}</code>
├ User: ${req.userId}
├ Сумма: <b>${req.amount}₽</b>${detailsStr}
└ Дата: <i>${new Date().toLocaleString('ru-RU')}</i>
    `.trim();

    return await sendTelegramMessage(ADMIN_CHAT, message, {
      inline_keyboard: [
        [
          { 
            text: "✅ Подтвердить вывод", 
            url: approveUrl 
          },
          { 
            text: "❌ Отклонить вывод", 
            url: declineUrl 
          }
        ]
      ]
    });
  } catch (error) {
    console.error('Error in notifyWithdrawAdmin:', error);
    return false;
  }
}

// Уведомление пользователю об успешном выводе
export async function notifyUserWithdrawApproved(p: { userId: number; amount: number; id: string }) {
  if (!BOT_TOKEN) return false;

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
  if (!BOT_TOKEN) return false;

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
export async function notifyNewBet(bet: { userId: number; amount: number; chance: number; realChance?: number; result: string; payout: number }) {
  if (!ADMIN_CHAT || !BOT_TOKEN) return false;

  const realChanceInfo = bet.realChance ? `\n├ Реальный шанс: <b>${bet.realChance.toFixed(1)}%</b>` : '';

  const message = `
🎰 <b>Новая ставка</b>
├ User: ${bet.userId}
├ Ставка: <b>${bet.amount}₽</b>
├ Заявленный шанс: <b>${bet.chance}%</b>${realChanceInfo}
├ Результат: <b>${bet.result === 'win' ? '✅ Выигрыш' : '❌ Проигрыш'}</b>
├ Выплата: <b>${bet.payout}₽</b>
└ Дата: <i>${new Date().toLocaleString('ru-RU')}</i>
  `.trim();

  return await sendTelegramMessage(ADMIN_CHAT, message);
}