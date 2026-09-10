import { eq } from "drizzle-orm";

import type { Database } from "../client.js";
import { videos } from "../schema.js";

export function createVideoRepository(db: Database) {
  return {
    async findById(id: string) {
      const result = await db
        .select()
        .from(videos)
        .where(eq(videos.id, id))
        .limit(1);

      return result[0] ?? null;
    },
  };
}