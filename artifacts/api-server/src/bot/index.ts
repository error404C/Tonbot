import { Telegraf, Markup } from "telegraf";
import { db } from "@workspace/db";
import { settingsTable, usersTable, withdrawalsTable } from "@workspace/db";
import { eq, desc, sql, sum } from "drizzle-orm";
import { logger } from "../lib/logger";

const BOT_TOKEN = process.env.BOT_TOKEN!;
const ADMIN_ID = process.env.ADMIN_TELEGRAM_ID!;
const APP_URL = process.env.REPLIT_DOMAINS?.split(",")[0]
  ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}`
  : "https://your-app.replit.app";

export const bot = new Telegraf(BOT_TOKEN);

async function getSetting(key: string, fallback: string): Promise<string> {
  try {
    const row = await db.query.settingsTable.findFirst({ where: eq(settingsTable.key, key) });
    return row?.value ?? fallback;
  } catch {
    return fallback;
  }
}

async function isAdminUser(telegramId: string): Promise<boolean> {
  if (telegramId === ADMIN_ID) return true;
  const extraRow = await db.query.settingsTable.findFirst({ where: eq(settingsTable.key, "extra_admin_ids") });
  const extraIds = extraRow?.value?.split(",").map((s) => s.trim()).filter(Boolean) || [];
  return extraIds.includes(telegramId);
}

async function showMainMenu(ctx: any, firstName: string, telegramId: string) {
  const earnPerAd = await getSetting("earn_per_ad", "0.003");
  const referralReward = await getSetting("referral_reward", "0.05");
  const minWithdrawal = await getSetting("min_withdrawal", "0.50");
  const dailyLimit = await getSetting("daily_watch_limit", "20");

  await ctx.reply(
    `🌊 Welcome to *TONStream Rewards*, ${firstName}!\n\n` +
    `💎 *How to earn TON:*\n` +
    `• Watch short ads and earn *ꘜ${parseFloat(earnPerAd).toFixed(4)}* per ad\n` +
    `• Invite friends and earn *ꘜ${parseFloat(referralReward).toFixed(2)}* per referral\n` +
    `• Complete tasks for bonus TON rewards\n` +
    `• Withdraw when your balance hits *ꘜ${parseFloat(minWithdrawal).toFixed(2)}*\n\n` +
    `⚡ *Daily limit:* ${dailyLimit} ads/day — reset at midnight UTC\n\n` +
    `🔗 *Your referral link:*\n` +
    `\`https://t.me/${ctx.botInfo.username}?start=ref_${telegramId}\`\n\n` +
    `Tap below to open the app and start streaming rewards! 🚀`,
    {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([
        [Markup.button.webApp("🌊 Open TONStream Rewards", APP_URL)],
        [Markup.button.callback("📊 My Stats", `stats_${telegramId}`)],
      ]),
    }
  );
}

bot.start(async (ctx) => {
  const payload = ctx.startPayload;
  const tgUser = ctx.from;
  const telegramId = String(tgUser.id);
  const firstName = tgUser.first_name || "there";

  // Check if airdrop has ended
  const airdropEnded = await getSetting("airdrop_ended", "false");
  if (airdropEnded === "true") {
    const airdropChannel = await getSetting("airdrop_channel", "");
    const buttons: any[][] = [];
    if (airdropChannel) {
      buttons.push([Markup.button.url("📢 Join Channel for Updates", airdropChannel)]);
    }
    await ctx.reply(
      `🔔 *TONStream Rewards Airdrop Has Ended*\n\n` +
      `Thank you for being part of our community!\n\n` +
      `The current airdrop campaign has concluded. Join our official channel to stay updated on upcoming campaigns, new airdrops, and announcements.\n\n` +
      `See you in the next one! 💎`,
      {
        parse_mode: "Markdown",
        ...(buttons.length ? Markup.inlineKeyboard(buttons) : {}),
      }
    );
    return;
  }

  // Handle referral
  if (payload?.startsWith("ref_")) {
    const referralCode = payload.slice(4);
    if (referralCode && referralCode !== telegramId) {
      try {
        const referrer = await db.query.usersTable.findFirst({ where: eq(usersTable.telegramId, referralCode) });
        if (referrer) {
          const referralReward = await getSetting("referral_reward", "0.05");
          await bot.telegram.sendMessage(
            referralCode,
            `🎉 Someone joined using your referral link!\n\nYou'll earn *ꘜ${parseFloat(referralReward).toFixed(2)}* once they watch their first ad. Keep sharing to earn more! 💎`,
            { parse_mode: "Markdown" }
          );
        }
      } catch {
        // referrer may not have started bot yet
      }
    }
  }

  await showMainMenu(ctx, firstName, telegramId);
});

bot.action(/^stats_(.+)$/, async (ctx): Promise<void> => {
  await ctx.answerCbQuery();
  const telegramId = ctx.match[1];
  const user = await db.query.usersTable.findFirst({ where: eq(usersTable.telegramId, telegramId) });
  if (!user) {
    await ctx.reply("No account found. Open the app first to get started.");
    return;
  }
  await ctx.reply(
    `📊 *Your TONStream Stats*\n\n` +
    `💎 Balance: *ꘜ${parseFloat(user.balance as string).toFixed(4)}*\n` +
    `🏆 Total Earned: *ꘜ${parseFloat(user.totalEarned as string).toFixed(4)}*\n` +
    `📺 Ads Watched: *${user.adsWatched}*\n\n` +
    `Keep watching to climb the leaderboard! 🚀`,
    { parse_mode: "Markdown" }
  );
});

bot.command("admin", async (ctx): Promise<void> => {
  const telegramId = String(ctx.from.id);
  if (!(await isAdminUser(telegramId))) {
    await ctx.reply("⛔ You are not authorized to use this command.");
    return;
  }

  const [usersCount] = await db.select({ count: sql<number>`count(*)` }).from(usersTable);
  const [earnings] = await db.select({ total: sum(usersTable.totalEarned) }).from(usersTable);
  const [pending] = await db
    .select({ count: sql<number>`count(*)`, total: sum(withdrawalsTable.amount) })
    .from(withdrawalsTable)
    .where(eq(withdrawalsTable.status, "pending"));

  const earnPerAd = await getSetting("earn_per_ad", "0.003");
  const referralReward = await getSetting("referral_reward", "0.05");
  const minWithdrawal = await getSetting("min_withdrawal", "0.50");
  const dailyLimit = await getSetting("daily_watch_limit", "20");
  const airdropEnded = await getSetting("airdrop_ended", "false");

  await ctx.reply(
    `🌊 *TONStream Rewards — Admin Panel*\n\n` +
    `👥 Total Users: *${usersCount.count}*\n` +
    `💎 Total Earned: *ꘜ${parseFloat((earnings.total as string) || "0").toFixed(4)}*\n` +
    `⏳ Pending Payouts: *${pending.count}* (ꘜ${parseFloat((pending.total as string) || "0").toFixed(4)})\n\n` +
    `⚙️ *Settings:*\n` +
    `• Earn per ad: *ꘜ${parseFloat(earnPerAd).toFixed(4)}*\n` +
    `• Referral reward: *ꘜ${parseFloat(referralReward).toFixed(2)}*\n` +
    `• Min withdrawal: *ꘜ${parseFloat(minWithdrawal).toFixed(2)}*\n` +
    `• Daily ad limit: *${dailyLimit}*\n` +
    `• Airdrop status: *${airdropEnded === "true" ? "🔴 Ended" : "🟢 Active"}*`,
    {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([
        [Markup.button.webApp("🛠 Open Admin Panel", `${APP_URL}?admin=1`)],
        [Markup.button.callback("📋 Pending Payouts", "admin_pending")],
      ]),
    }
  );
});

bot.action("admin_pending", async (ctx): Promise<void> => {
  await ctx.answerCbQuery();
  const telegramId = String(ctx.from?.id);
  if (!(await isAdminUser(telegramId))) return;

  const pending = await db
    .select({
      id: withdrawalsTable.id,
      amount: withdrawalsTable.amount,
      method: withdrawalsTable.method,
      destination: withdrawalsTable.destination,
      telegramId: usersTable.telegramId,
      username: usersTable.username,
    })
    .from(withdrawalsTable)
    .innerJoin(usersTable, eq(withdrawalsTable.userId, usersTable.id))
    .where(eq(withdrawalsTable.status, "pending"))
    .orderBy(desc(withdrawalsTable.createdAt))
    .limit(10);

  if (pending.length === 0) {
    await ctx.reply("✅ No pending payouts right now.");
    return;
  }

  const lines = pending.map(
    (w, i) =>
      `${i + 1}. *@${w.username || w.telegramId}* — ꘜ${parseFloat(w.amount as string).toFixed(4)} via ${w.method}\n   → \`${w.destination}\``
  );

  await ctx.reply(`⏳ *Pending Payouts*\n\n${lines.join("\n\n")}`, { parse_mode: "Markdown" });
});

bot.action(/^approve_(\d+)$/, async (ctx): Promise<void> => {
  await ctx.answerCbQuery("Processing...");
  const telegramId = String(ctx.from?.id);
  if (!(await isAdminUser(telegramId))) return;

  const withdrawalId = parseInt(ctx.match[1]);
  const withdrawal = await db.query.withdrawalsTable.findFirst({ where: eq(withdrawalsTable.id, withdrawalId) });
  if (!withdrawal || withdrawal.status !== "pending") {
    await ctx.editMessageText("Already processed.");
    return;
  }

  await db.update(withdrawalsTable).set({ status: "completed" }).where(eq(withdrawalsTable.id, withdrawalId));

  const user = await db.query.usersTable.findFirst({ where: eq(usersTable.id, withdrawal.userId) });
  if (user) {
    await sendWithdrawalApprovedNotification(user.telegramId, parseFloat(withdrawal.amount as string), withdrawal.method, withdrawal.destination);
  }

  await ctx.editMessageText(`✅ Payout #${withdrawalId} approved and user notified.`);
});

bot.action(/^reject_(\d+)$/, async (ctx): Promise<void> => {
  await ctx.answerCbQuery("Processing...");
  const telegramId = String(ctx.from?.id);
  if (!(await isAdminUser(telegramId))) return;

  const withdrawalId = parseInt(ctx.match[1]);
  const withdrawal = await db.query.withdrawalsTable.findFirst({ where: eq(withdrawalsTable.id, withdrawalId) });
  if (!withdrawal || withdrawal.status !== "pending") {
    await ctx.editMessageText("Already processed.");
    return;
  }

  const amount = parseFloat(withdrawal.amount as string);
  await db.update(withdrawalsTable).set({ status: "rejected" }).where(eq(withdrawalsTable.id, withdrawalId));
  await db.update(usersTable).set({ balance: sql`${usersTable.balance} + ${amount}` }).where(eq(usersTable.id, withdrawal.userId));

  const user = await db.query.usersTable.findFirst({ where: eq(usersTable.id, withdrawal.userId) });
  if (user) await sendWithdrawalRejectedNotification(user.telegramId, amount);

  await ctx.editMessageText(`❌ Payout #${withdrawalId} rejected and funds returned to user.`);
});

export async function sendWithdrawalRequestedNotification(telegramId: string, amount: number, method: string) {
  try {
    await bot.telegram.sendMessage(
      telegramId,
      `✅ *Withdrawal Request Received!*\n\n` +
      `Amount: *ꘜ${amount.toFixed(4)}*\n` +
      `Method: *${method}*\n\n` +
      `⚡ Your payment is being processed. You will receive a confirmation shortly!\n\n` +
      `Thank you for using TONStream Rewards 💎`,
      { parse_mode: "Markdown" }
    );
  } catch (e) {
    logger.error({ err: e, telegramId }, "Failed to send withdrawal notification");
  }
}

export async function scheduleAutoPayNotification(
  telegramId: string,
  amount: number,
  method: string,
  destination: string,
  withdrawalId: number
) {
  setTimeout(async () => {
    try {
      const withdrawal = await db.query.withdrawalsTable.findFirst({
        where: eq(withdrawalsTable.id, withdrawalId),
      });
      // Only auto-complete and notify if no admin has acted yet
      if (withdrawal?.status !== "pending") return;
      await db.update(withdrawalsTable).set({ status: "completed" }).where(eq(withdrawalsTable.id, withdrawalId));
      await bot.telegram.sendMessage(
        telegramId,
        `💸 *TON Sent!*\n\n` +
        `Amount: *ꘜ${amount.toFixed(4)}*\n` +
        `Method: *${method}*\n` +
        `To: \`${destination}\`\n\n` +
        `Your withdrawal is complete. Keep earning with TONStream Rewards! 🌊`,
        { parse_mode: "Markdown" }
      );
    } catch (e) {
      logger.error({ err: e, telegramId }, "Failed to send auto-pay notification");
    }
  }, 2 * 60 * 1000);
}

export async function sendWithdrawalApprovedNotification(telegramId: string, amount: number, method: string, destination: string) {
  try {
    await bot.telegram.sendMessage(
      telegramId,
      `💸 *TON Sent!*\n\n` +
      `Amount: *ꘜ${amount.toFixed(4)}*\n` +
      `Method: *${method}*\n` +
      `To: \`${destination}\`\n\n` +
      `Your withdrawal is complete. Keep earning with TONStream Rewards! 🌊`,
      { parse_mode: "Markdown" }
    );
  } catch (e) {
    logger.error({ err: e, telegramId }, "Failed to send approval notification");
  }
}

export async function sendWithdrawalRejectedNotification(telegramId: string, amount: number) {
  try {
    await bot.telegram.sendMessage(
      telegramId,
      `❌ *Withdrawal Rejected*\n\n` +
      `Amount: *ꘜ${amount.toFixed(4)}* has been returned to your balance.\n\n` +
      `If you believe this is a mistake, please contact support through the app.`,
      { parse_mode: "Markdown" }
    );
  } catch (e) {
    logger.error({ err: e, telegramId }, "Failed to send rejection notification");
  }
}

export async function sendAdminWithdrawalAlert(
  telegramId: string,
  username: string | null,
  amount: number,
  method: string,
  destination: string,
  withdrawalId: number
) {
  const adminIds = [ADMIN_ID];
  try {
    const extraRow = await db.query.settingsTable.findFirst({ where: eq(settingsTable.key, "extra_admin_ids") });
    const extraIds = extraRow?.value?.split(",").map((s) => s.trim()).filter(Boolean) || [];
    adminIds.push(...extraIds);
  } catch {}

  for (const adminId of [...new Set(adminIds)]) {
    try {
      await bot.telegram.sendMessage(
        adminId,
        `🔔 *New Withdrawal Request*\n\n` +
        `User: *@${username || telegramId}* (${telegramId})\n` +
        `Amount: *ꘜ${amount.toFixed(4)}*\n` +
        `Method: *${method}*\n` +
        `Destination: \`${destination}\`\n` +
        `ID: #${withdrawalId}\n\n` +
        `⚡ Payment will be sent automatically in 2 minutes unless you act.`,
        {
          parse_mode: "Markdown",
          ...Markup.inlineKeyboard([
            [
              Markup.button.callback(`✅ Approve #${withdrawalId}`, `approve_${withdrawalId}`),
              Markup.button.callback(`❌ Reject #${withdrawalId}`, `reject_${withdrawalId}`),
            ],
          ]),
        }
      );
    } catch (e) {
      logger.error({ err: e, adminId }, "Failed to send admin alert");
    }
  }
}

// Telegram allows ~30 msg/sec across all chats.
// We send in chunks of 25, then pause 1 second between chunks → ~25 msg/sec max.
const BROADCAST_CHUNK_SIZE = 25;
const BROADCAST_CHUNK_DELAY_MS = 1000;

export interface BroadcastJob {
  id: string;
  total: number;
  sent: number;
  failed: number;
  status: "running" | "done";
  startedAt: number;
}

// In-memory job store — keyed by jobId. Auto-cleaned after 1 hour.
const broadcastJobs = new Map<string, BroadcastJob>();

export function getBroadcastJob(id: string): BroadcastJob | undefined {
  return broadcastJobs.get(id);
}

export async function broadcastMessage(
  message: string,
  jobId: string
): Promise<{ sent: number; failed: number }> {
  const users = await db.select({ telegramId: usersTable.telegramId }).from(usersTable);

  const job: BroadcastJob = {
    id: jobId,
    total: users.length,
    sent: 0,
    failed: 0,
    status: "running",
    startedAt: Date.now(),
  };
  broadcastJobs.set(jobId, job);

  // Auto-remove job after 1 hour to avoid memory leaks
  setTimeout(() => broadcastJobs.delete(jobId), 60 * 60 * 1000);

  for (let i = 0; i < users.length; i += BROADCAST_CHUNK_SIZE) {
    const chunk = users.slice(i, i + BROADCAST_CHUNK_SIZE);

    await Promise.all(
      chunk.map(async (user) => {
        try {
          await bot.telegram.sendMessage(user.telegramId, message, { parse_mode: "Markdown" });
          job.sent++;
        } catch (e: unknown) {
          job.failed++;
          const code = (e as any)?.response?.error_code;
          if (code !== 403 && code !== 400) {
            logger.warn({ telegramId: user.telegramId, code }, "Broadcast send failed");
          }
        }
      })
    );

    if (i + BROADCAST_CHUNK_SIZE < users.length) {
      await new Promise((r) => setTimeout(r, BROADCAST_CHUNK_DELAY_MS));
    }
  }

  job.status = "done";
  return { sent: job.sent, failed: job.failed };
}

export function startBot() {
  bot.launch({ dropPendingUpdates: true }).catch((err) => {
    logger.error({ err }, "Bot launch error");
  });
  logger.info("Telegram bot started (long polling)");
  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}
