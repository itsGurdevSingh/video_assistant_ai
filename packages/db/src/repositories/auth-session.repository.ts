import { and, eq, gt } from "drizzle-orm";

import type { Database } from "../client.js";
import { authSessions, users } from "../schema.js";

export type CreateAuthSessionInput = {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
};

export function createAuthSessionRepository(db: Database) {
  return {
    async create(input: CreateAuthSessionInput) {
      const result = await db.insert(authSessions).values(input).returning();

      return result[0];
    },

    async findActiveByTokenHash(tokenHash: string) {
      const result = await db
        .select({
          session: authSessions,
          user: users,
        })
        .from(authSessions)
        .innerJoin(users, eq(authSessions.userId, users.id))
        .where(
          and(
            eq(authSessions.tokenHash, tokenHash),
            gt(authSessions.expiresAt, new Date()),
          ),
        )
        .limit(1);

      return result[0] ?? null;
    },

    async deleteByTokenHash(tokenHash: string) {
      const result = await db
        .delete(authSessions)
        .where(eq(authSessions.tokenHash, tokenHash))
        .returning();

      return result[0] ?? null;
    },
  };
}
