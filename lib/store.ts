export type BetRecord = {
  id: string;
  userId: number;
  amount: number;
  chance: number;
  dir: 'over' | 'under';
  placedAt: number;
  nonce: number;
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

export type DepositRequest = {
  id: string;
  userId: number;
  amount: number;
  createdAt: number;
  status: 'pending' | 'approved' | 'declined';
};

const balances = new Map<number, number>();
export const bets: BetRecord[] = [];
export const deposits: DepositRequest[] = [];

// Баланс
export function getBalance(uid: number) {
  return balances.get(uid) ?? 0;
}
export function setBalance(uid: number, v: number) {
  balances.set(uid, v);
}

export function addBalance(userId: number, delta: number) {
  setBalance(userId, getBalance(userId) + delta);
}

// Nonce per user (для fair roll)
const nonces = new Map<number, number>();
export function getNonce(uid: number) {
  const n = nonces.get(uid) ?? 0;
  nonces.set(uid, n + 1);
  return n;
}

// Deposits
export function createDeposit(userId: number, amount: number): DepositRequest {
  const rec: DepositRequest = {
    id: `dep_${Date.now()}_${userId}_${Math.random().toString(36).slice(2, 8)}`,
    userId,
    amount,
    createdAt: Date.now(),
    status: 'pending',
  };
  deposits.unshift(rec);
  return rec;
}

export function listPendingDeposits(): DepositRequest[] {
  return deposits.filter(d => d.status === 'pending');
}

export function setDepositStatus(id: string, status: 'approved' | 'declined'): DepositRequest | undefined {
  const d = deposits.find(x => x.id === id);
  if (!d) return undefined;
  d.status = status;
  if (status === 'approved') {
    const cur = getBalance(d.userId);
    setBalance(d.userId, cur + d.amount);
  }
  return d;
}