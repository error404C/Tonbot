import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, referralsTable } from "@workspace/db";
import { eq, sum } from "drizzle-orm";

const router = Router();

router.get("/referrals/stats", async (req, res) => {
  const { telegramId } = req.query as Record<string, string>;
  if (!telegramId) return res.status(400).json({ error: "telegramId required" });

  const user = await db.query.usersTable.findFirst({
    where: eq(usersTable.telegramId, telegramId),
  });
  if (!user) return res.status(404).json({ error: "User not found" });

  const referrals = await db
    .select({
      id: referralsTable.id,
      rewardGiven: referralsTable.rewardGiven,
      createdAt: referralsTable.createdAt,
      username: usersTable.username,
      firstName: usersTable.firstName,
    })
    .from(referralsTable)
    .innerJoin(usersTable, eq(referralsTable.referredId, usersTable.id))
    .where(eq(referralsTable.referrerId, user.id));

  const totalEarned = referrals
    .filter((r) => r.rewardGiven)
    .length;

  return res.json({
    referralCode: telegramId,
    totalReferrals: referrals.length,
    totalEarned: 0,
    referrals: referrals.map((r) => ({
      username: r.username,
      firstName: r.firstName,
      joinedAt: r.createdAt.toISOString(),
      rewardGiven: r.rewardGiven,
    })),
  });
});

export default router;
