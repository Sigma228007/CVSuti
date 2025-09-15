export type BetDir = 'over' | 'under'


export interface BetRecord {
id: string
userId: number
amount: number
chance: number // 1..95
dir: BetDir
placedAt: number
nonce: number
outcome?: {
value: number // 0..999999
win: boolean
payout: number
coef: number
proof: { serverSeedHash: string; serverSeed: string; clientSeed: string; hex: string }
}
}


export const balances = new Map<number, number>()
export const nonces = new Map<number, number>()
export const bets: BetRecord[] = []


export function getNonce(userId: number) {
const n = (nonces.get(userId) ?? 0) + 1
nonces.set(userId, n)
return n
}


export function getBalance(userId: number) { return balances.get(userId) ?? 1000 }
export function setBalance(userId: number, v: number) { balances.set(userId, v) }