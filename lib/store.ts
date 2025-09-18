import { redis } from "./redis";

/* ===========================
   Ключи в Redis
   =========================== */
const balKey = (uid: number) => `u:${uid}:balance`;
const dataKey = (uid: number) => `u:${uid}:data`;
const nonceKey = "global:nonce";
const pendingListKey = "deposit:pending"; // очередь ожидающих пополнений
const onceKey = (id: string) => `once:${id}`; // ключ для защиты от дублей callback'ов

/* ===========================
   Баланс
   =========================== */
export async function getBalance(uid: number): Promise<number> {
  const c = await redis();
  const v = await c.get(balKey(uid));
  return v ? parseInt(v, 10) : 0;
}

export async function setBalance(uid: number, value: number): Promise<number> {
  const c = await redis();
  const safe = Math.max(0, Math.floor(value));
  await c.set(balKey(uid), String(safe));
  return safe;
}

export async function addBalance(uid: number, delta: number): Promise<number> {
  const c = await redis();
  const next = await c.incrBy(balKey(uid), Math.floor(delta));
  if (next < 0) {
    await c.set(balKey(uid), "0");
    return 0;
  }
  return next;
}

/* ===========================
   Пользовательские данные
   =========================== */
export async function upsertUser(uid: number, data: Record<string, any>) {
  const c = await redis();
  const payload = Object.fromEntries(
    Object.entries(data).map(([k, v]) => [k, JSON.stringify(v)])
  );
  if (Object.keys(payload).length) {
    await c.hSet(dataKey(uid), payload);
  }
}

/* ===========================
   Номер раунда / nonce
   =========================== */
export async function getNonce(): Promise<number> {
  const c = await redis();
  const n = await c.incr(nonceKey);
  return Number(n);
}

/* ===========================
   Ожидающие пополнения (админка)
   =========================== */
export type PendingDeposit = {
  id: string;
  userId: number;
  amount: number;
  method?: "card" | "fkwallet" | string;
  createdAt: number;
};

export async function addPending(dep: PendingDeposit): Promise<void> {
  const c = await redis();
  await c.lPush(pendingListKey, JSON.stringify(dep));
}

export async function listPending(): Promise<PendingDeposit[]> {
  const c = await redis();
  const raw = await c.lRange(pendingListKey, 0, -1);
  return raw
    .map((s) => {
      try { return JSON.parse(s) as PendingDeposit; } catch { return null; }
    })
    .filter(Boolean) as PendingDeposit[];
}

export async function removePending(id: string): Promise<void> {
  const c = await redis();
  const all = await c.lRange(pendingListKey, 0, -1);
  for (const item of all) {
    try {
      const parsed = JSON.parse(item) as PendingDeposit;
      if (parsed?.id === id) {
        await c.lRem(pendingListKey, 1, item);
        break;
      }
    } catch { /* ignore */ }
  }
}

/* ===========================
   Анти-дубликат (для FK callback)
   =========================== */
/**
 * Ставит в Redis маркер «обработан» для указанного id.
 * Возвращает true, если это ПЕРВЫЙ вызов (маркер поставлен сейчас),
 * и false, если id уже обрабатывался раньше.
 *
 * @param id          — уникальный идентификатор операции (orderId и т.п.)
 * @param ttlSeconds  — время жизни маркера (по умолчанию 3 дня)
 */
export async function markProcessedOnce(
  id: string,
  ttlSeconds = 3 * 24 * 60 * 60
): Promise<boolean> {
  const c = await redis();
  // NX — только если ключа ещё нет, EX — TTL
  const res = await c.set(onceKey(id), "1", { NX: true, EX: ttlSeconds });
  return res === "OK";
}

/* ===========================
   Лента ставок
   =========================== */
export type BetRecord = {
  id: string; // `${Date.now()}_${userId}_${nonce}`
  userId: number;
  amount: number;
  chance: number;
  dir: "under" | "over";
  placedAt: number;
  nonce: number;
  outcome: {
    value: number;
    win: boolean;
    payout: number;
    coef: number;
    proof: {
      serverSeedHash: string;
      serverSeed?: string;
      clientSeed: string;
      hex: string;
    };
  };
};

export const bets: BetRecord[] = [];

export function pushBet(rec: BetRecord) {
  bets.unshift(rec);
  if (bets.length > 100) bets.pop();
}