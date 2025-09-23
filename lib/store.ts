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
  
  try {
    // Проверяем существующего пользователя
    const exists = await r.hexists(key, "id");
    
    if (!exists) {
      // Создаем нового пользователя
      await r.hset(key, {
        "id": String(u.id),
        "first_name": u.first_name || "",
        "username": u.username || "",
        "balance": "0",
        "lastSeenAt": String(Date.now())
      });
      console.log('New user created:', u.id);
    } else {
      // Обновляем данные существующего пользователя
      if (u.first_name) await r.hset(key, "first_name", u.first_name);
      if (u.username) await r.hset(key, "username", u.username);
      await r.hset(key, "lastSeenAt", String(Date.now()));
      console.log('User updated:', u.id);
    }
  } catch (error) {
    console.error("Error ensuring user:", error);
    throw error;
  }
}

export async function getBalance(userId: number): Promise<number> {
  try {
    const v = await redis().hget(kUser(userId), "balance");
    const balance = v ? Number(v) : 0;
    console.log('Retrieved balance for user', userId, ':', balance);
    return balance;
  } catch (error) {
    console.error("Error getting balance:", error);
    return 0;
  }
}

export async function addBalance(userId: number, delta: number): Promise<void> {
  try {
    console.log('Adding balance to user:', userId, 'delta:', delta);
    
    const currentBalance = await getBalance(userId);
    console.log('Current balance before:', currentBalance);
    
    await redis().hincrbyfloat(kUser(userId), "balance", delta);
    
    const newBalance = await getBalance(userId);
    console.log('New balance after:', newBalance);
    
  } catch (error) {
    console.error("Error adding balance:", error);
    throw error;
  }
}

/** История пользователя (список недавних событий: депы/выводы/ставки) */
export async function getUserHistory(userId: number): Promise<any[]> {
  try {
    const raw = await redis().lrange(kHist(userId), 0, 99);
    return raw.map((s) => {
      try { return JSON.parse(s); } catch { return null; }
    }).filter(Boolean);
  } catch (error) {
    console.error("Error getting user history:", error);
    return [];
  }
}

/** Пуш ставки в историю */
export async function pushBet(userId: number, bet: BetRecord) {
  try {
    await pushHistory(userId, { t: "bet", ...bet });
  } catch (error) {
    console.error("Error pushing bet:", error);
  }
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
  
  try {
    console.log('Creating deposit request:', dep);
    
    const r = redis();
    await setJSON(kDep(dep.id), dep);
    await r.zadd(Z_DEPS_PENDING, dep.createdAt, dep.id);
    await pushHistory(userId, { t: "dep_pending", id: dep.id, amount: dep.amount });
    
    console.log('Deposit created successfully:', dep.id);
    return dep;
  } catch (error) {
    console.error("Error creating deposit:", error);
    throw error;
  }
}

export async function getDeposit(id: string): Promise<Deposit | null> {
  try {
    const deposit = await getJSON<Deposit>(kDep(id));
    console.log('Retrieved deposit:', id, deposit ? 'found' : 'not found');
    return deposit;
  } catch (error) {
    console.error("Error getting deposit:", error);
    return null;
  }
}

export async function approveDeposit(dep: Deposit): Promise<void> {
  if (dep.status === "approved") {
    console.log('Deposit already approved:', dep.id);
    return;
  }
  
  try {
    console.log('Approving deposit in store:', dep.id, 'for user:', dep.userId, 'amount:', dep.amount);
    
    dep.status = "approved";
    dep.approvedAt = Date.now();
    await setJSON(kDep(dep.id), dep);
    await redis().zrem(Z_DEPS_PENDING, dep.id);
    await pushHistory(dep.userId, { t: "dep_approved", id: dep.id, amount: dep.amount });
    
    console.log('Deposit approved in store successfully:', dep.id);
  } catch (error) {
    console.error("Error approving deposit in store:", error);
    throw error;
  }
}

export async function declineDeposit(dep: Deposit): Promise<void> {
  if (dep.status === "declined") {
    console.log('Deposit already declined:', dep.id);
    return;
  }
  
  try {
    console.log('Declining deposit:', dep.id);
    
    dep.status = "declined";
    dep.declinedAt = Date.now();
    await setJSON(kDep(dep.id), dep);
    await redis().zrem(Z_DEPS_PENDING, dep.id);
    await pushHistory(dep.userId, { t: "dep_declined", id: dep.id, amount: dep.amount });
    
    console.log('Deposit declined successfully:', dep.id);
  } catch (error) {
    console.error("Error declining deposit:", error);
    throw error;
  }
}

export async function listPendingDeposits(limit = 50): Promise<Deposit[]> {
  try {
    const r = redis();
    const ids = await r.zrevrange(Z_DEPS_PENDING, 0, Math.max(0, limit - 1));
    if (!ids.length) return [];
    
    const pipe = r.pipeline();
    ids.forEach((id) => pipe.get(kDep(id)));
    const rows = (await pipe.exec()) as Array<[Error | null, string | null]>;
    
    const out: Deposit[] = [];
    rows.forEach(([, s]) => { if (s) try { out.push(JSON.parse(s)); } catch {} });
    
    console.log('Found pending deposits:', out.length);
    return out;
  } catch (error) {
    console.error("Error listing pending deposits:", error);
    return [];
  }
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
  
  try {
    const r = redis();
    await setJSON(kWd(wd.id), wd);
    await r.zadd(Z_WDS_PENDING, wd.createdAt, wd.id);
    await pushHistory(userId, { t: "wd_pending", id: wd.id, amount: wd.amount });
    return wd;
  } catch (error) {
    console.error("Error creating withdraw:", error);
    throw error;
  }
}

export async function getWithdraw(id: string): Promise<Withdraw | null> {
  try {
    return await getJSON<Withdraw>(kWd(id));
  } catch (error) {
    console.error("Error getting withdraw:", error);
    return null;
  }
}

export async function approveWithdraw(wd: Withdraw): Promise<void> {
  if (wd.status === "approved") return;
  
  try {
    wd.status = "approved";
    wd.approvedAt = Date.now();
    await setJSON(kWd(wd.id), wd);
    await redis().zrem(Z_WDS_PENDING, wd.id);
    await pushHistory(wd.userId, { t: "wd_approved", id: wd.id, amount: wd.amount });
  } catch (error) {
    console.error("Error approving withdraw:", error);
    throw error;
  }
}

export async function declineWithdraw(wd: Withdraw): Promise<void> {
  if (wd.status === "declined") return;
  
  try {
    wd.status = "declined";
    wd.declinedAt = Date.now();
    await setJSON(kWd(wd.id), wd);
    await redis().zrem(Z_WDS_PENDING, wd.id);
    // вернуть резерв
    await addBalance(wd.userId, wd.amount);
    await pushHistory(wd.userId, { t: "wd_declined", id: wd.id, amount: wd.amount });
  } catch (error) {
    console.error("Error declining withdraw:", error);
    throw error;
  }
}

export async function listPendingWithdrawals(limit = 50): Promise<Withdraw[]> {
  try {
    const r = redis();
    const ids = await r.zrevrange(Z_WDS_PENDING, 0, Math.max(0, limit - 1));
    if (!ids.length) return [];
    
    const pipe = r.pipeline();
    ids.forEach((id) => pipe.get(kWd(id)));
    const rows = (await pipe.exec()) as Array<[Error | null, string | null]>;
    
    const out: Withdraw[] = [];
    rows.forEach(([, s]) => { if (s) try { out.push(JSON.parse(s)); } catch {} });
    return out;
  } catch (error) {
    console.error("Error listing pending withdrawals:", error);
    return [];
  }
}

const kNonce = (id: number) => `nonce:${id}`;

/** Текущий nonce пользователя (0 по умолчанию) */
export async function getNonce(userId: number): Promise<number> {
  try {
    const s = await redis().get(kNonce(userId));
    return s ? Number(s) : 0;
  } catch (error) {
    console.error("Error getting nonce:", error);
    return 0;
  }
}

/** Увеличить nonce и вернуть новое значение (INCR: 1,2,3,...) */
export async function incNonce(userId: number): Promise<number> {
  try {
    return await redis().incr(kNonce(userId));
  } catch (error) {
    console.error("Error incrementing nonce:", error);
    throw error;
  }
}