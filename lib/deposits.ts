export type Deposit = {
  id: string;
  userId: number;
  amount: number;
  createdAt: number;
  status: 'pending' | 'approved' | 'declined';
};

const _deposits = new Map<string, Deposit>();

export function createDeposit(userId: number, amount: number): Deposit {
  const id = `dep_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const dep: Deposit = { id, userId, amount, createdAt: Date.now(), status: 'pending' };
  _deposits.set(id, dep);
  return dep;
}

export function getDeposit(id: string) {
  return _deposits.get(id);
}

export function markDeposit(id: string, status: Deposit['status']) {
  const d = _deposits.get(id);
  if (d) { d.status = status; _deposits.set(id, d); }
}

export function listDeposits() {
  return Array.from(_deposits.values()).sort((a,b)=>b.createdAt - a.createdAt);
}