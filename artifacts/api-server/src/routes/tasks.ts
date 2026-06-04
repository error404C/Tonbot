import { Router } from "express";
import { db } from "@workspace/db";
import { tasksTable, taskCompletionsTable, taskSubmissionsTable, usersTable } from "@workspace/db";
import { eq, and, sql, inArray } from "drizzle-orm";
import { CompleteTaskBody, CreateTaskBody, UpdateTaskBody, DeleteTaskBody } from "@workspace/api-zod";

const router = Router();
const ADMIN_ID = process.env.ADMIN_TELEGRAM_ID!;

// ── List tasks with completion + submission status ────────────────────────────
router.get("/tasks", async (req, res) => {
  const { telegramId } = req.query as Record<string, string>;
  if (!telegramId) return res.status(400).json({ error: "telegramId required" });

  const user = await db.query.usersTable.findFirst({
    where: eq(usersTable.telegramId, telegramId),
  });

  const allTasks = await db
    .select()
    .from(tasksTable)
    .where(eq(tasksTable.isActive, true));

  if (!user) {
    return res.json(
      allTasks.map((t) => ({
        id: t.id, title: t.title, description: t.description,
        reward: parseFloat(t.reward as string), url: t.url, isActive: t.isActive,
        completed: false, submissionStatus: "none", createdAt: t.createdAt.toISOString(),
      }))
    );
  }

  const completions = await db
    .select()
    .from(taskCompletionsTable)
    .where(eq(taskCompletionsTable.userId, user.id));

  const submissions = await db
    .select()
    .from(taskSubmissionsTable)
    .where(eq(taskSubmissionsTable.userId, user.id));

  const completedIds = new Set(completions.map((c) => c.taskId));

  // latest submission per task (track by most recent createdAt)
  const submissionMap = new Map<number, { status: string; createdAt: Date }>();
  for (const s of submissions) {
    const existing = submissionMap.get(s.taskId);
    if (!existing || s.createdAt > existing.createdAt) {
      submissionMap.set(s.taskId, { status: s.status, createdAt: s.createdAt });
    }
  }

  return res.json(
    allTasks.map((t) => ({
      id: t.id, title: t.title, description: t.description,
      reward: parseFloat(t.reward as string), url: t.url, isActive: t.isActive,
      completed: completedIds.has(t.id),
      submissionStatus: completedIds.has(t.id) ? "approved" : (submissionMap.get(t.id)?.status ?? "none"),
      createdAt: t.createdAt.toISOString(),
    }))
  );
});

// ── Submit proof for a task ───────────────────────────────────────────────────
router.post("/tasks/:taskId/submit", async (req, res) => {
  const taskId = parseInt(req.params.taskId);
  const { telegramId, proofData } = req.body as { telegramId: string; proofData: string };

  if (!telegramId) return res.status(400).json({ error: "telegramId required" });
  if (!proofData) return res.status(400).json({ error: "proofData required" });

  const task = await db.query.tasksTable.findFirst({
    where: and(eq(tasksTable.id, taskId), eq(tasksTable.isActive, true)),
  });
  if (!task) return res.status(404).json({ error: "Task not found" });

  const user = await db.query.usersTable.findFirst({
    where: eq(usersTable.telegramId, telegramId),
  });
  if (!user) return res.status(404).json({ error: "User not found" });

  // Check if already completed
  const existing = await db.query.taskCompletionsTable.findFirst({
    where: and(eq(taskCompletionsTable.userId, user.id), eq(taskCompletionsTable.taskId, taskId)),
  });
  if (existing) return res.status(400).json({ error: "Task already completed" });

  // Check for existing pending submission
  const pendingSub = await db.query.taskSubmissionsTable.findFirst({
    where: and(
      eq(taskSubmissionsTable.userId, user.id),
      eq(taskSubmissionsTable.taskId, taskId),
      eq(taskSubmissionsTable.status, "pending")
    ),
  });
  if (pendingSub) return res.status(400).json({ error: "Proof already submitted, waiting for review." });

  const [submission] = await db
    .insert(taskSubmissionsTable)
    .values({ userId: user.id, taskId, proofData, status: "pending" })
    .returning();

  return res.json({ ok: true, submissionId: submission.id });
});

// ── Admin: list task submissions ──────────────────────────────────────────────
router.get("/admin/task-submissions", async (req, res) => {
  const { adminTelegramId, status } = req.query as Record<string, string>;
  if (adminTelegramId !== ADMIN_ID) return res.status(403).json({ error: "Forbidden" });

  const filter = status || "pending";

  const subs = await db
    .select({
      id: taskSubmissionsTable.id,
      userId: taskSubmissionsTable.userId,
      taskId: taskSubmissionsTable.taskId,
      proofData: taskSubmissionsTable.proofData,
      status: taskSubmissionsTable.status,
      reviewNote: taskSubmissionsTable.reviewNote,
      createdAt: taskSubmissionsTable.createdAt,
      userTelegramId: usersTable.telegramId,
      username: usersTable.username,
      firstName: usersTable.firstName,
      taskTitle: tasksTable.title,
      taskReward: tasksTable.reward,
    })
    .from(taskSubmissionsTable)
    .innerJoin(usersTable, eq(taskSubmissionsTable.userId, usersTable.id))
    .innerJoin(tasksTable, eq(taskSubmissionsTable.taskId, tasksTable.id))
    .where(eq(taskSubmissionsTable.status, filter))
    .orderBy(taskSubmissionsTable.createdAt);

  return res.json(subs.map((s) => ({
    id: s.id,
    userId: s.userId,
    taskId: s.taskId,
    proofData: s.proofData,
    status: s.status,
    reviewNote: s.reviewNote,
    createdAt: s.createdAt.toISOString(),
    user: { telegramId: s.userTelegramId, username: s.username, firstName: s.firstName },
    task: { title: s.taskTitle, reward: parseFloat(s.taskReward as string) },
  })));
});

// ── Admin: approve submission ─────────────────────────────────────────────────
router.post("/admin/task-submissions/:id/approve", async (req, res) => {
  const subId = parseInt(req.params.id);
  const { adminTelegramId } = req.body as { adminTelegramId: string };
  if (adminTelegramId !== ADMIN_ID) return res.status(403).json({ error: "Forbidden" });

  const sub = await db.query.taskSubmissionsTable.findFirst({
    where: and(eq(taskSubmissionsTable.id, subId), eq(taskSubmissionsTable.status, "pending")),
  });
  if (!sub) return res.status(404).json({ error: "Submission not found or already reviewed" });

  const task = await db.query.tasksTable.findFirst({ where: eq(tasksTable.id, sub.taskId) });
  if (!task) return res.status(404).json({ error: "Task not found" });

  // Mark submission approved
  await db.update(taskSubmissionsTable)
    .set({ status: "approved" })
    .where(eq(taskSubmissionsTable.id, subId));

  // Create completion record
  await db.insert(taskCompletionsTable)
    .values({ userId: sub.userId, taskId: sub.taskId })
    .onConflictDoNothing();

  // Credit reward
  const earned = parseFloat(task.reward as string);
  await db.update(usersTable)
    .set({
      balance: sql`${usersTable.balance} + ${earned}`,
      totalEarned: sql`${usersTable.totalEarned} + ${earned}`,
    })
    .where(eq(usersTable.id, sub.userId));

  return res.json({ ok: true, earned });
});

// ── Admin: reject submission ──────────────────────────────────────────────────
router.post("/admin/task-submissions/:id/reject", async (req, res) => {
  const subId = parseInt(req.params.id);
  const { adminTelegramId, reviewNote } = req.body as { adminTelegramId: string; reviewNote?: string };
  if (adminTelegramId !== ADMIN_ID) return res.status(403).json({ error: "Forbidden" });

  const sub = await db.query.taskSubmissionsTable.findFirst({
    where: and(eq(taskSubmissionsTable.id, subId), eq(taskSubmissionsTable.status, "pending")),
  });
  if (!sub) return res.status(404).json({ error: "Submission not found or already reviewed" });

  await db.update(taskSubmissionsTable)
    .set({ status: "rejected", reviewNote: reviewNote || null })
    .where(eq(taskSubmissionsTable.id, subId));

  return res.json({ ok: true });
});

// ── Admin CRUD tasks ──────────────────────────────────────────────────────────
router.post("/admin/tasks", async (req, res) => {
  const parsed = CreateTaskBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid body" });
  const { adminTelegramId, title, description, reward, url, isActive } = parsed.data;
  if (adminTelegramId !== ADMIN_ID) return res.status(403).json({ error: "Forbidden" });

  const [task] = await db
    .insert(tasksTable)
    .values({ title, description, reward: reward.toString(), url: url || null, isActive: isActive ?? true })
    .returning();

  return res.json({ ...task, reward: parseFloat(task.reward as string), createdAt: task.createdAt.toISOString() });
});

router.put("/admin/tasks/:taskId", async (req, res) => {
  const taskId = parseInt(req.params.taskId);
  const parsed = UpdateTaskBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid body" });
  const { adminTelegramId, title, description, reward, url, isActive } = parsed.data;
  if (adminTelegramId !== ADMIN_ID) return res.status(403).json({ error: "Forbidden" });

  const [task] = await db
    .update(tasksTable)
    .set({ title, description, reward: reward.toString(), url: url ?? null, isActive: isActive ?? true })
    .where(eq(tasksTable.id, taskId))
    .returning();

  return res.json({ ...task, reward: parseFloat(task.reward as string), createdAt: task.createdAt.toISOString() });
});

router.delete("/admin/tasks/:taskId", async (req, res) => {
  const taskId = parseInt(req.params.taskId);
  const parsed = DeleteTaskBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid body" });
  if (parsed.data.adminTelegramId !== ADMIN_ID) return res.status(403).json({ error: "Forbidden" });

  await db.update(tasksTable).set({ isActive: false }).where(eq(tasksTable.id, taskId));
  return res.json({ ok: true });
});

export default router;
