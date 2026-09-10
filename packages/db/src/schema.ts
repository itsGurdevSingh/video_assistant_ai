import {
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  check,
  real,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { sql } from "drizzle-orm";

export const videoSourceType = pgEnum("video_source_type", [
  "youtube",
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

export type VideoStatus =
  (typeof videoStatus.enumValues)[number];

export const users = pgTable("users", {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  createdAt: timestamp("created_at", {
    withTimezone: true,
  })
    .defaultNow()
    .notNull(),
});

export const videos = pgTable("videos", {
  id: uuid().primaryKey().defaultRandom(),

  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, {
      onDelete: "cascade",
    }),

  sourceType: videoSourceType("source_type").notNull(),

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
