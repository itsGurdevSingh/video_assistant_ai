import { eq, InferSelectModel, sql } from "drizzle-orm";

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

    async claimNextQueued() {
      const result = await db.execute(sql`
          WITH candidate AS (
            SELECT id
            FROM videos
            WHERE status = 'queued'
               OR (
                 status = 'downloading'
                 AND updated_at < now() - interval '5 minutes'
               )
            ORDER BY created_at
            FOR UPDATE SKIP LOCKED
            LIMIT 1
          )
          UPDATE videos
          SET status = 'downloading',
              error_message = NULL,
              updated_at = now()
          FROM candidate
          WHERE videos.id = candidate.id
          RETURNING videos.*
        `);

      return result.rows[0] as InferSelectModel<typeof videos> | undefined;
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
