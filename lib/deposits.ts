type Deposit = {
  id: string;
  userId: number;
  amount: number;
  createdAt: number;
  status: "pending" | "approved" | "declined";
};

let db: Deposit[] = [];

export function createDeposit(userId: number, amount: number) {
  const dep: Deposit = {
    id: `dep_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    userId,
    amount,
    createdAt: Date.now(),
    status: "pending",
  };
  db.push(dep);
  return dep;
}

export function getPendingForUser(userId: number) {
  return db.filter((d) => d.userId === userId && d.status === "pending");
}

export function getDepositById(id: string) {
  return db.find((d) => d.id === id) || null;
}

export function markDeposit(id: string, status: "approved" | "declined") {
  const dep = getDepositById(id);
  if (!dep) return null;
  dep.status = status;
  return dep;
}

export function approveDeposit(id: string) {
  return markDeposit(id, "approved");
}

export function declineDeposit(id: string) {
  return markDeposit(id, "declined");
}