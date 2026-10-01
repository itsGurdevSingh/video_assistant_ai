import { db, pool } from "./client.js";
import { users } from "./schema.js";

import { eq } from "drizzle-orm";

export { db, pool } from "./client.js";
export type { Database } from "./client.js";
export * from "./schema.js";

export * from "./repositories/video.repository.js";
export * from "./repositories/transcript.repository.js";
export * from "./repositories/user.repository.js";
export * from "./repositories/transcript-embedding.repository.js";
export * from "./repositories/chat-session.repository.js";
export * from "./repositories/chat-message.repository.js";
export * from "./repositories/auth-session.repository.js";
