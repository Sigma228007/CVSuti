import { createClient, type RedisClientType } from "redis";

// ── Redis singleton ───────────────────────────────────────────────────────────
type R = RedisClientType<any, any, any>;

let client: R | null = null;
let connecting: Promise<R> | null = null;

export async function redis(): Promise<R> {
  if (client) return client;
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL is not set");
  if (!connecting) {
    connecting = (async () => {
      const c = createClient({ url }) as R;
      c.on("error", (e) => console.error("Redis error:", e));
      await c.connect();
      client = c;
      return c;
    })();
  }
  return connecting;
}

// ── JSON helpers ──────────────────────────────────────────────────────────────
export async function setJSON<T>(key: string, value: T): Promise<void> {
  await (await redis()).set(key, JSON.stringify(value));
}
export async function getJSON<T>(key: string): Promise<T | null> {
  const s = await (await redis()).get(key);
  if (!s) return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

// ── keys ──────────────────────────────────────────────────────────────────────
const balKey = (uid: number) => `bal:${uid}`;
const nonceKey = (uid: number) => `nonce:${uid}`;
const userKey = (uid: number) => `user:${uid}`;

const depKey = (id: string) => `dep:${id}`;
const depsPendingZ = "deps:pending";
const uDepHist = (uid: number) => `hist:dep:${uid}`;

const wdKey = (id: string) => `wd:${id}`;
const wdsPendingZ = "wds:pending";
const uWdHist = (uid: number) => `hist:wd:${uid}`;

const betKey = (id: string) => `bet:${id}`;
const uBetHist = (uid: number) => `hist:bet:${uid}`;

// ── types ─────────────────────────────────────────────────────────────────────
export type UserRecord = {
  id: number;
  first_name: string;
  username: string;
  lastSeenAt?: number;
};

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
  provider?: string; // напр. FKWallet
};

export type Withdraw = {
  id: string;
  userId: number;
  amount: number; // уходим в резерв
  status: WithdrawStatus;
  createdAt: number;
  approvedAt?: number;
  declinedAt?: number;
  details?: any;
};

export type BetRecord = {
  id: string;          // bet_...
  userId: number;
  amount: number;
  chance: number;
  result: "win" | "lose";
  payout: number;
  roll: number;
  commit: string;
  nonce: number;
  createdAt: number;
};

// ── users ─────────────────────────────────────────────────────────────────────
export async function upsertUser(user: UserRecord): Promise<void> {
  const now = Date.now();
  const merged: UserRecord = {
    id: user.id,
    first_name: user.first_name ?? "",
    username: user.username ?? "",
    lastSeenAt: user.lastSeenAt ?? now,
  };
  await setJSON(userKey(user.id), merged);
}

// ── balance / nonce ───────────────────────────────────────────────────────────
export async function getBalance(userId: number): Promise<number> {
  const v = await (await redis()).get(balKey(userId));
  return v ? Number(v) : 0;
}
export async function setBalance(userId: number, value: number): Promise<void> {
  await (await redis()).set(balKey(userId), String(Math.floor(value)));
}
export async function addBalance(userId: number, delta: number): Promise<number> {
  const c = await redis();
  // node-redis v4: incrByFloat есть
  const v = await c.incrByFloat(balKey(userId), delta);
  return Number(v);
}
export async function getNonce(userId: number): Promise<number> {
  const v = await (await redis()).get(nonceKey(userId));
  return v ? Number(v) : 0;
}
export async function incNonce(userId: number): Promise<number> {
  const v = await (await redis()).incr(nonceKey(userId));
  return Number(v);
}

// ── deposits ──────────────────────────────────────────────────────────────────
export async function createDepositRequest(
  userId: number,
  amount: number,
  meta?: Partial<Deposit>
): Promise<Deposit> {
  const dep: Deposit = {
    id: meta?.id ?? `dep_${Date.now()}_${userId}_${Math.floor(Math.random() * 1e6)}`,
    userId,
    amount: Math.floor(amount),
    status: "pending",
    createdAt: Date.now(),
    provider: meta?.provider ?? "FKWallet",
  };
  await setJSON(depKey(dep.id), dep);
  await (await redis()).zAdd(depsPendingZ, [{ score: dep.createdAt, value: dep.id }]);
  return dep;
}

export async function getDeposit(id: string): Promise<Deposit | null> {
  return getJSON<Deposit>(depKey(id));
}

export async function approveDeposit(id: string): Promise<Deposit | null> {
  const dep = await getDeposit(id);
  if (!dep) return null;
  if (dep.status !== "pending") return dep;

  dep.status = "approved";
  dep.approvedAt = Date.now();
  await setJSON(depKey(dep.id), dep);
  await (await redis()).zRem(depsPendingZ, dep.id);

  await addBalance(dep.userId, dep.amount);

  await (await redis()).lPush(
    uDepHist(dep.userId),
    JSON.stringify({
      id: dep.id,
      amount: dep.amount,
      status: dep.status,
      ts: dep.approvedAt,
      source: dep.provider ?? "FKWallet",
    })
  );

  return dep;
}

export async function declineDeposit(id: string): Promise<Deposit | null> {
  const dep = await getDeposit(id);
  if (!dep) return null;
  if (dep.status !== "pending") return dep;

  dep.status = "declined";
  dep.declinedAt = Date.now();
  await setJSON(depKey(dep.id), dep);
  await (await redis()).zRem(depsPendingZ, dep.id);

  await (await redis()).lPush(
    uDepHist(dep.userId),
    JSON.stringify({
      id: dep.id,
      amount: dep.amount,
      status: dep.status,
      ts: dep.declinedAt,
      source: dep.provider ?? "FKWallet",
    })
  );

  return dep;
}

export async function listPendingDeposits(limit = 50): Promise<Deposit[]> {
  const ids = await (await redis()).zRange(depsPendingZ, 0, limit - 1);
  if (!ids.length) return [];
  const out: Deposit[] = [];
  for (const id of ids) {
    const d = await getDeposit(id);
    if (d) out.push(d);
  }
  return out;
}

// ── withdrawals ───────────────────────────────────────────────────────────────
export async function createWithdrawRequest(
  userId: number,
  amount: number,
  details?: any
): Promise<Withdraw> {
  // резервируем
  await addBalance(userId, -Math.abs(amount));

  const wd: Withdraw = {
    id: `wd_${Date.now()}_${userId}_${Math.floor(Math.random() * 1e6)}`,
    userId,
    amount: Math.floor(Math.abs(amount)),
    status: "pending",
    createdAt: Date.now(),
    details,
  };
  await setJSON(wdKey(wd.id), wd);
  await (await redis()).zAdd(wdsPendingZ, [{ score: wd.createdAt, value: wd.id }]);
  return wd;
}

export async function getWithdraw(id: string): Promise<Withdraw | null> {
  return getJSON<Withdraw>(wdKey(id));
}

export async function approveWithdraw(id: string): Promise<Withdraw | null> {
  const wd = await getWithdraw(id);
  if (!wd) return null;
  if (wd.status !== "pending") return wd;

  wd.status = "approved";
  wd.approvedAt = Date.now();
  await setJSON(wdKey(wd.id), wd);
  await (await redis()).zRem(wdsPendingZ, wd.id);

  await (await redis()).lPush(
    uWdHist(wd.userId),
    JSON.stringify({
      id: wd.id,
      amount: wd.amount,
      status: wd.status,
      ts: wd.approvedAt,
    })
  );

  return wd;
}

export async function declineWithdraw(id: string): Promise<Withdraw | null> {
  const wd = await getWithdraw(id);
  if (!wd) return null;
  if (wd.status !== "pending") return wd;

  wd.status = "declined";
  wd.declinedAt = Date.now();
  await setJSON(wdKey(wd.id), wd);
  await (await redis()).zRem(wdsPendingZ, wd.id);

  // вернуть резерв
  await addBalance(wd.userId, wd.amount);

  await (await redis()).lPush(
    uWdHist(wd.userId),
    JSON.stringify({
      id: wd.id,
      amount: wd.amount,
      status: wd.status,
      ts: wd.declinedAt,
    })
  );

  return wd;
}

export async function listPendingWithdrawals(limit = 50): Promise<Withdraw[]> {
  const ids = await (await redis()).zRange(wdsPendingZ, 0, limit - 1);
  if (!ids.length) return [];
  const out: Withdraw[] = [];
  for (const id of ids) {
    const d = await getWithdraw(id);
    if (d) out.push(d);
  }
  return out;
}

// ── bets ──────────────────────────────────────────────────────────────────────
export async function writeBet(bet: BetRecord): Promise<void> {
  await setJSON(betKey(bet.id), bet);
  const short = {
    id: bet.id,
    amount: bet.amount,
    result: bet.result,
    payout: bet.payout,
    roll: bet.roll,
    chance: bet.chance,
    ts: bet.createdAt,
  };
  await (await redis()).lPush(uBetHist(bet.userId), JSON.stringify(short));
}

// ── user history (для профиля) ────────────────────────────────────────────────
export async function getUserHistory(
  userId: number,
  limit = 50
): Promise<{ deposits: any[]; withdrawals: any[]; bets: any[] }> {
  const c = await redis();
  const [d, w, b] = await Promise.all([
    c.lRange(uDepHist(userId), 0, limit - 1),
    c.lRange(uWdHist(userId), 0, limit - 1),
    c.lRange(uBetHist(userId), 0, limit - 1),
  ]);
  const parse = (arr: string[]) =>
    arr
      .map((x) => {
        try {
          return JSON.parse(x);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  return {
    deposits: parse(d),
    withdrawals: parse(w),
    bets: parse(b),
  };
}