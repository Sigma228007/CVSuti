export type DepositStatus = "pending" | "approved" | "declined";

export type Deposit = {
  id: string;
  userId: number;
  amount: number;
  status: DepositStatus;
  createdAt: number;
};

const deposits: Deposit[] = [];

export function createDeposit(userId: number, amount: number): Deposit {
  const id = `dep_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const dep: Deposit = { id, userId, amount, status: "pending", createdAt: Date.now() };
  deposits.unshift(dep);
  return dep;
}

export function getById(id: string) {
  return deposits.find((d) => d.id === id);
}

export function getPendingForUser(userId: number) {
  return deposits.filter((d) => d.userId === userId && d.status === "pending");
}

export function approveDeposit(id: string) {
  const dep = getById(id);
  if (!dep) throw new Error("deposit not found");
  dep.status = "approved";
  return dep;
}

export function declineDeposit(id: string) {
  const dep = getById(id);
  if (!dep) throw new Error("deposit not found");
  dep.status = "declined";
  return dep;
}

export function allDeposits() {
  return deposits;
}