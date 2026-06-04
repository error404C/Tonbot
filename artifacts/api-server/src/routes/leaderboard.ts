import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { desc, eq, and, ne } from "drizzle-orm";

const router = Router();

const TEST_IDS = ["test123"];

router.get("/leaderboard", async (req, res) => {
  const limit = Math.min(parseInt((req.query.limit as string) || "50", 10), 50);

  const topUsers = await db
    .select()
    .from(usersTable)
    .where(
      and(
        eq(usersTable.isBanned, false),
        ...TEST_IDS.map((id) => ne(usersTable.telegramId, id))
      )
    )
    .orderBy(desc(usersTable.totalEarned))
    .limit(limit);

  return res.json(
    topUsers.map((u, idx) => ({
      rank: idx + 1,
      telegramId: u.telegramId,
      username: u.username,
      firstName: u.firstName,
      totalEarned: parseFloat(u.totalEarned as string),
      adsWatched: u.adsWatched,
    }))
  );
});

export default router;
