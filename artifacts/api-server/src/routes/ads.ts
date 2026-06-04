import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, adViewsTable, referralsTable } from "@workspace/db";
import { eq, desc, sql, and, gte } from "drizzle-orm";
import { CompleteAdBody } from "@workspace/api-zod";
import { getSettingValue } from "./settings";

const router = Router();

router.post("/ads/complete", async (req, res) => {
  const parsed = CompleteAdBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid request body" });

  const { telegramId, username, firstName } = parsed.data;

  let user = await db.query.usersTable.findFirst({
    where: eq(usersTable.telegramId, telegramId),
  });
  if (!user) {
    const [created] = await db
      .insert(usersTable)
      .values({ telegramId, username: username || null, firstName: firstName || null })
      .returning();
    user = created;
  }

  // Enforce daily watch limit
  const dailyLimitStr = await getSettingValue("daily_watch_limit");
  const dailyLimit = parseInt(dailyLimitStr, 10) || 20;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const [todayCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(adViewsTable)
    .where(and(eq(adViewsTable.userId, user.id), gte(adViewsTable.createdAt, todayStart)));
  if (Number(todayCount.count) >= dailyLimit) {
    return res.status(429).json({ error: "Daily ad limit reached", dailyLimit });
  }

  const earnPerAdStr = await getSettingValue("earn_per_ad");
  const earned = parseFloat(parseFloat(earnPerAdStr).toFixed(4));

  await db.insert(adViewsTable).values({ userId: user.id, earned: earned.toString() });

  const [updatedUser] = await db
    .update(usersTable)
    .set({
      balance: sql`${usersTable.balance} + ${earned}`,
      totalEarned: sql`${usersTable.totalEarned} + ${earned}`,
      adsWatched: sql`${usersTable.adsWatched} + 1`,
    })
    .where(eq(usersTable.id, user.id))
    .returning();

  // Check if this is the first ad — credit referrer if so
  const totalAds = updatedUser.adsWatched;
  if (totalAds === 1) {
    const referral = await db.query.referralsTable.findFirst({
      where: and(eq(referralsTable.referredId, user.id), eq(referralsTable.rewardGiven, false)),
    });
    if (referral) {
      const referralRewardStr = await getSettingValue("referral_reward");
      const referralReward = parseFloat(referralRewardStr);
      await db
        .update(usersTable)
        .set({
          balance: sql`${usersTable.balance} + ${referralReward}`,
          totalEarned: sql`${usersTable.totalEarned} + ${referralReward}`,
        })
        .where(eq(usersTable.id, referral.referrerId));
      await db
        .update(referralsTable)
        .set({ rewardGiven: true })
        .where(eq(referralsTable.id, referral.id));
    }
  }

  return res.json({
    earned,
    newBalance: parseFloat(updatedUser.balance as string),
    totalEarned: parseFloat(updatedUser.totalEarned as string),
    todayAds: Number(todayCount.count) + 1,
    dailyLimit,
  });
});

router.get("/ads/history", async (req, res) => {
  const { telegramId, limit: limitStr } = req.query as Record<string, string>;
  if (!telegramId) return res.status(400).json({ error: "telegramId is required" });

  const limit = Math.min(parseInt(limitStr || "20", 10), 100);
  const user = await db.query.usersTable.findFirst({ where: eq(usersTable.telegramId, telegramId) });
  if (!user) return res.json([]);

  const views = await db
    .select()
    .from(adViewsTable)
    .where(eq(adViewsTable.userId, user.id))
    .orderBy(desc(adViewsTable.createdAt))
    .limit(limit);

  return res.json(views.map((v) => ({
    id: v.id,
    earned: parseFloat(v.earned as string),
    createdAt: v.createdAt.toISOString(),
  })));
});

export default router;
