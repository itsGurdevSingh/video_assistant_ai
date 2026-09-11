import { eq } from "drizzle-orm";

import type { Database } from "../client.js";
import { users } from "../schema.js";

export type CreateUserInput = {
  name: string;
};

export function createUserRepository(db: Database) {
  return {
    async create(input: CreateUserInput) {
      const result = await db
        .insert(users)
        .values(input)
        .returning();

      return result[0];
    },

    async findById(id: string) {
      const result = await db
        .select()
        .from(users)
        .where(eq(users.id, id))
        .limit(1);

      return result[0] ?? null;
    },

    async list() {
      return db.select().from(users);
    },

    async delete(id: string) {
      const result = await db
        .delete(users)
        .where(eq(users.id, id))
        .returning();

      return result[0] ?? null;
    },
  };
}

