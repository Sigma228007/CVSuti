import { createClient } from 'redis';

const url = process.env.REDIS_URL!;
let client: ReturnType<typeof createClient> | null = null;
let connecting: Promise<void> | null = null;

async function connect() {
  // уже открыт
  if (client?.isOpen) return client;

  // уже в процессе коннекта — дождёмся
  if (connecting) {
    await connecting;
    return client!;
  }

  const c = createClient({ url });
  c.on('error', (e) => console.error('Redis error:', e));

  // один общий промис на коннект
  connecting = c.connect()
    .then(() => { client = c; })
    .finally(() => { connecting = null; });

  await connecting;
  return client!;
}

// Экспортируем единый getter клиента
export async function redis() {
  return connect();
}