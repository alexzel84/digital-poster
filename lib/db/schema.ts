import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  bigint,
  pgEnum,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const mediaTypeEnum = pgEnum("media_type", ["image", "video"]);

/**
 * Mirrors auth.users. We keep a thin local `users` table so we can
 * foreign-key against it from app tables without touching the
 * Supabase-managed auth schema.
 */
export const users = pgTable("users", {
  id: uuid("id").primaryKey(), // same id as auth.users.id
  email: text("email").notNull(),
  termsAcceptedAt: timestamp("terms_accepted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const screens = pgTable("screens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  address: text("address"),
  businessType: text("business_type"),
  pairingCode: text("pairing_code").notNull(),
  pairingCodeExpiresAt: timestamp("pairing_code_expires_at", {
    withTimezone: true,
  }),
  screenTokenHash: text("screen_token_hash"),
  manifestVersion: integer("manifest_version").notNull().default(0),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const media = pgTable("media", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  type: mediaTypeEnum("type").notNull(),
  mimeType: text("mime_type").notNull(),
  storageKey: text("storage_key").notNull(),
  size: bigint("size", { mode: "number" }).notNull(),
  hash: text("hash").notNull(),
  durationSeconds: integer("duration_seconds"), // natural video duration, null for images
  imageDurationSeconds: integer("image_duration_seconds").default(8), // configurable, images only
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  // Tracks duplication lineage: when a screen is duplicated, each new
  // media row points back at the ORIGINAL row it was cloned from (never
  // chained — duplicating a duplicate still points at the same root).
  // Used only to prevent "also show on" from linking two family members
  // onto the same screen (which would show the same content twice).
  // Never used for playback/ownership logic. Set null if the root is
  // ever deleted — siblings just become untracked independent items.
  clonedFromId: uuid("cloned_from_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const screenMedia = pgTable(
  "screen_media",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    screenId: uuid("screen_id")
      .notNull()
      .references(() => screens.id, { onDelete: "cascade" }),
    mediaId: uuid("media_id")
      .notNull()
      .references(() => media.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    screenMediaUnique: uniqueIndex("screen_media_unique").on(
      table.screenId,
      table.mediaId
    ),
  })
);

export const screenCollaborators = pgTable(
  "screen_collaborators",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    screenId: uuid("screen_id")
      .notNull()
      .references(() => screens.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    screenCollaboratorUnique: uniqueIndex("screen_collaborator_unique").on(
      table.screenId,
      table.userId
    ),
  })
);

export const screenInvites = pgTable("screen_invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  screenId: uuid("screen_id")
    .notNull()
    .references(() => screens.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  createdByUserId: uuid("created_by_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedByUserId: uuid("accepted_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  screens: many(screens),
  media: many(media),
}));

export const screensRelations = relations(screens, ({ one, many }) => ({
  user: one(users, { fields: [screens.userId], references: [users.id] }),
  screenMedia: many(screenMedia),
}));

export const mediaRelations = relations(media, ({ one, many }) => ({
  user: one(users, { fields: [media.userId], references: [users.id] }),
  screenMedia: many(screenMedia),
}));

export const screenMediaRelations = relations(screenMedia, ({ one }) => ({
  screen: one(screens, {
    fields: [screenMedia.screenId],
    references: [screens.id],
  }),
  media: one(media, { fields: [screenMedia.mediaId], references: [media.id] }),
}));
