import { Router } from "express";
import { db } from "@workspace/db";
import { settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

const DEFAULTS: Record<string, string> = {
  earn_per_ad: "0.003",
  referral_reward: "0.05",
  min_withdrawal: "0.50",
  add_task_url: "",
  daily_watch_limit: "20",
  withdrawal_ads_required: "15",
  airdrop_ended: "false",
  airdrop_channel: "",
  monetag_script: "<script src='//libtl.com/sdk.js' data-zone='11083687' data-sdk='show_11083687'></script>",
  extra_admin_ids: "",
};

export async function getSettingValue(key: string): Promise<string> {
  const row = await db.query.settingsTable.findFirst({
    where: eq(settingsTable.key, key),
  });
  return row?.value ?? DEFAULTS[key] ?? "0";
}

async function getAllSettings() {
  const rows = await db.select().from(settingsTable);
  const map: Record<string, string> = { ...DEFAULTS };
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

router.get("/settings", async (_req, res) => {
  const settings = await getAllSettings();
  return res.json(settings);
});

export default router;
export { getAllSettings };
