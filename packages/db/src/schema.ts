import {
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

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
