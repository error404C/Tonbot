import React, { useState, useEffect } from "react";
import { useTelegram } from "@/lib/telegram";
import {
  useGetMyStats, getGetMyStatsQueryKey,
  useCompleteAd, getGetAdHistoryQueryKey,
  useGetReferralStats, getGetReferralStatsQueryKey,
  useGetSettings,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Play, TrendingUp, Zap, Clock, Users, Copy, Check, Gift, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const BOT_USERNAME = import.meta.env.VITE_BOT_USERNAME || "TONStreamRewardsBot";

export default function Home() {
  const { user, isLoading: isUserLoading } = useTelegram();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isWatching, setIsWatching] = useState(false);
  const [balanceKey, setBalanceKey] = useState(0);
  const [copied, setCopied] = useState(false);

  const { data: stats, isLoading: isStatsLoading } = useGetMyStats(
    { telegramId: user?.id || "" },
    { query: { enabled: !!user?.id, queryKey: getGetMyStatsQueryKey({ telegramId: user?.id || "" }) } }
  );

  const { data: refStats, isLoading: isRefLoading } = useGetReferralStats(
    { telegramId: user?.id || "" },
    { query: { enabled: !!user?.id, queryKey: getGetReferralStatsQueryKey({ telegramId: user?.id || "" }) } }
  );

  const { data: settings } = useGetSettings();

  const dailyLimit = settings?.dailyWatchLimit ?? 20;
  const todayAds = stats?.todayAds ?? 0;
  const limitReached = todayAds >= dailyLimit;

  const referralLink = `https://t.me/${BOT_USERNAME}?start=ref_${user?.id || ""}`;

  // Show ad automatically when user opens/navigates to Earn tab
  useEffect(() => {
    if (!user?.id) return;
    const timer = setTimeout(() => {
      try {
        const sdkFn = (window as any).show_11083687;
        if (typeof sdkFn === "function") {
          sdkFn();
        }
      } catch {
        // SDK not available or ad blocked — silent
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [user?.id]);

  const copyRefLink = () => {
    if (!user?.id) return;
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Copied!", description: "Referral link copied to clipboard.", duration: 3000 });
  };

  const completeAd = useCompleteAd({
    mutation: {
      onSuccess: (data) => {
        setBalanceKey((prev) => prev + 1);
        toast({ title: "Ad Complete! 💎", description: `You earned ꘜ${(data as any).earned.toFixed(4)}.`, duration: 3000 });
        if (user?.id) {
          queryClient.invalidateQueries({ queryKey: getGetMyStatsQueryKey({ telegramId: user.id }) });
          queryClient.invalidateQueries({ queryKey: getGetAdHistoryQueryKey({ telegramId: user.id }) });
        }
      },
      onError: (err: any) => {
        const isDailyLimit = err?.response?.status === 429;
        toast({
          title: isDailyLimit ? "Daily Limit Reached" : "Error",
          description: isDailyLimit
            ? `You've watched all ${dailyLimit} ads for today. Come back tomorrow!`
            : "Couldn't record your ad view. Please try again.",
          variant: "destructive",
          duration: 4000,
        });
      },
      onSettled: () => setIsWatching(false),
    }
  });

  const handleWatchAd = async () => {
    if (!user?.id || isWatching || limitReached) return;
    setIsWatching(true);
    try {
      const sdkFn = (window as any).show_11083687;
      if (typeof sdkFn === "function") {
        await sdkFn();
        completeAd.mutate({ data: { telegramId: user.id, username: user.username, firstName: user.firstName } });
      } else {
        setTimeout(() => {
          completeAd.mutate({ data: { telegramId: user.id, username: user.username, firstName: user.firstName } });
        }, 1500);
      }
    } catch {
      setIsWatching(false);
      toast({ title: "Ad Skipped", description: "Watch the full ad to earn rewards.", variant: "destructive", duration: 3000 });
    }
  };

  const isLoading = isUserLoading || isStatsLoading;

  return (
    <div className="flex flex-col h-full p-6 pt-12 relative">
      <div className="absolute top-[-100px] left-[-100px] w-64 h-64 bg-primary/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-[-100px] w-64 h-64 bg-primary/8 rounded-full blur-3xl pointer-events-none" />

      <header className="mb-8">
        <h1 className="text-xl font-medium text-muted-foreground tracking-tight">Welcome back,</h1>
        <div className="text-3xl font-bold tracking-tight text-foreground truncate">
          {user?.firstName || user?.username || "Earner"}
        </div>
      </header>

      <section className="flex flex-col items-center justify-center flex-1 py-4 relative">
        <div className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">Available Balance</div>

        {isLoading ? (
          <div className="h-16 w-48 bg-muted animate-pulse rounded-lg mb-4" />
        ) : (
          <AnimatePresence mode="popLayout">
            <motion.div
              key={balanceKey}
              initial={{ scale: 1.1, color: "hsl(var(--primary))" }}
              animate={{ scale: 1, color: "hsl(var(--foreground))" }}
              className="text-5xl font-black font-mono tracking-tighter mb-4"
            >
              ꘜ{stats?.balance?.toFixed(4) || "0.0000"}
            </motion.div>
          </AnimatePresence>
        )}

        <div className="bg-card/50 backdrop-blur border border-border/50 rounded-full px-4 py-1.5 flex items-center gap-2 mb-5">
          <TrendingUp className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-muted-foreground">
            Total earned: ꘜ{stats?.totalEarned?.toFixed(4) || "0.0000"}
          </span>
        </div>

        {/* Daily limit progress */}
        <div className="w-full max-w-[280px] mb-5">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>Daily Ads</span>
            <span className={cn("font-mono font-bold", limitReached ? "text-amber-500" : "text-foreground")}>
              {todayAds}/{dailyLimit}
            </span>
          </div>
          <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                limitReached ? "bg-amber-500" : "bg-primary"
              )}
              style={{ width: `${Math.min(100, (todayAds / dailyLimit) * 100)}%` }}
            />
          </div>
          {limitReached && (
            <div className="flex items-center gap-1 text-xs text-amber-500 font-medium mt-1.5 justify-center">
              <AlertCircle className="w-3 h-3" /> Daily limit reached — resets at midnight
            </div>
          )}
        </div>

        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }} className="w-full max-w-[280px]">
          <Button
            onClick={handleWatchAd}
            disabled={isWatching || isLoading || limitReached}
            className="w-full h-16 text-lg font-bold rounded-2xl shadow-[0_0_40px_-10px_hsl(var(--primary))] bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-50"
          >
            {isWatching ? (
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                Watching Ad...
              </div>
            ) : limitReached ? (
              <div className="flex items-center gap-3">
                <Clock className="w-6 h-6" />
                Come Back Tomorrow
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Play className="fill-current w-6 h-6" />
                Watch Ad & Earn ꘜ
              </div>
            )}
          </Button>
        </motion.div>

        {settings?.earnPerAd && !limitReached && (
          <p className="text-xs text-muted-foreground mt-2">
            Earn <span className="text-primary font-mono font-semibold">ꘜ{settings.earnPerAd.toFixed(4)}</span> per ad
          </p>
        )}
      </section>

      <section className="mt-auto bg-card rounded-2xl p-4 border border-card-border shadow-sm flex gap-4">
        <div className="flex-1 flex flex-col items-center justify-center p-2">
          <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
            <Zap className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wider">Today</span>
          </div>
          <div className="text-lg font-bold font-mono">ꘜ{stats?.todayEarned?.toFixed(4) || "0.0000"}</div>
        </div>
        <div className="w-[1px] bg-border my-2" />
        <div className="flex-1 flex flex-col items-center justify-center p-2">
          <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
            <Clock className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wider">Ads Today</span>
          </div>
          <div className="text-lg font-bold font-mono">{todayAds}<span className="text-xs text-muted-foreground font-normal">/{dailyLimit}</span></div>
        </div>
      </section>

      {/* Referrals */}
      <section className="mt-4 mb-4 bg-card rounded-2xl p-4 border border-card-border shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold">Referrals</h2>
          </div>
          {settings?.referralReward && (
            <div className="flex items-center gap-1.5 bg-primary/10 px-2.5 py-1 rounded-full">
              <Gift className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-bold text-primary font-mono">
                +ꘜ{settings.referralReward.toFixed(4)}/invite
              </span>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-background rounded-xl p-3 border flex items-center justify-between gap-3">
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-xs text-muted-foreground mb-1">Your referral link</span>
              <span className="font-mono text-xs font-medium truncate text-primary">{referralLink}</span>
            </div>
            <Button variant="secondary" size="icon" className="shrink-0" onClick={copyRefLink}>
              {copied ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>

          <div className="flex gap-4">
            <div className="flex-1 bg-background rounded-xl p-3 border flex flex-col items-center">
              <span className="text-xs text-muted-foreground mb-1">Total Referrals</span>
              {isRefLoading ? <div className="h-6 w-12 bg-muted animate-pulse rounded" /> : (
                <span className="font-bold font-mono">{refStats?.totalReferrals || 0}</span>
              )}
            </div>
            <div className="flex-1 bg-background rounded-xl p-3 border flex flex-col items-center">
              <span className="text-xs text-muted-foreground mb-1">Earned</span>
              {isRefLoading ? <div className="h-6 w-16 bg-muted animate-pulse rounded" /> : (
                <span className="font-bold font-mono text-primary">ꘜ{refStats?.totalEarned?.toFixed(4) || "0.0000"}</span>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
