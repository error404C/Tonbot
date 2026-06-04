import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, withdrawalsTable, tasksTable, settingsTable, adViewsTable } from "@workspace/db";
import { eq, sql, sum, desc, or, ilike } from "drizzle-orm";
import {
  ApproveWithdrawalBody,
  RejectWithdrawalBody,
} from "@workspace/api-zod";
import {
  sendWithdrawalApprovedNotification,
  sendWithdrawalRejectedNotification,
  broadcastMessage,
  getBroadcastJob,
  bot,
} from "../bot";
import { logger } from "../lib/logger";
import { randomUUID } from "crypto";

const router = Router();
const ADMIN_ID = process.env.ADMIN_TELEGRAM_ID!;

export async function isAdmin(id: string): Promise<boolean> {
  if (id === ADMIN_ID) return true;
  try {
    const extraRow = await db.query.settingsTable.findFirst({ where: eq(settingsTable.key, "extra_admin_ids") });
    const extraIds = extraRow?.value?.split(",").map((s) => s.trim()).filter(Boolean) || [];
    return extraIds.includes(id);
  } catch {
    return false;
  }
}

async function upsertSetting(key: string, value: string) {
  await db.insert(settingsTable).values({ key, value })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value, updatedAt: new Date() } });
}

async function buildSettingsResponse() {
  const rows = await db.select().from(settingsTable);
  const map: Record<string, string> = {
    earn_per_ad: "0.003",
    referral_reward: "0.05",
    min_withdrawal: "0.50",
    add_task_url: "",
    daily_watch_limit: "20",
    withdrawal_ads_required: "15",
    airdrop_ended: "false",
    airdrop_channel: "",
    monetag_script: "",
    extra_admin_ids: "",
  };
  for (const row of rows) map[row.key] = row.value;

  return {
    earnPerAd: parseFloat(map["earn_per_ad"]),
    referralReward: parseFloat(map["referral_reward"]),
    minWithdrawal: parseFloat(map["min_withdrawal"]),
    addTaskUrl: map["add_task_url"] || null,
    dailyWatchLimit: parseInt(map["daily_watch_limit"], 10),
    withdrawalAdsRequired: parseInt(map["withdrawal_ads_required"], 10),
    airdropEnded: map["airdrop_ended"] === "true",
    airdropChannel: map["airdrop_channel"] || null,
    monetagScript: map["monetag_script"] || null,
    extraAdminIds: map["extra_admin_ids"] || null,
  };
}

// ── Settings ──────────────────────────────────────────────────────────────────
router.put("/admin/settings", async (req, res) => {
  const body = req.body as Record<string, any>;
  const adminTelegramId = body?.adminTelegramId;
  if (!adminTelegramId || !(await isAdmin(adminTelegramId))) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const updates: Array<{ key: string; value: string }> = [];
  if (body.earnPerAd !== undefined) updates.push({ key: "earn_per_ad", value: String(body.earnPerAd) });
  if (body.referralReward !== undefined) updates.push({ key: "referral_reward", value: String(body.referralReward) });
  if (body.minWithdrawal !== undefined) updates.push({ key: "min_withdrawal", value: String(body.minWithdrawal) });
  if (body.addTaskUrl !== undefined) updates.push({ key: "add_task_url", value: String(body.addTaskUrl) });
  if (body.dailyWatchLimit !== undefined) updates.push({ key: "daily_watch_limit", value: String(body.dailyWatchLimit) });
  if (body.withdrawalAdsRequired !== undefined) updates.push({ key: "withdrawal_ads_required", value: String(body.withdrawalAdsRequired) });
  if (body.airdropEnded !== undefined) updates.push({ key: "airdrop_ended", value: body.airdropEnded === true ? "true" : "false" });
  if (body.airdropChannel !== undefined) updates.push({ key: "airdrop_channel", value: String(body.airdropChannel) });
  if (body.extraAdminIds !== undefined) updates.push({ key: "extra_admin_ids", value: String(body.extraAdminIds) });

  // Parse monetag script tag if provided
  if (body.monetagScript !== undefined) {
    const script = String(body.monetagScript);
    updates.push({ key: "monetag_script", value: script });
    // Extract zone and sdk from the script tag for easy use
    const zoneMatch = script.match(/data-zone=['"]([^'"]+)['"]/);
    const sdkMatch = script.match(/data-sdk=['"]([^'"]+)['"]/);
    if (zoneMatch) updates.push({ key: "monetag_zone", value: zoneMatch[1] });
    if (sdkMatch) updates.push({ key: "monetag_sdk", value: sdkMatch[1] });
  }

  for (const { key, value } of updates) {
    await upsertSetting(key, value);
  }

  return res.json(await buildSettingsResponse());
});

// ── Withdrawals ───────────────────────────────────────────────────────────────
router.get("/admin/withdrawals", async (req, res) => {
  const { adminTelegramId, status } = req.query as Record<string, string>;
  if (!(await isAdmin(adminTelegramId))) return res.status(403).json({ error: "Forbidden" });

  const filter = status || "pending";
  const rows = await db
    .select({
      id: withdrawalsTable.id,
      amount: withdrawalsTable.amount,
      method: withdrawalsTable.method,
      destination: withdrawalsTable.destination,
      status: withdrawalsTable.status,
      createdAt: withdrawalsTable.createdAt,
      telegramId: usersTable.telegramId,
      username: usersTable.username,
      firstName: usersTable.firstName,
    })
    .from(withdrawalsTable)
    .innerJoin(usersTable, eq(withdrawalsTable.userId, usersTable.id))
    .where(eq(withdrawalsTable.status, filter))
    .orderBy(desc(withdrawalsTable.createdAt));

  return res.json(rows.map((r) => ({
    id: r.id,
    amount: parseFloat(r.amount as string),
    method: r.method,
    destination: r.destination,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    user: { telegramId: r.telegramId, username: r.username, firstName: r.firstName },
  })));
});

router.post("/admin/withdrawals/:id/approve", async (req, res) => {
  const withdrawalId = parseInt(req.params.id);
  const parsed = ApproveWithdrawalBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid body" });
  if (!(await isAdmin(parsed.data.adminTelegramId))) return res.status(403).json({ error: "Forbidden" });

  const withdrawal = await db.query.withdrawalsTable.findFirst({ where: eq(withdrawalsTable.id, withdrawalId) });
  if (!withdrawal || withdrawal.status !== "pending") return res.status(400).json({ error: "Not a pending withdrawal" });

  await db.update(withdrawalsTable).set({ status: "completed" }).where(eq(withdrawalsTable.id, withdrawalId));

  const user = await db.query.usersTable.findFirst({ where: eq(usersTable.id, withdrawal.userId) });
  if (user) await sendWithdrawalApprovedNotification(user.telegramId, parseFloat(withdrawal.amount as string), withdrawal.method, withdrawal.destination);

  return res.json({ ok: true });
});

router.post("/admin/withdrawals/:id/reject", async (req, res) => {
  const withdrawalId = parseInt(req.params.id);
  const parsed = RejectWithdrawalBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid body" });
  if (!(await isAdmin(parsed.data.adminTelegramId))) return res.status(403).json({ error: "Forbidden" });

  const withdrawal = await db.query.withdrawalsTable.findFirst({ where: eq(withdrawalsTable.id, withdrawalId) });
  if (!withdrawal || withdrawal.status !== "pending") return res.status(400).json({ error: "Not a pending withdrawal" });

  const amount = parseFloat(withdrawal.amount as string);
  await db.update(withdrawalsTable).set({ status: "rejected" }).where(eq(withdrawalsTable.id, withdrawalId));
  await db.update(usersTable).set({ balance: sql`${usersTable.balance} + ${amount}` }).where(eq(usersTable.id, withdrawal.userId));

  const user = await db.query.usersTable.findFirst({ where: eq(usersTable.id, withdrawal.userId) });
  if (user) await sendWithdrawalRejectedNotification(user.telegramId, amount);

  return res.json({ ok: true });
});

// ── Stats ─────────────────────────────────────────────────────────────────────
router.get("/admin/stats", async (req, res) => {
  const { adminTelegramId } = req.query as Record<string, string>;
  if (!(await isAdmin(adminTelegramId))) return res.status(403).json({ error: "Forbidden" });

  const [userCount] = await db.select({ count: sql<number>`count(*)` }).from(usersTable);
  const [adCount] = await db.select({ count: sql<number>`count(*)` }).from(adViewsTable);
  const [earned] = await db.select({ total: sum(usersTable.totalEarned) }).from(usersTable);
  const [withdrawn] = await db.select({ total: sum(withdrawalsTable.amount) }).from(withdrawalsTable).where(eq(withdrawalsTable.status, "completed"));
  const [pending] = await db.select({ total: sum(withdrawalsTable.amount) }).from(withdrawalsTable).where(eq(withdrawalsTable.status, "pending"));
  const [taskCount] = await db.select({ count: sql<number>`count(*)` }).from(tasksTable).where(eq(tasksTable.isActive, true));

  return res.json({
    totalUsers: Number(userCount.count),
    totalAdsWatched: Number(adCount.count),
    totalEarned: parseFloat((earned.total as string) || "0"),
    totalWithdrawn: parseFloat((withdrawn.total as string) || "0"),
    pendingWithdrawals: parseFloat((pending.total as string) || "0"),
    activeTasks: Number(taskCount.count),
  });
});

// ── User Management ───────────────────────────────────────────────────────────
router.get("/admin/users", async (req, res) => {
  const { adminTelegramId, search } = req.query as Record<string, string>;
  if (!(await isAdmin(adminTelegramId))) return res.status(403).json({ error: "Forbidden" });

  const query = search?.trim();
  let users;

  if (query) {
    users = await db
      .select()
      .from(usersTable)
      .where(
        or(
          eq(usersTable.telegramId, query),
          ilike(usersTable.username, `%${query}%`),
          ilike(usersTable.firstName, `%${query}%`)
        )
      )
      .orderBy(desc(usersTable.createdAt))
      .limit(30);
  } else {
    users = await db
      .select()
      .from(usersTable)
      .orderBy(desc(usersTable.createdAt))
      .limit(30);
  }

  return res.json(users.map((u) => ({
    id: u.id,
    telegramId: u.telegramId,
    username: u.username,
    firstName: u.firstName,
    balance: parseFloat(u.balance as string),
    totalEarned: parseFloat(u.totalEarned as string),
    adsWatched: u.adsWatched,
    isBanned: u.isBanned,
    createdAt: u.createdAt.toISOString(),
  })));
});

router.post("/admin/users/:id/ban", async (req, res) => {
  const userId = parseInt(req.params.id);
  const { adminTelegramId } = req.body as { adminTelegramId: string };
  if (!(await isAdmin(adminTelegramId))) return res.status(403).json({ error: "Forbidden" });

  await db.update(usersTable).set({ isBanned: true }).where(eq(usersTable.id, userId));
  return res.json({ ok: true });
});

router.post("/admin/users/:id/unban", async (req, res) => {
  const userId = parseInt(req.params.id);
  const { adminTelegramId } = req.body as { adminTelegramId: string };
  if (!(await isAdmin(adminTelegramId))) return res.status(403).json({ error: "Forbidden" });

  await db.update(usersTable).set({ isBanned: false }).where(eq(usersTable.id, userId));
  return res.json({ ok: true });
});

router.post("/admin/users/:id/balance", async (req, res) => {
  const userId = parseInt(req.params.id);
  const { adminTelegramId, amount } = req.body as { adminTelegramId: string; amount: number };
  if (!(await isAdmin(adminTelegramId))) return res.status(403).json({ error: "Forbidden" });
  if (typeof amount !== "number" || isNaN(amount)) return res.status(400).json({ error: "Invalid amount" });

  const user = await db.query.usersTable.findFirst({ where: eq(usersTable.id, userId) });
  if (!user) return res.status(404).json({ error: "User not found" });

  const currentBalance = parseFloat(user.balance as string);
  const newBalance = Math.max(0, currentBalance + amount);

  await db.update(usersTable).set({ balance: newBalance.toFixed(4) }).where(eq(usersTable.id, userId));
  return res.json({ ok: true, newBalance });
});

router.post("/admin/users/:id/contact", async (req, res) => {
  const userId = parseInt(req.params.id);
  const { adminTelegramId, message } = req.body as { adminTelegramId: string; message: string };
  if (!(await isAdmin(adminTelegramId))) return res.status(403).json({ error: "Forbidden" });
  if (!message?.trim()) return res.status(400).json({ error: "Message is required" });

  const user = await db.query.usersTable.findFirst({ where: eq(usersTable.id, userId) });
  if (!user) return res.status(404).json({ error: "User not found" });

  try {
    await bot.telegram.sendMessage(user.telegramId, message.trim(), { parse_mode: "Markdown" });
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: e.message || "Failed to send message" });
  }
});

// ── Broadcast ─────────────────────────────────────────────────────────────────
router.post("/admin/broadcast", async (req, res) => {
  const { adminTelegramId, message } = req.body as { adminTelegramId: string; message: string };
  if (!(await isAdmin(adminTelegramId))) return res.status(403).json({ error: "Forbidden" });
  if (!message?.trim()) return res.status(400).json({ error: "Message is required" });

  const jobId = randomUUID();

  broadcastMessage(message.trim(), jobId).then((result) => {
    logger.info({ result, jobId }, "Broadcast completed");
  }).catch(() => {});

  return res.json({ ok: true, jobId });
});

router.get("/admin/broadcast/:jobId/status", async (req, res) => {
  const { adminTelegramId } = req.query as Record<string, string>;
  if (!(await isAdmin(adminTelegramId))) return res.status(403).json({ error: "Forbidden" });

  const job = getBroadcastJob(req.params.jobId);
  if (!job) return res.status(404).json({ error: "Job not found" });

  return res.json(job);
});

export default router;
