import type { RedisClientType } from "redis";
import { redis } from "./redis";

/* ========================= Types ========================= */

export type UserRecord = {
  id: number;
  first_name?: string;
  username?: string;
  lastSeenAt?: number;
};

export type BetRecord = {
  id: string;
  userId: number;
  amount: number;
  chance: number;
  result: "win" | "lose";
  payout: number;
  roll: number;
  commit: {
    serverSeedHash: string;
    serverSeed: string;
    clientSeed: string;
    hex: string;
  };
  nonce: number;
  createdAt: number;
};

export type DepositMethod = "fkwallet";
export type DepositStatus = "pending" | "approved" | "declined";

export type Deposit = {
  id: string;
  userId: number;
  amount: number;
  method: DepositMethod;
  status: DepositStatus;
  createdAt: number;
  approvedAt?: number;
  declinedAt?: number;
  meta?: any;
};

export type WithdrawStatus = "pending" | "approved" | "declined";
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

export type UserHistory = {
  deposits: Deposit[];
  withdrawals: Withdraw[];
  bets: BetRecord[];
};

/* ========================= Keys ========================= */

const kUser  = (id: number) => `user:${id}`;
const kBal   = (id: number) => `u:${id}:balance`;
const kNonce = (id: number) => `u:${id}:nonce`;

const kDep   = (id: string) => `dep:${id}`;
const Z_DEPS_ALL     = "deps:all";
const Z_DEPS_PENDING = "deps:pending";

const kW     = (id: string) => `wd:${id}`;
const Z_WD_ALL     = "wds:all";
const Z_WD_PENDING = "wds:pending";

const kBet   = (id: string) => `bet:${id}`;
const Z_BETS_ALL = "bets:all";

/* ========================= JSON helpers ========================= */

async function setJSON<T>(key: string, value: T): Promise<void> {
  const c = await redis();
  await c.set(key, JSON.stringify(value));
}

async function getJSON<T>(key: string): Promise<T | null> {
  const c = await redis();
  const s = await c.get(key);
  if (!s) return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

/* ========================= Users & balance ========================= */

export async function upsertUser(userId: number, data: UserRecord): Promise<void> {
  // храним пользователя как единый JSON
  const rec: UserRecord = {
    id: userId,
    first_name: data.first_name,
    username: data.username,
    lastSeenAt: data.lastSeenAt ?? Date.now(),
  };
  await setJSON<UserRecord>(kUser(userId), rec);
}

export async function getBalance(uid: number): Promise<number> {
  const c = await redis();
  const v = await c.get(kBal(uid));
  if (v == null) return 0;
  const n = typeof v === "string" ? parseInt(v, 10) : Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function setBalance(uid: number, value: number): Promise<number> {
  const c = await redis();
  const v = Math.max(0, Math.floor(value));
  await c.set(kBal(uid), String(v));
  return v;
}

export async function addBalance(uid: number, delta: number): Promise<number> {
  const c = await redis();
  const v = await c.incrBy(kBal(uid), Math.floor(delta));
  if (v < 0) {
    await c.set(kBal(uid), "0");
    return 0;
  }
  return v;
}

/* ========================= Nonce ========================= */

export async function getNonce(uid: number): Promise<number> {
  const c = await redis();
  const v = await c.get(kNonce(uid));
  if (v == null) return 0;
  return typeof v === "string" ? parseInt(v, 10) || 0 : Number(v) || 0;
}

export async function incNonce(uid: number, by = 1): Promise<number> {
  const c = await redis();
  return await c.incrBy(kNonce(uid), by);
}

/* ========================= Bets ========================= */

export async function writeBet(bet: BetRecord): Promise<void> {
  const c = await redis();
  await setJSON<BetRecord>(kBet(bet.id), bet);
  await c.zAdd(Z_BETS_ALL, [{ score: bet.createdAt, value: bet.id }]);
}

// алиас на случай старых импортов
export const pushBet = writeBet;

/* ========================= Deposits ========================= */

export async function createDepositRequest(
  userId: number,
  amount: number,
  method: DepositMethod,
  meta?: any
): Promise<Deposit> {
  const c = await redis();
  const id = `dep_${Date.now()}_${userId}_${Math.floor(Math.random() * 1e6)}`;
  const dep: Deposit = {
    id,
    userId,
    amount: Math.floor(amount),
    method,
    status: "pending",
    createdAt: Date.now(),
    meta: meta ?? undefined,
  };
  await setJSON<Deposit>(kDep(id), dep);
  await c.zAdd(Z_DEPS_ALL, [{ score: dep.createdAt, value: id }]);
  await c.zAdd(Z_DEPS_PENDING, [{ score: dep.createdAt, value: id }]);
  return dep;
}

export async function getDeposit(id: string): Promise<Deposit | null> {
  return getJSON<Deposit>(kDep(id));
}

// сделаю универсальные сигнатуры — можно передавать объект или id
export async function approveDeposit(depOrId: Deposit | string): Promise<Deposit | null> {
  const c = await redis();
  const dep = typeof depOrId === "string" ? await getDeposit(depOrId) : depOrId;
  if (!dep) return null;
  if (dep.status !== "pending") return dep;

  dep.status = "approved";
  dep.approvedAt = Date.now();
  await setJSON<Deposit>(kDep(dep.id), dep);
  await c.zRem(Z_DEPS_PENDING, dep.id);
  return dep;
}

export async function declineDeposit(depOrId: Deposit | string): Promise<Deposit | null> {
  const c = await redis();
  const dep = typeof depOrId === "string" ? await getDeposit(depOrId) : depOrId;
  if (!dep) return null;
  if (dep.status !== "pending") return dep;

  dep.status = "declined";
  dep.declinedAt = Date.now();
  await setJSON<Deposit>(kDep(dep.id), dep);
  await c.zRem(Z_DEPS_PENDING, dep.id);
  return dep;
}

export async function listPending(limit = 50): Promise<Deposit[]> {
  const c = await redis();
  // последние по времени (REV) — node-redis v4: zRange с опциями
  const ids = await c.zRange(Z_DEPS_PENDING, -limit, -1);
  const arr: Deposit[] = [];
  for (const id of ids) {
    const d = await getDeposit(id);
    if (d && d.status === "pending") arr.push(d);
  }
  // в порядке убывания времени
  arr.sort((a, b) => b.createdAt - a.createdAt);
  return arr;
}
export const listPendingDeposits = listPending;

/* ========================= Withdrawals ========================= */

export async function createWithdrawRequest(
  userId: number,
  amount: number,
  details?: any
): Promise<Withdraw> {
  const c = await redis();
  const id = `wd_${Date.now()}_${userId}_${Math.floor(Math.random() * 1e6)}`;
  const wd: Withdraw = {
    id,
    userId,
    amount: Math.floor(amount),
    status: "pending",
    createdAt: Date.now(),
    details: details ?? undefined,
  };
  await setJSON<Withdraw>(kW(id), wd);
  await c.zAdd(Z_WD_ALL, [{ score: wd.createdAt, value: id }]);
  await c.zAdd(Z_WD_PENDING, [{ score: wd.createdAt, value: id }]);
  return wd;
}

export async function getWithdraw(id: string): Promise<Withdraw | null> {
  return getJSON<Withdraw>(kW(id));
}

export async function approveWithdraw(wdOrId: Withdraw | string): Promise<Withdraw | null> {
  const c = await redis();
  const wd = typeof wdOrId === "string" ? await getWithdraw(wdOrId) : wdOrId;
  if (!wd) return null;
  if (wd.status !== "pending") return wd;

  wd.status = "approved";
  wd.approvedAt = Date.now();
  await setJSON<Withdraw>(kW(wd.id), wd);
  await c.zRem(Z_WD_PENDING, wd.id);
  return wd;
}

export async function declineWithdraw(wdOrId: Withdraw | string): Promise<Withdraw | null> {
  const c = await redis();
  const wd = typeof wdOrId === "string" ? await getWithdraw(wdOrId) : wdOrId;
  if (!wd) return null;
  if (wd.status !== "pending") return wd;

  wd.status = "declined";
  wd.declinedAt = Date.now();
  await setJSON<Withdraw>(kW(wd.id), wd);
  await c.zRem(Z_WD_PENDING, wd.id);
  return wd;
}

export async function listPendingWithdrawals(limit = 50): Promise<Withdraw[]> {
  const c = await redis();
  const ids = await c.zRange(Z_WD_PENDING, -limit, -1);
  const arr: Withdraw[] = [];
  for (const id of ids) {
    const w = await getWithdraw(id);
    if (w && w.status === "pending") arr.push(w);
  }
  arr.sort((a, b) => b.createdAt - a.createdAt);
  return arr;
}

/* ========================= User history ========================= */

export async function getUserHistory(userId: number, limit = 10): Promise<UserHistory> {
  const c = await redis();

  // Deposits
  const depIds = await c.zRange(Z_DEPS_ALL, -200, -1);
  const dRows: Deposit[] = [];
  for (const id of depIds.reverse()) {
    const d = await getDeposit(id);
    if (d && d.userId === userId) dRows.push(d);
    if (dRows.length >= limit) break;
  }

  // Withdrawals
  const wdIds = await c.zRange(Z_WD_ALL, -200, -1);
  const wRows: Withdraw[] = [];
  for (const id of wdIds.reverse()) {
    const w = await getWithdraw(id);
    if (w && w.userId === userId) wRows.push(w);
    if (wRows.length >= limit) break;
  }

  // Bets
  const betIds = await c.zRange(Z_BETS_ALL, -200, -1);
  const bRows: BetRecord[] = [];
  for (const id of betIds.reverse()) {
    const b = await getJSON<BetRecord>(kBet(id));
    if (b && b.userId === userId) bRows.push(b);
    if (bRows.length >= limit) break;
  }

  return { deposits: dRows, withdrawals: wRows, bets: bRows };
}