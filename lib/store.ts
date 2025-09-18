import { redis } from "./redis";

// ===== Баланс =====
const balKey = (uid: number) => `u:${uid}:balance`;

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
  if (v < 0) { await c.set(balKey(uid), "0"); return 0; }
  return v;
}

// ===== Nonce для честности (опционально, если используешь) =====
const nonceKey = "global:nonce";
export async function getNonce(): Promise<number> {
  const c = await redis();
  return Number(await c.incr(nonceKey));
}

// ===== Заявки на пополнение =====
// Сохраняем каждую заявку как Hash: dep:{id}
// и индекс с ожидалками — ZSET dep:pending (score = createdAt)
type Dep = {
  id: string;
  userId: number;
  amount: number;
  createdAt: number;
  status: "pending" | "approved" | "declined";
};
const depHash = (id: string) => `dep:${id}`;
const depPending = "dep:pending";

export async function createDepositRequest(userId: number, amount: number): Promise<Dep> {
  const id = `dep_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const rec: Dep = { id, userId, amount: Math.floor(amount), createdAt: Date.now(), status: "pending" };
  const c = await redis();
  await c.hSet(depHash(id), {
    id: rec.id, userId: String(rec.userId), amount: String(rec.amount),
    createdAt: String(rec.createdAt), status: rec.status
  });
  await c.zAdd(depPending, [{ score: rec.createdAt, value: rec.id }]);
  return rec;
}

export async function getDeposit(id: string): Promise<Dep | null> {
  const c = await redis();
  const h = await c.hGetAll(depHash(id));
  if (!h || !h.id) return null;
  return {
    id: h.id,
    userId: Number(h.userId),
    amount: Number(h.amount),
    createdAt: Number(h.createdAt),
    status: (h.status as any) || "pending",
  };
}

export async function listPending(): Promise<Dep[]> {
  const c = await redis();
  const ids = await c.zRange(depPending, 0, -1);
  const arr: Dep[] = [];
  for (const id of ids) {
    const d = await getDeposit(id);
    if (d && d.status === "pending") arr.push(d);
  }
  // новые сверху
  return arr.sort((a,b)=>b.createdAt - a.createdAt);
}

export async function setDepositStatus(id: string, status: Dep["status"]) {
  const c = await redis();
  await c.hSet(depHash(id), { status });
  if (status !== "pending") await c.zRem(depPending, id);
}

export async function approveDeposit(id: string): Promise<Dep | null> {
  const dep = await getDeposit(id);
  if (!dep || dep.status !== "pending") return null;
  await addBalance(dep.userId, dep.amount);
  await setDepositStatus(id, "approved");
  return { ...dep, status: "approved" };
}

export async function declineDeposit(id: string): Promise<Dep | null> {
  const dep = await getDeposit(id);
  if (!dep || dep.status !== "pending") return null;
  await setDepositStatus(id, "declined");
  return { ...dep, status: "declined" };
}