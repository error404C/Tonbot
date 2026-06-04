import { Router } from "express";
import { db } from "@workspace/db";
import { requiredChannelsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { bot } from "../bot";
import { isAdmin } from "./admin";
import { logger } from "../lib/logger";

const router = Router();

// GET /api/channels — public list of required channels
router.get("/channels", async (_req, res) => {
  try {
    const channels = await db.select().from(requiredChannelsTable);
    return res.json(channels.map((c) => ({
      id: c.id,
      channelId: c.channelId,
      title: c.title,
      url: c.url,
      checkMembership: c.checkMembership,
    })));
  } catch (err) {
    logger.error(err, "Failed to fetch channels");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/channels/check?telegramId=X
router.get("/channels/check", async (req, res) => {
  const { telegramId } = req.query as Record<string, string>;
  if (!telegramId) return res.status(400).json({ error: "telegramId is required" });

  try {
    // Admins always bypass the must-join gate
    if (await isAdmin(telegramId)) {
      return res.json({ allJoined: true, channels: [], isAdmin: true });
    }

    const channels = await db.select().from(requiredChannelsTable);

    if (channels.length === 0) {
      return res.json({ allJoined: true, channels: [] });
    }

    const results = await Promise.all(
      channels.map(async (ch) => {
        // If check is disabled, always treat as joined
        if (!ch.checkMembership) {
          return { id: ch.id, channelId: ch.channelId, title: ch.title, url: ch.url, isJoined: true, checkMembership: false };
        }
        // Otherwise verify via Telegram API
        try {
          const member = await bot.telegram.getChatMember(ch.channelId, Number(telegramId));
          const joined = ["creator", "administrator", "member", "restricted"].includes(member.status);
          return { id: ch.id, channelId: ch.channelId, title: ch.title, url: ch.url, isJoined: joined, checkMembership: true };
        } catch {
          return { id: ch.id, channelId: ch.channelId, title: ch.title, url: ch.url, isJoined: false, checkMembership: true };
        }
      })
    );

    const allJoined = results.every((r) => r.isJoined);
    return res.json({ allJoined, channels: results });
  } catch (err) {
    logger.error(err, "Failed to check channel membership");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/admin/channels — add a required channel
router.post("/admin/channels", async (req, res) => {
  const { adminTelegramId, channelId, title, url, checkMembership } = req.body;
  if (!adminTelegramId || !channelId || !title || !url) {
    return res.status(400).json({ error: "adminTelegramId, channelId, title, and url are required" });
  }
  if (!(await isAdmin(adminTelegramId))) return res.status(403).json({ error: "Unauthorized" });

  try {
    const [ch] = await db
      .insert(requiredChannelsTable)
      .values({ channelId, title, url, checkMembership: checkMembership === true })
      .returning();
    return res.json({ id: ch.id, channelId: ch.channelId, title: ch.title, url: ch.url, checkMembership: ch.checkMembership });
  } catch (err) {
    logger.error(err, "Failed to add channel");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/admin/channels/:id — toggle checkMembership
router.patch("/admin/channels/:id", async (req, res) => {
  const { adminTelegramId, checkMembership } = req.body;
  const id = Number(req.params.id);
  if (!adminTelegramId) return res.status(400).json({ error: "adminTelegramId is required" });
  if (!(await isAdmin(adminTelegramId))) return res.status(403).json({ error: "Unauthorized" });

  try {
    const [ch] = await db
      .update(requiredChannelsTable)
      .set({ checkMembership: Boolean(checkMembership) })
      .where(eq(requiredChannelsTable.id, id))
      .returning();
    return res.json({ id: ch.id, channelId: ch.channelId, title: ch.title, url: ch.url, checkMembership: ch.checkMembership });
  } catch (err) {
    logger.error(err, "Failed to update channel");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/admin/channels/:id — remove a required channel
router.delete("/admin/channels/:id", async (req, res) => {
  const { adminTelegramId } = req.body;
  const id = Number(req.params.id);
  if (!adminTelegramId) return res.status(400).json({ error: "adminTelegramId is required" });
  if (!(await isAdmin(adminTelegramId))) return res.status(403).json({ error: "Unauthorized" });

  try {
    await db.delete(requiredChannelsTable).where(eq(requiredChannelsTable.id, id));
    return res.json({ success: true });
  } catch (err) {
    logger.error(err, "Failed to delete channel");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
