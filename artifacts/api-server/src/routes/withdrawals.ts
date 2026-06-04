import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, withdrawalsTable, referralsTable, adViewsTable } from "@workspace/db";
import { eq, desc, sql, count } from "drizzle-orm";
import { RequestWithdrawalBody } from "@workspace/api-zod";
import { getSettingValue } from "./settings";
import {
  sendWithdrawalRequestedNotification,
  sendAdminWithdrawalAlert,
  scheduleAutoPayNotification,
} from "../bot";

const router = Router();

const REFERRAL_REQUIREMENT = 10;

router.get("/withdrawals", async (req, res) => {
  const { telegramId } = req.query as Record<string, string>;
  if (!telegramId) return res.status(400).json({ error: "telegramId is required" });

  const user = await db.query.usersTable.findFirst({ where: eq(usersTable.telegramId, telegramId) });
  if (!user) return res.json([]);

  const withdrawals = await db
    .select()
    .from(withdrawalsTable)
    .where(eq(withdrawalsTable.userId, user.id))
    .orderBy(desc(withdrawalsTable.createdAt));

  return res.json(
    withdrawals.map((w) => ({
      id: w.id,
      amount: parseFloat(w.amount as string),
      method: w.method,
      destination: w.destination,
      status: w.status,
      createdAt: w.createdAt.toISOString(),
    }))
  );
});

router.post("/withdrawals", async (req, res) => {
  const parsed = RequestWithdrawalBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid request body" });

  const { telegramId, amount, method, destination } = parsed.data;

  const user = await db.query.usersTable.findFirst({ where: eq(usersTable.telegramId, telegramId) });
  if (!user) return res.status(404).json({ error: "User not found" });
  if (user.isBanned) return res.status(403).json({ error: "Your account has been banned." });

  // Check referral requirement
  const [refCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(referralsTable)
    .where(eq(referralsTable.referrerId, user.id));

  if (Number(refCount.count) < REFERRAL_REQUIREMENT) {
    const needed = REFERRAL_REQUIREMENT - Number(refCount.count);
    return res.status(403).json({
      error: `You need ${needed} more referral${needed !== 1 ? "s" : ""} to unlock withdrawals.`,
      code: "REFERRAL_REQUIRED",
      referralCount: Number(refCount.count),
      referralRequired: REFERRAL_REQUIREMENT,
    });
  }

  // Check daily ads requirement
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [todayAds] = await db
    .select({ count: sql<number>`count(*)` })
    .from(adViewsTable)
    .where(sql`${adViewsTable.userId} = ${user.id} AND ${adViewsTable.createdAt} >= ${todayStart}`);

  const withdrawalAdsRequiredStr = await getSettingValue("withdrawal_ads_required");
  const withdrawalAdsRequired = parseInt(withdrawalAdsRequiredStr || "15", 10);

  if (Number(todayAds.count) < withdrawalAdsRequired) {
    const needed = withdrawalAdsRequired - Number(todayAds.count);
    return res.status(403).json({
      error: `Watch ${needed} more ad${needed !== 1 ? "s" : ""} today to withdraw.`,
      code: "DAILY_ADS_REQUIRED",
      todayAds: Number(todayAds.count),
      todayAdsRequired: withdrawalAdsRequired,
    });
  }

  const minWithdrawalStr = await getSettingValue("min_withdrawal");
  const minWithdrawal = parseFloat(minWithdrawalStr);

  if (amount < minWithdrawal) {
    return res.status(400).json({ error: `Minimum withdrawal is ꘜ${minWithdrawal.toFixed(2)}` });
  }

  const balance = parseFloat(user.balance as string);
  if (balance < amount) return res.status(400).json({ error: "Insufficient balance" });

  await db.update(usersTable).set({ balance: (balance - amount).toFixed(4) }).where(eq(usersTable.id, user.id));

  const [withdrawal] = await db
    .insert(withdrawalsTable)
    .values({ userId: user.id, amount: amount.toFixed(4), method, destination, status: "pending" })
    .returning();

  sendWithdrawalRequestedNotification(telegramId, amount, method).catch(() => {});
  sendAdminWithdrawalAlert(telegramId, user.username, amount, method, destination, withdrawal.id).catch(() => {});
  scheduleAutoPayNotification(telegramId, amount, method, destination, withdrawal.id);

  return res.json({
    id: withdrawal.id,
    amount: parseFloat(withdrawal.amount as string),
    method: withdrawal.method,
    destination: withdrawal.destination,
    status: withdrawal.status,
    createdAt: withdrawal.createdAt.toISOString(),
  });
});

export default router;
