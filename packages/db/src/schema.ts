import {
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  check,
  real,
  index,
  uniqueIndex,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

import { sql } from "drizzle-orm";

export const videoSourceType = pgEnum("video_source_type", [
  "remote_url",
  "upload",
]);

export const videoStatus = pgEnum("video_status", [
  "queued",
  "downloading",
  "extracting_audio",
  "transcribing",
  "chunking",
  "embedding",
  "analyzing",
  "ready",
  "failed",
]);

export const chatMessageRole = pgEnum("chat_message_role", [
  "user",
  "assistant",
]);

export type VideoStatus = (typeof videoStatus.enumValues)[number];
export type ChatMessageRole = (typeof chatMessageRole.enumValues)[number];

export const users = pgTable(
  "users",
  {
    id: uuid().primaryKey().defaultRandom(),
    email: text().notNull(),
    passwordHash: text("password_hash").notNull(),
    name: text().notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [uniqueIndex("users_email_idx").on(table.email)],
);

export const authSessions = pgTable(
  "auth_sessions",
  {
    id: uuid().primaryKey().defaultRandom(),

    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
      }),

    tokenHash: text("token_hash").notNull(),

    expiresAt: timestamp("expires_at", {
      withTimezone: true,
    }).notNull(),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("auth_sessions_token_hash_idx").on(table.tokenHash),
    index("auth_sessions_user_id_idx").on(table.userId),
  ],
);

export const videos = pgTable("videos", {
  id: uuid().primaryKey().defaultRandom(),

  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, {
      onDelete: "cascade",
    }),

  sourceType: videoSourceType("source_type").notNull(),
  storageKey: text("storage_key"),

  sourceUrl: text("source_url"),

  title: text(),

  durationSeconds: integer("duration_seconds"),

  status: videoStatus().notNull().default("queued"),

  errorMessage: text("error_message"),

  createdAt: timestamp("created_at", {
    withTimezone: true,
  })
    .defaultNow()
    .notNull(),

  updatedAt: timestamp("updated_at", {
    withTimezone: true,
  })
    .defaultNow()
    .notNull(),
});

export const chatSessions = pgTable(
  "chat_sessions",
  {
    id: uuid().primaryKey().defaultRandom(),

    videoId: uuid("video_id")
      .notNull()
      .references(() => videos.id, {
        onDelete: "cascade",
      }),

    title: text(),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("chat_sessions_video_id_idx").on(table.videoId)],
);

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid().primaryKey().defaultRandom(),

    sessionId: uuid("session_id")
      .notNull()
      .references(() => chatSessions.id, {
        onDelete: "cascade",
      }),

    role: chatMessageRole().notNull(),

    content: text().notNull(),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("chat_messages_session_created_at_idx").on(
      table.sessionId,
      table.createdAt,
    ),
  ],
);

export const transcripts = pgTable(
  "transcripts",
  {
    id: uuid().primaryKey().defaultRandom(),

    videoId: uuid("video_id")
      .notNull()
      .references(() => videos.id, {
        onDelete: "cascade",
      }),

    language: text(),

    model: text(),

    text: text().notNull(),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [uniqueIndex("transcripts_video_id_idx").on(table.videoId)],
);

export const transcriptSegments = pgTable(
  "transcript_segments",
  {
    id: uuid().primaryKey().defaultRandom(),

    transcriptId: uuid("transcript_id")
      .notNull()
      .references(() => transcripts.id, {
        onDelete: "cascade",
      }),

    segmentIndex: integer("segment_index").notNull(),

    startSeconds: real("start_seconds").notNull(),

    endSeconds: real("end_seconds").notNull(),

    text: text().notNull(),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "transcript_segments_time_check",
      sql`${table.startSeconds} < ${table.endSeconds}`,
    ),
    check("transcript_segments_index_check", sql`${table.segmentIndex} >= 0`),
  ],
);

export const transcriptEmbeddings = pgTable("transcript_embeddings", {
  id: uuid("id").defaultRandom().primaryKey(),

  transcriptId: uuid("transcript_id")
    .notNull()
    .references(() => transcripts.id, {
      onDelete: "cascade",
    }),

  chunkIndex: integer("chunk_index").notNull(),

  text: text("text").notNull(),

  embedding: vector("embedding", {
    dimensions: 384,
  }).notNull(),

  startSeconds: real("start_seconds").notNull(),

  endSeconds: real("end_seconds").notNull(),

  embeddingModel: text("embedding_model").notNull(),

  createdAt: timestamp("created_at", {
    withTimezone: true,
  })
    .defaultNow()
    .notNull(),
});
