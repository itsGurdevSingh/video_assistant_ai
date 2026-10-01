import { asc, eq } from "drizzle-orm";

import type { Database } from "../client.js";
import { chatMessages } from "../schema.js";
import type { ChatMessageRole } from "../schema.js";

export type CreateChatMessageInput = {
  sessionId: string;
  role: ChatMessageRole;
  content: string;
};

export function createChatMessageRepository(db: Database) {
  return {
    async create(input: CreateChatMessageInput) {
      const result = await db.insert(chatMessages).values(input).returning();

      return result[0];
    },

    async listBySession(sessionId: string) {
      return db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.sessionId, sessionId))
        .orderBy(asc(chatMessages.createdAt), asc(chatMessages.id));
    },
  };
}
