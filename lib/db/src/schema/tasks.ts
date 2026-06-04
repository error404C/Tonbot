import { pgTable, serial, integer, text, numeric, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const tasksTable = pgTable("tasks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  reward: numeric("reward", { precision: 10, scale: 4 }).notNull(),
  url: text("url"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const taskCompletionsTable = pgTable("task_completions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  taskId: integer("task_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const taskSubmissionsTable = pgTable("task_submissions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  taskId: integer("task_id").notNull().references(() => tasksTable.id),
  proofData: text("proof_data").notNull(),
  status: text("status").notNull().default("pending"),
  reviewNote: text("review_note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTaskSchema = createInsertSchema(tasksTable).omit({ id: true, createdAt: true });
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasksTable.$inferSelect;
export type TaskCompletion = typeof taskCompletionsTable.$inferSelect;
export type TaskSubmission = typeof taskSubmissionsTable.$inferSelect;
