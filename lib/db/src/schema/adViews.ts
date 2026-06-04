import { pgTable, serial, integer, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const adViewsTable = pgTable("ad_views", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  earned: numeric("earned", { precision: 10, scale: 4 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAdViewSchema = createInsertSchema(adViewsTable).omit({ id: true, createdAt: true });
export type InsertAdView = z.infer<typeof insertAdViewSchema>;
export type AdView = typeof adViewsTable.$inferSelect;
