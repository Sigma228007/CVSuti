export type DepositStatus = 'pending' | 'approved' | 'declined'

export interface Deposit {
  id: string
  userId: number
  amount: number
  status: DepositStatus
  createdAt: number
}

const _deposits: Deposit[] = []

function genId(userId: number) {
  return `dep_${Date.now()}_${userId}_${Math.random().toString(36).slice(2, 8)}`
}

/** Создать новый депозит (pending) */
export function createDeposit(userId: number, amount: number): Deposit {
  const dep: Deposit = {
    id: genId(userId),
    userId,
    amount,
    status: 'pending',
    createdAt: Date.now()
  }
  _deposits.unshift(dep)
  return dep
}

/** Получить по id */
export function getDepositById(id: string): Deposit | undefined {
  return _deposits.find(d => d.id === id)
}

/** Одобрить депозит (если ещё pending) */
export function approveDeposit(id: string): Deposit | null {
  const dep = getDepositById(id)
  if (!dep) return null
  if (dep.status !== 'pending') return dep
  dep.status = 'approved'
  return dep
}

/** Отклонить депозит (если ещё pending) */
export function declineDeposit(id: string): Deposit | null {
  const dep = getDepositById(id)
  if (!dep) return null
  if (dep.status !== 'pending') return dep
  dep.status = 'declined'
  return dep
}

/** Показать все «ожидающие» депозиты пользователя (для UI) */
export function getPendingForUser(userId: number): Deposit[] {
  return _deposits.filter(d => d.userId === userId && d.status === 'pending')
}
export function getDeposit(id: string) {
  return getDepositById(id)
}

// Было: markDeposit(id, 'approved' | 'declined') — теперь:
export function markDeposit(
  id: string,
  status: 'approved' | 'declined'
) {
  if (status === 'approved') {
    return approveDeposit(id)
  } else {
    return declineDeposit(id)
  }
}