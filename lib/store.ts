import Redis from "ioredis";

/** ---------- Redis client (singleton) ---------- */
let _r: Redis | null = null;
export function redis(): Redis {
  if (_r) return _r;
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL is not set");
  _r = new Redis(url, { maxRetriesPerRequest: 2, lazyConnect: false });
  return _r;
}

/** ---------- Types ---------- */
export type DepositStatus = "pending" | "approved" | "declined";
export type WithdrawStatus = "pending" | "approved" | "declined";

export type Deposit = {
  id: string;
  userId: number;
  amount: number; // рубли (целые)
  status: DepositStatus;
  createdAt: number;
  approvedAt?: number;
  declinedAt?: number;
  provider?: "fkwallet";
};

export type Withdraw = {
  id: string;
  userId: number;
  amount: number; // при создании списываем в резерв (минус из баланса)
  details?: any;
  status: WithdrawStatus;
  createdAt: number;
  approvedAt?: number;
  declinedAt?: number;
};

export type UserRecord = {
  id: number;
  first_name?: string;
  username?: string;
  balance?: number; // рубли
  lastSeenAt?: number;
};

export type BetRecord = {
  id: string;
  userId: number;
  amount: number;
  payout: number;
  rolled: number;
  createdAt: number;
};

/** ---------- Keys helpers ---------- */
const kUser = (id: number) => `user:${id}`; // HASH (id, first_name, username, balance, lastSeenAt)
const kHist = (id: number) => `hist:${id}`; // LIST of JSON (latest first)
const kDep = (id: string) => `dep:${id}`;   // STRING JSON of Deposit
const kWd = (id: string) => `wd:${id}`;     // STRING JSON of Withdraw

const Z_DEPS_PENDING = "deps:pending";      // ZSET (member=id, score=createdAt)
const Z_WDS_PENDING = "wds:pending";        // ZSET (member=id, score=createdAt) 

/** ---------- Small utils ---------- */
async function setJSON(key: string, v: any) {
  await redis().set(key, JSON.stringify(v));
}
async function getJSON<T>(key: string): Promise<T | null> {
  const s = await redis().get(key);
  if (!s) return null;
  try { return JSON.parse(s) as T; } catch { return null; }
}
function randId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}
async function pushHistory(userId: number, payload: any, keep = 200) {
  const r = redis();
  await r.lpush(kHist(userId), JSON.stringify({ ...payload, ts: Date.now() }));
  await r.ltrim(kHist(userId), 0, keep - 1);
}

/** ---------- Users / Balance ---------- */
export async function ensureUser(u: { id: number; first_name?: string; username?: string }) {
  const r = redis();
  const key = kUser(u.id);
  // не перетирать значения, только заполнять отсутствующие
  await r.hsetnx(key, "id", String(u.id));
  if (u.first_name) await r.hset(key, "first_name", u.first_name);
  if (u.username) await r.hset(key, "username", u.username);
  await r.hsetnx(key, "balance", "0");
  await r.hset(key, "lastSeenAt", String(Date.now()));
}

export async function getBalance(userId: number): Promise<number> {
  const v = await redis().hget(kUser(userId), "balance");
  return v ? Number(v) : 0;
}

export async function addBalance(userId: number, delta: number): Promise<void> {
  await redis().hincrbyfloat(kUser(userId), "balance", delta);
}

/** История пользователя (список недавних событий: депы/выводы/ставки) */
export async function getUserHistory(userId: number): Promise<any[]> {
  const raw = await redis().lrange(kHist(userId), 0, 99);
  return raw.map((s) => {
    try { return JSON.parse(s); } catch { return null; }
  }).filter(Boolean);
}

/** (опционально) пуш ставки в историю — используйте при завершении игры */
export async function pushBet(userId: number, bet: BetRecord) {
  await pushHistory(userId, { t: "bet", ...bet });
}

/** ---------- Deposits ---------- */
export async function createDepositRequest(
  userId: number,
  amount: number,
  provider: "fkwallet"
): Promise<Deposit> {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("bad amount");
  }
  const dep: Deposit = {
    id: randId("dep"),
    userId,
    amount: Math.floor(amount),
    status: "pending",
    createdAt: Date.now(),
    provider,
  };
  const r = redis();
  await setJSON(kDep(dep.id), dep);
  await r.zadd(Z_DEPS_PENDING, dep.createdAt, dep.id);
  await pushHistory(userId, { t: "dep_pending", id: dep.id, amount: dep.amount });
  return dep;
}

export async function getDeposit(id: string): Promise<Deposit | null> {
  return await getJSON<Deposit>(kDep(id));
}

export async function approveDeposit(dep: Deposit): Promise<void> {
  if (dep.status === "approved") return;
  dep.status = "approved";
  dep.approvedAt = Date.now();
  await setJSON(kDep(dep.id), dep);
  await redis().zrem(Z_DEPS_PENDING, dep.id);
  await pushHistory(dep.userId, { t: "dep_approved", id: dep.id, amount: dep.amount });
}

export async function declineDeposit(dep: Deposit): Promise<void> {
  if (dep.status === "declined") return;
  dep.status = "declined";
  dep.declinedAt = Date.now();
  await setJSON(kDep(dep.id), dep);
  await redis().zrem(Z_DEPS_PENDING, dep.id);
  await pushHistory(dep.userId, { t: "dep_declined", id: dep.id, amount: dep.amount });
}

export async function listPendingDeposits(limit = 50): Promise<Deposit[]> {
  const r = redis();
  const ids = await r.zrevrange(Z_DEPS_PENDING, 0, Math.max(0, limit - 1));
  if (!ids.length) return [];
  const pipe = r.pipeline();
  ids.forEach((id) => pipe.get(kDep(id)));
  const rows = (await pipe.exec()) as Array<[Error | null, string | null]>;
  const out: Deposit[] = [];
  rows.forEach(([, s]) => { if (s) try { out.push(JSON.parse(s)); } catch {} });
  return out;
}

/** ---------- Withdrawals ---------- */
export async function createWithdrawRequest(
  userId: number,
  amount: number,
  details: any
): Promise<Withdraw> {
  const amt = Math.floor(Number(amount || 0));
  if (!Number.isFinite(amt) || amt <= 0) throw new Error("bad amount");

  // резерв — сразу вычитаем
  const bal = await getBalance(userId);
  if (bal < amt) throw new Error("not enough balance");

  await addBalance(userId, -amt);

  const wd: Withdraw = {
    id: randId("wd"),
    userId,
    amount: amt,
    details: details ?? {},
    status: "pending",
    createdAt: Date.now(),
  };
  const r = redis();
  await setJSON(kWd(wd.id), wd);
  await r.zadd(Z_WDS_PENDING, wd.createdAt, wd.id);
  await pushHistory(userId, { t: "wd_pending", id: wd.id, amount: wd.amount });
  return wd;
}

export async function getWithdraw(id: string): Promise<Withdraw | null> {
  return await getJSON<Withdraw>(kWd(id));
}

export async function approveWithdraw(wd: Withdraw): Promise<void> {
  if (wd.status === "approved") return;
  wd.status = "approved";
  wd.approvedAt = Date.now();
  await setJSON(kWd(wd.id), wd);
  await redis().zrem(Z_WDS_PENDING, wd.id);
  await pushHistory(wd.userId, { t: "wd_approved", id: wd.id, amount: wd.amount });
}

export async function declineWithdraw(wd: Withdraw): Promise<void> {
  if (wd.status === "declined") return;
  wd.status = "declined";
  wd.declinedAt = Date.now();
  await setJSON(kWd(wd.id), wd);
  await redis().zrem(Z_WDS_PENDING, wd.id);
  // вернуть резерв
  await addBalance(wd.userId, wd.amount);
  await pushHistory(wd.userId, { t: "wd_declined", id: wd.id, amount: wd.amount });
}

export async function listPendingWithdrawals(limit = 50): Promise<Withdraw[]> {
  const r = redis();
  const ids = await r.zrevrange(Z_WDS_PENDING, 0, Math.max(0, limit - 1));
  if (!ids.length) return [];
  const pipe = r.pipeline();
  ids.forEach((id) => pipe.get(kWd(id)));
  const rows = (await pipe.exec()) as Array<[Error | null, string | null]>;
  const out: Withdraw[] = [];
  rows.forEach(([, s]) => { if (s) try { out.push(JSON.parse(s)); } catch {} });
  return out;
}
const kNonce = (id: number) => `nonce:${id}`;

/** Текущий nonce пользователя (0 по умолчанию) */
export async function getNonce(userId: number): Promise<number> {
  const s = await redis().get(kNonce(userId));
  return s ? Number(s) : 0;
}

/** Увеличить nonce и вернуть новое значение (INCR: 1,2,3,...) */
export async function incNonce(userId: number): Promise<number> {
  return await redis().incr(kNonce(userId));
}