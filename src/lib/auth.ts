/** Compatibility boundary for legacy server routes. Runtime persistence is client-only. */
export type User = { id: string; email: string; name?: string | null };
export type Session = { id: string; userId: string };

export const auth = { api: { async getSession(_options?: unknown): Promise<{ user: User } | null> { return null; } } };
const unavailable = async <T = unknown>(..._args: unknown[]): Promise<{ rows: T[]; rowCount: number }> => ({ rows: [], rowCount: 0 });
type PoolStub = { query: typeof unavailable; connect: () => Promise<{ query: typeof unavailable; release(): void }> };
export const pool: PoolStub = { query: unavailable, connect: async () => ({ query: unavailable, release() {} }) };
export const directPool: PoolStub = pool;
