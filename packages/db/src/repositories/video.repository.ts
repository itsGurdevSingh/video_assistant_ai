  import { eq, InferSelectModel } from "drizzle-orm";

  import type { Database } from "../client.js";
  import { videos } from "../schema.js";
  import type { VideoStatus } from "../schema.js";

  export type CreateVideoInput = {
    userId: string;
    sourceType: "upload" | "remote_url";
    sourceUrl?: string;
    storageKey?: string;
    title?: string;
    durationSeconds?: number;
  };

  export function createVideoRepository(db: Database) {
    return {
      async create(input: CreateVideoInput) {
        const result = await db.insert(videos).values(input).returning();

        return result[0];
      },

      async findById(id: string) {
        const result = await db
          .select()
          .from(videos)
          .where(eq(videos.id, id))
          .limit(1);

        return result[0] ?? null;
      },

      async listByUser(userId: string) {
        return db.select().from(videos).where(eq(videos.userId, userId));
      },

      async updateStatus(id: string, status: VideoStatus, errorMessage?: string) {
        const result = await db
          .update(videos)
          .set({
            status,
            errorMessage: errorMessage ?? null,
            updatedAt: new Date(),
          })
          .where(eq(videos.id, id))
          .returning();

        return result[0] ?? null;
      },
    };
  }
