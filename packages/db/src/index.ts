import { db, pool } from "./client.js";
import { users } from "./schema.js";

import { eq } from "drizzle-orm";


export { db, pool } from "./client.js";
export type { Database } from "./client.js";
export * from "./schema.js";

export { createVideoRepository } from "./repositories/video.repository.js"; 