import { createClient, type RedisClientType } from "redis";

// Приводим к одному типу через дженерики, чтобы не конфликтовали разные декларации
type RClient = RedisClientType<any, any, any>;

const url: string | undefined = process.env.REDIS_URL;

let client: RClient | null = null;
let connecting: Promise<RClient> | null = null;

export async function redis(): Promise<RClient> {
  if (client) return client;
  if (!url) throw new Error("REDIS_URL is not set");

  if (!connecting) {
    connecting = (async () => {
      // Явно приводим createClient к нашему RClient
      const c = createClient({ url }) as RClient;
      c.on("error", (e) => console.error("Redis error:", e));
      await c.connect();
      client = c;
      return c;
    })();
  }
  return connecting;
}