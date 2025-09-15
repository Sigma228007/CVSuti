export type Deposit = {
  id: string;
  userId: number;
  amount: number;
  status: 'pending' | 'approved' | 'declined';
  createdAt: number;
};

// простая in-memory коллекция (в проде замените на БД)
const deposits: Deposit[] = [];

export function createDeposit(userId: number, amount: number): Deposit {
  const dep: Deposit = {
    id: `dep_${Date.now()}_${userId}_${Math.random().toString(36).slice(2, 6)}`,
    userId,
    amount,
    status: 'pending',
    createdAt: Date.now(),
  };
  deposits.push(dep);
  return dep;
}

export function getDeposit(id: string): Deposit | undefined {
  return deposits.find((d) => d.id === id);
}

export function markDeposit(id: string, status: 'approved' | 'declined') {
  const dep = getDeposit(id);
  if (dep) dep.status = status;
  return dep;
}

export function getPendingForUser(userId: number): Deposit[] {
  return deposits.filter((d) => d.userId === userId && d.status === 'pending');
}

export function getAllPending(): Deposit[] {
  return deposits.filter((d) => d.status === 'pending');
}