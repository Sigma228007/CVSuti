import Redis from "ioredis";

/** ---------- Redis client (singleton) ---------- */
let _r: Redis | null = null;

export function redis(): Redis {
  if (_r) return _r;
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL is not set");
  _r = new Redis(url, { 
    maxRetriesPerRequest: 2, 
    lazyConnect: false,
  });
  return _r;
}

/** ---------- Types ---------- */
export type DepositStatus = "pending" | "approved" | "declined";
export type WithdrawStatus = "pending" | "approved" | "declined";

export type Deposit = {
  id: string;
  userId: number;
  amount: number;
  status: DepositStatus;
  createdAt: number;
  approvedAt?: number;
  declinedAt?: number;
  provider?: "fkwallet";
};

export type Withdraw = {
  id: string;
  userId: number;
  amount: number;
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
  balance?: number;
  lastSeenAt?: number;
  createdAt?: number;
};

export type BetRecord = {
  id: string;
  userId: number;
  amount: number;
  payout: number;
  rolled: number;
  chance?: number;
  realChance?: number;
  dir?: string;
  win?: boolean;
  createdAt: number;
};

/** ---------- Keys helpers ---------- */
const kUser = (id: number) => `user:${id}`;
const kHist = (id: number) => `hist:${id}`;
const kDep = (id: string) => `dep:${id}`;
const kWd = (id: string) => `wd:${id}`;
const kNonce = (id: number) => `nonce:${id}`;

const Z_DEPS_PENDING = "deps:pending";
const Z_WDS_PENDING = "wds:pending";

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
export async function userExists(userId: number): Promise<boolean> {
  try {
    return await redis().hexists(kUser(userId), "id") === 1;
  } catch (error) {
    console.error("Error checking user existence:", error);
    return false;
  }
}

export async function getUser(userId: number): Promise<UserRecord | null> {
  try {
    const userData = await redis().hgetall(kUser(userId));
    if (!userData || !userData.id) return null;
    
    return {
      id: parseInt(userData.id),
      first_name: userData.first_name || undefined,
      username: userData.username || undefined,
      balance: parseFloat(userData.balance || "0"),
      lastSeenAt: parseInt(userData.lastSeenAt || "0"),
      createdAt: parseInt(userData.createdAt || "0")
    };
  } catch (error) {
    console.error("Error getting user:", error);
    return null;
  }
}

export async function ensureUser(u: { id: number; first_name?: string; username?: string }) {
  const r = redis();
  const key = kUser(u.id);
  
  try {
    const exists = await userExists(u.id);
    
    if (!exists) {
      await r.hset(key, {
        "id": String(u.id),
        "first_name": u.first_name || "",
        "username": u.username || "",
        "balance": "1000",
        "lastSeenAt": String(Date.now()),
        "createdAt": String(Date.now())
      });
      console.log('New user created:', u.id, 'with initial balance 1000');
    } else {
      const updates: Record<string, string> = {};
      if (u.first_name) updates.first_name = u.first_name;
      if (u.username) updates.username = u.username;
      
      if (Object.keys(updates).length > 0) {
        await r.hset(key, updates);
      }
      
      await r.hset(key, "lastSeenAt", String(Date.now()));
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
    return balance;
  } catch (error) {
    console.error("Error getting balance:", error);
    return 0;
  }
}

export async function addBalance(userId: number, delta: number): Promise<void> {
  try {
    console.log('Adding balance to user:', userId, 'delta:', delta);
    
    const result = await redis().hincrbyfloat(kUser(userId), "balance", delta);
    const newBalance = parseFloat(result);
    
    if (newBalance < 0) {
      await redis().hincrbyfloat(kUser(userId), "balance", -delta);
      throw new Error("Insufficient balance");
    }
    
    console.log('New balance after:', newBalance);
  } catch (error) {
    console.error("Error adding balance:", error);
    throw error;
  }
}

export async function getUserHistory(userId: number, limit: number = 50): Promise<any[]> {
  try {
    const raw = await redis().lrange(kHist(userId), 0, limit - 1);
    return raw.map((s) => {
      try { 
        const item = JSON.parse(s);
        item.userId = userId;
        return item;
      } catch { 
        return null; 
      }
    }).filter(Boolean).reverse();
  } catch (error) {
    console.error("Error getting user history:", error);
    return [];
  }
}

export async function pushBet(userId: number, bet: BetRecord) {
  try {
    await pushHistory(userId, { 
      type: "bet",
      id: bet.id,
      amount: bet.amount,
      payout: bet.payout,
      rolled: bet.rolled,
      chance: bet.chance,
      realChance: bet.realChance,
      dir: bet.dir,
      win: bet.win,
      createdAt: bet.createdAt
    });
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
    await pushHistory(userId, { 
      type: "deposit_pending", 
      id: dep.id, 
      amount: dep.amount 
    });
    
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
    console.log('Approving deposit:', dep.id, 'for user:', dep.userId, 'amount:', dep.amount);
    
    dep.status = "approved";
    dep.approvedAt = Date.now();
    await setJSON(kDep(dep.id), dep);
    await redis().zrem(Z_DEPS_PENDING, dep.id);
    await addBalance(dep.userId, dep.amount);
    await pushHistory(dep.userId, { 
      type: "deposit_approved", 
      id: dep.id, 
      amount: dep.amount 
    });
    
    console.log('Deposit approved successfully:', dep.id);
  } catch (error) {
    console.error("Error approving deposit:", error);
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
    await pushHistory(dep.userId, { 
      type: "deposit_declined", 
      id: dep.id, 
      amount: dep.amount 
    });
    
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

  const bal = await getBalance(userId);
  if (bal < amt) throw new Error("not enough balance");

  // Сначала списываем средства
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
    await pushHistory(userId, { 
      type: "withdraw_pending", 
      id: wd.id, 
      amount: wd.amount,
      details: wd.details
    });
    return wd;
  } catch (error) {
    // Если ошибка при создании заявки, возвращаем средства
    await addBalance(userId, amt);
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
    await pushHistory(wd.userId, { 
      type: "withdraw_approved", 
      id: wd.id, 
      amount: wd.amount 
    });
  } catch (error) {
    console.error("Error approving withdraw:", error);
    throw error;
  }
}

export async function declineWithdraw(wd: Withdraw): Promise<void> {
  if (wd.status === "declined") return;
  
  try {
    // Возвращаем средства на баланс
    await addBalance(wd.userId, wd.amount);
    
    wd.status = "declined";
    wd.declinedAt = Date.now();
    await setJSON(kWd(wd.id), wd);
    await redis().zrem(Z_WDS_PENDING, wd.id);
    await pushHistory(wd.userId, { 
      type: "withdraw_declined", 
      id: wd.id, 
      amount: wd.amount 
    });
  } catch (error) {
    console.error("Error declining withdraw:", error);
    throw error;
  }
}

export async function cancelWithdrawByUser(wd: Withdraw): Promise<void> {
  if (wd.status !== "pending") {
    throw new Error("Cannot cancel processed withdraw");
  }
  
  try {
    // Возвращаем средства на баланс
    await addBalance(wd.userId, wd.amount);
    
    wd.status = "declined";
    wd.declinedAt = Date.now();
    await setJSON(kWd(wd.id), wd);
    await redis().zrem(Z_WDS_PENDING, wd.id);
    await pushHistory(wd.userId, { 
      type: "withdraw_cancelled", 
      id: wd.id, 
      amount: wd.amount 
    });
  } catch (error) {
    console.error("Error cancelling withdraw:", error);
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

/** ---------- Nonce management ---------- */
export async function getNonce(userId: number): Promise<number> {
  try {
    const s = await redis().get(kNonce(userId));
    return s ? Number(s) : 0;
  } catch (error) {
    console.error("Error getting nonce:", error);
    return 0;
  }
}

export async function incNonce(userId: number): Promise<number> {
  try {
    return await redis().incr(kNonce(userId));
  } catch (error) {
    console.error("Error incrementing nonce:", error);
    throw error;
  }
}