import { Telegraf } from 'telegraf';

const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
  throw new Error('BOT_TOKEN is not defined');
}

const bot = new Telegraf(BOT_TOKEN);

// Команда /start
bot.command('start', (ctx) => {
  const webAppUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://gvsutionline.vercel.app';
  
  ctx.reply('🎰 Добро пожаловать в казино!', {
    reply_markup: {
      keyboard: [
        [{
          text: '🎮 Играть',
          web_app: { url: webAppUrl }
        }]
      ],
      resize_keyboard: true
    }
  });
});

// Команда /balance
bot.command('balance', async (ctx) => {
  try {
    const userId = ctx.from.id;
    
    // Можно добавить API запрос к /api/balance
    ctx.reply('💰 Баланс: проверка...\n\n💡 Откройте мини-приложение для просмотра баланса');
  } catch (error) {
    ctx.reply('❌ Ошибка получения баланса');
  }
});

// Команда /help
bot.command('help', (ctx) => {
  ctx.reply(`🤖 <b>Доступные команды:</b>

/start - Начать работу
/balance - Проверить баланс  
/help - Помощь

🎮 <b>Для игры нажмите кнопку "Играть"</b>

📞 <i>Техническая поддержка: @username</i>`, {
    parse_mode: 'HTML'
  });
});

// Обработка web-app данных
bot.on('web_app_data', (ctx) => {
  const data = ctx.webAppData?.data;
  if (data) {
    console.log('WebApp data received:', data);
    ctx.reply('✅ Данные из приложения получены');
  }
});

// Обработка callback queries (для админских кнопок)
bot.on('callback_query', async (ctx) => {
  await ctx.answerCbQuery();
  
  // Проверяем тип callback query
  if (ctx.callbackQuery && 'data' in ctx.callbackQuery) {
    const data = ctx.callbackQuery.data;
    console.log('Callback data:', data);
    // Здесь можно обработать callback данные
  }
});

// Обработка текстовых сообщений
bot.hears('💰 Баланс', async (ctx) => {
  ctx.reply('💎 Для просмотра баланса откройте мини-приложение, нажав кнопку "Играть"');
});

bot.hears('🎮 Играть', (ctx) => {
  const webAppUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://gvsutionline.vercel.app';
  ctx.reply('Открываю игру...', {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🎮 Открыть игру', web_app: { url: webAppUrl } }]
      ]
    }
  });
});

// Обработка ошибок
bot.catch((err, ctx) => {
  console.error(`Error for ${ctx.updateType}:`, err);
  ctx.reply('❌ Произошла ошибка. Попробуйте позже.');
});

// Функция для отправки уведомлений
export async function sendNotification(userId: number, message: string, options: any = {}) {
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
        chat_id: userId,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        ...options
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

// Функция для установки вебхука
export async function setWebhook() {
  // Не пытаться устанавливать вебхук во время сборки или без URL
  if (!process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_BASE_URL.includes('undefined')) {
    console.log('⚠️  Skipping webhook setup - BASE_URL not defined');
    return;
  }

  const webhookUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/bot/webhook`;
  
  if (!webhookUrl || webhookUrl.includes('undefined')) {
    console.error('❌ Invalid webhook URL:', webhookUrl);
    return;
  }

  try {
    await bot.telegram.setWebhook(webhookUrl);
    console.log('✅ Webhook set to:', webhookUrl);
  } catch (error: any) {
    console.error('❌ Webhook setup failed:', error.message);
  }
}

// Функция для удаления вебхука
export async function deleteWebhook() {
  try {
    await bot.telegram.deleteWebhook();
    console.log('✅ Webhook deleted');
  } catch (error: any) {
    console.error('❌ Webhook deletion failed:', error.message);
  }
}

// Получение информации о вебхуке
export async function getWebhookInfo() {
  try {
    const info = await bot.telegram.getWebhookInfo();
    console.log('📋 Webhook info:', info);
    return info;
  } catch (error: any) {
    console.error('❌ Webhook info failed:', error.message);
    return null;
  }
}

// Запуск бота в режиме polling (для разработки)
export function startPolling() {
  console.log('🤖 Starting bot in polling mode...');
  bot.launch()
    .then(() => console.log('✅ Bot started in polling mode'))
    .catch((error) => console.error('❌ Bot startup failed:', error));

  // Graceful shutdown
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

// Экспортируем бота для использования в API routes
export default bot;