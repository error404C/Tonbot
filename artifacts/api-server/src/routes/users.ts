import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, adViewsTable, withdrawalsTable, referralsTable } from "@workspace/db";
import { eq, sql, sum, count } from "drizzle-orm";
import { getSettingValue } from "./settings";

const router = Router();

router.get("/users/me", async (req, res) => {
  const { telegramId, username, firstName, referralCode } = req.query as Record<string, string>;
  if (!telegramId) return res.status(400).json({ error: "telegramId is required" });

  let user = await db.query.usersTable.findFirst({
    where: eq(usersTable.telegramId, telegramId),
  });

  const isNewUser = !user;

  if (!user) {
    const [created] = await db
      .insert(usersTable)
      .values({ telegramId, username: username || null, firstName: firstName || null })
      .returning();
    user = created;

    // Handle referral on first registration
    if (referralCode && referralCode !== telegramId) {
      const referrer = await db.query.usersTable.findFirst({
        where: eq(usersTable.telegramId, referralCode),
      });
      if (referrer) {
        await db.insert(referralsTable).values({
          referrerId: referrer.id,
          referredId: user.id,
          rewardGiven: false,
        }).onConflictDoNothing();
      }
    }
  } else if (username || firstName) {
    const [updated] = await db
      .update(usersTable)
      .set({
        ...(username ? { username } : {}),
        ...(firstName ? { firstName } : {}),
      })
      .where(eq(usersTable.telegramId, telegramId))
      .returning();
    user = updated;
  }

  return res.json({
    id: user.id,
    telegramId: user.telegramId,
    username: user.username,
    firstName: user.firstName,
    balance: parseFloat(user.balance as string),
    totalEarned: parseFloat(user.totalEarned as string),
    adsWatched: user.adsWatched,
    createdAt: user.createdAt.toISOString(),
  });
});

router.get("/users/me/stats", async (req, res) => {
  const { telegramId } = req.query as Record<string, string>;
  if (!telegramId) return res.status(400).json({ error: "telegramId is required" });

  const user = await db.query.usersTable.findFirst({
    where: eq(usersTable.telegramId, telegramId),
  });
  if (!user) return res.status(404).json({ error: "User not found" });

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [todayStats] = await db
    .select({ count: sql<number>`count(*)`, total: sum(adViewsTable.earned) })
    .from(adViewsTable)
    .where(sql`${adViewsTable.userId} = ${user.id} AND ${adViewsTable.createdAt} >= ${todayStart}`);

  const [pendingWd] = await db
    .select({ total: sum(withdrawalsTable.amount) })
    .from(withdrawalsTable)
    .where(sql`${withdrawalsTable.userId} = ${user.id} AND ${withdrawalsTable.status} = 'pending'`);

  const [refCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(referralsTable)
    .where(eq(referralsTable.referrerId, user.id));

  return res.json({
    balance: parseFloat(user.balance as string),
    totalEarned: parseFloat(user.totalEarned as string),
    adsWatched: user.adsWatched,
    todayEarned: parseFloat((todayStats?.total as string) || "0"),
    todayAds: Number(todayStats?.count || 0),
    pendingWithdrawals: parseFloat((pendingWd?.total as string) || "0"),
    referralCount: Number(refCount?.count || 0),
  });
});

export default router;
