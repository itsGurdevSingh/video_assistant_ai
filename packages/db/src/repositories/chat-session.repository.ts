import { and, desc, eq } from "drizzle-orm";

import type { Database } from "../client.js";
import { chatSessions } from "../schema.js";

export type CreateChatSessionInput = {
  videoId: string;
  title?: string;
};

export function createChatSessionRepository(db: Database) {
  return {
    async create(input: CreateChatSessionInput) {
      const result = await db.insert(chatSessions).values(input).returning();

      return result[0];
    },

    async findById(id: string) {
      const result = await db
        .select()
        .from(chatSessions)
        .where(eq(chatSessions.id, id))
        .limit(1);

      return result[0] ?? null;
    },

    async findByIdForVideo(id: string, videoId: string) {
      const result = await db
        .select()
        .from(chatSessions)
        .where(and(eq(chatSessions.id, id), eq(chatSessions.videoId, videoId)))
        .limit(1);

      return result[0] ?? null;
    },

    async listByVideo(videoId: string) {
      return db
        .select()
        .from(chatSessions)
        .where(eq(chatSessions.videoId, videoId))
        .orderBy(desc(chatSessions.updatedAt), desc(chatSessions.createdAt));
    },

    async touch(id: string) {
      const result = await db
        .update(chatSessions)
        .set({ updatedAt: new Date() })
        .where(eq(chatSessions.id, id))
        .returning();

      return result[0] ?? null;
    },
  };
}
