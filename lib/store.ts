import { redis } from "./redis";

const balKey = (uid: number) => `u:${uid}:balance`;
const doneKey = (orderId: string) => `dep:${orderId}:done`;

export async function getBalance(uid: number): Promise<number> {
  const r = await (await redis()).get(balKey(uid));
  return r ? parseInt(r, 10) : 0;
}

export async function setBalance(uid: number, value: number): Promise<number> {
  await (await redis()).set(balKey(uid), String(Math.max(0, Math.floor(value))));
  return getBalance(uid);
}

export async function addBalance(uid: number, delta: number): Promise<number> {
  const c = await redis();
  const v = await c.incrBy(balKey(uid), Math.floor(delta));
  if (v < 0) {
    await c.set(balKey(uid), "0");
    return 0;
  }
  return v;
}

// защита от повторных callback'ов
export async function markProcessedOnce(orderId: string): Promise<boolean> {
  const c = await redis();
  // setnx = только если ещё нет
  const ok = await c.set(doneKey(orderId), "1", { NX: true });
  return ok === "OK";
}