import { createClient, type RedisClientType } from "redis";

const url = process.env.REDIS_URL!;
let client: RedisClientType | null = null;

export async function redis(): Promise<RedisClientType> {
  if (client && client.isOpen) return client;
  client = createClient({ url });
  client.on("error", (e) => console.error("Redis error:", e));
  await client.connect();
  return client;
}