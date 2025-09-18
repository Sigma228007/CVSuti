import { redis } from "./redis";

/** ===== КЛЮЧИ В REDIS ===== */
const balKey = (uid: number) => `u:${uid}:balance`;
const dataKey = (uid: number) => `u:${uid}:data`;
const nonceKey = "global:nonce";
const depKey = (id: string) => `dep:${id}`;

/** ===== Баланс ===== */
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

/** ===== Данные пользователя (при желании) ===== */
export async function upsertUser(uid: number, data: Record<string, any>) {
  const c = await redis();
  await c.hSet(
    dataKey(uid),
    Object.fromEntries(Object.entries(data).map(([k, v]) => [k, JSON.stringify(v)])),
  );
}

/** ===== Nonce для раундов/ставок ===== */
export async function getNonce(): Promise<number> {
  const c = await redis();
  const n = await c.incr(nonceKey);
  return Number(n);
}

/** ===== Лента последних ставок (ещё хранится в памяти процесса) ===== */
export type BetRecord = {
  id: string;
  userId: number;
  amount: number;
  dir: "under" | "over";
  chance: number;
  nonce: number;
  placedAt: number;
  outcome: {
    value: number;
    win: boolean;
    payout: number;
    coef: number;
    proof: {
      serverSeedHash: string;
      serverSeed: string;
      clientSeed: string;
      hex: string;
    };
  };
};

/** экспортируемый массив, чтобы импорт из '@/lib/store' не падал */
export const bets: BetRecord[] = [];

/** помощник — класть в ленту не больше 100 записей */
export function pushBet(bet: BetRecord) {
  bets.unshift(bet);
  if (bets.length > 100) bets.pop();
}

/** ===== Депозиты (для кнопок и FreeKassa) ===== */
export type Deposit = {
  id: string;                  // dep_...
  userId: number;
  amount: number;
  status: "pending" | "approved" | "declined";
  createdAt: number;
};

function makeDepId() {
  const rnd = Math.random().toString(36).slice(2, 7);
  return `dep_${Date.now()}_${rnd}`;
}

/** создать заявку на пополнение (pending) */
export async function createDepositRequest(userId: number, amount: number): Promise<Deposit> {
  const dep: Deposit = {
    id: makeDepId(),
    userId,
    amount: Math.floor(amount),
    status: "pending",
    createdAt: Date.now(),
  };
  const c = await redis();
  await c.set(depKey(dep.id), JSON.stringify(dep));
  return dep;
}

/** получить заявку */
export async function getDeposit(id: string): Promise<Deposit | null> {
  const r = await (await redis()).get(depKey(id));
  return r ? (JSON.parse(r) as Deposit) : null;
}

/** сохранить заявку */
async function saveDeposit(dep: Deposit) {
  await (await redis()).set(depKey(dep.id), JSON.stringify(dep));
}

/** подтвердить заявку (зачислить баланс) */
export async function approveDeposit(id: string): Promise<Deposit | null> {
  const dep = await getDeposit(id);
  if (!dep) return null;
  if (dep.status !== "pending") return dep;

  await addBalance(dep.userId, dep.amount);
  dep.status = "approved";
  await saveDeposit(dep);
  return dep;
}

/** отклонить заявку */
export async function declineDeposit(id: string): Promise<Deposit | null> {
  const dep = await getDeposit(id);
  if (!dep) return null;
  if (dep.status !== "pending") return dep;

  dep.status = "declined";
  await saveDeposit(dep);
  return dep;
}
export async function listPending(limit: number = 50): Promise<Deposit[]> {
  const c = await redis();
  let cursor = "0";
  const out: Deposit[] = [];

  do {
    // SCAN по ключам депов
    // @ts-expect-error — у клиента типы SCAN могут быть перегружены
    const [next, keys]: [string, string[]] = await c.scan(cursor, {
      MATCH: "dep:*",
      COUNT: 100,
    });
    cursor = next;

    if (keys && keys.length) {
      const vals = await c.mGet(keys);
      for (const v of vals) {
        if (!v) continue;
        try {
          const dep = JSON.parse(v) as Deposit;
          if (dep.status === "pending") out.push(dep);
        } catch {}
      }
    }

    // если уже набрали лимит — можно завершать
    if (out.length >= limit) break;
  } while (cursor !== "0");

  // сортируем по времени создания, свежие сверху
  out.sort((a, b) => b.createdAt - a.createdAt);

  return out.slice(0, limit);
}

// На случай, если в коде ожидается старое имя:
export const getPendingAll = listPending;