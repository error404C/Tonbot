import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const requiredChannelsTable = pgTable("required_channels", {
  id: serial("id").primaryKey(),
  channelId: text("channel_id").notNull(),
  title: text("title").notNull(),
  url: text("url").notNull(),
  checkMembership: boolean("check_membership").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type RequiredChannel = typeof requiredChannelsTable.$inferSelect;
