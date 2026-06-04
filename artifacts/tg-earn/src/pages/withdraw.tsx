import React, { useState } from "react";
import { useTelegram } from "@/lib/telegram";
import {
  useGetMyStats, getGetMyStatsQueryKey,
  useGetWithdrawals, getGetWithdrawalsQueryKey,
  useRequestWithdrawal,
  useGetSettings,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Wallet, CheckCircle2, Clock, XCircle, AlertCircle,
  Lock, Copy, Check, Info,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const REFERRAL_REQUIREMENT = 10;
const BOT_USERNAME = import.meta.env.VITE_BOT_USERNAME || "TONStreamRewardsBot";

const METHODS = [
  { value: "TON", label: "TON Wallet" },
  { value: "TRX20", label: "USDT — TRC20 (TRON)" },
  { value: "BEP20", label: "USDT — BEP20 (BSC)" },
];

function ProgressBar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = Math.min(100, (value / max) * 100);
  const done = value >= max;
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className={cn("font-mono font-bold", done ? "text-emerald-500" : "text-foreground")}>
          {value}/{max}
        </span>
      </div>
      <div className="h-2 bg-secondary rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-500", done ? "bg-emerald-500" : "bg-primary")}
          style={{ width: `${pct}%` }}
        />
      </div>
      {done && (
        <div className="flex items-center gap-1 text-xs text-emerald-500 font-medium">
          <CheckCircle2 className="w-3 h-3" /> Requirement met
        </div>
      )}
    </div>
  );
}

export default function Withdraw() {
  const { user } = useTelegram();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedRef, setCopiedRef] = useState(false);

  const { data: stats, isLoading: isStatsLoading } = useGetMyStats(
    { telegramId: user?.id || "" },
    { query: { enabled: !!user?.id, queryKey: getGetMyStatsQueryKey({ telegramId: user?.id || "" }) } }
  );

  const { data: withdrawals, isLoading: isWithdrawalsLoading } = useGetWithdrawals(
    { telegramId: user?.id || "" },
    { query: { enabled: !!user?.id, queryKey: getGetWithdrawalsQueryKey({ telegramId: user?.id || "" }) } }
  );

  const { data: settings, isLoading: isSettingsLoading } = useGetSettings();

  const minWithdrawal = settings?.minWithdrawal ?? 0.5;
  const DAILY_ADS_REQUIREMENT = settings?.withdrawalAdsRequired ?? 15;

  const withdrawalSchema = z.object({
    amount: z.coerce.number().min(minWithdrawal, `Minimum withdrawal is ꘜ${minWithdrawal}`),
    method: z.enum(["TON", "TRX20", "BEP20"], { message: "Please select a method" }),
    destination: z.string().min(10, "Please enter a valid wallet address"),
  });

  type WithdrawalFormValues = z.infer<typeof withdrawalSchema>;

  const form = useForm<WithdrawalFormValues>({
    resolver: zodResolver(withdrawalSchema),
    defaultValues: { amount: minWithdrawal, method: "TON", destination: "" },
  });

  const selectedMethod = form.watch("method");

  const referralCount = stats?.referralCount ?? 0;
  const todayAds = stats?.todayAds ?? 0;
  const referralUnlocked = referralCount >= REFERRAL_REQUIREMENT;
  const dailyUnlocked = todayAds >= DAILY_ADS_REQUIREMENT;
  const canWithdraw = referralUnlocked && dailyUnlocked;

  const referralLink = `https://t.me/${BOT_USERNAME}?start=ref_${user?.id || ""}`;

  const copyRefLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopiedRef(true);
    setTimeout(() => setCopiedRef(false), 2000);
    toast({ title: "Copied!", description: "Referral link copied.", duration: 3000 });
  };

  const requestWithdrawal = useRequestWithdrawal({
    mutation: {
      onSuccess: () => {
        toast({
          title: "Withdrawal Requested 💎",
          description: "Your payment is being processed. You'll receive a Telegram notification shortly.",
          duration: 3000,
        });
        form.reset({ amount: minWithdrawal, method: "TON", destination: "" });
        if (user?.id) {
          queryClient.invalidateQueries({ queryKey: getGetMyStatsQueryKey({ telegramId: user.id }) });
          queryClient.invalidateQueries({ queryKey: getGetWithdrawalsQueryKey({ telegramId: user.id }) });
        }
      },
      onError: (error: any) => {
        const msg = error?.response?.data?.error || error.message || "Failed to request withdrawal.";
        toast({ title: "Withdrawal Failed", description: msg, variant: "destructive", duration: 3000 });
      },
      onSettled: () => setIsSubmitting(false),
    }
  });

  const onSubmit = (data: WithdrawalFormValues) => {
    if (!user?.id) return;
    if (stats && data.amount > stats.balance) {
      form.setError("amount", { message: "Insufficient balance" });
      return;
    }
    setIsSubmitting(true);
    requestWithdrawal.mutate({ data: { telegramId: user.id, amount: data.amount, method: data.method, destination: data.destination } });
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case "completed": return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case "pending": return <Clock className="w-4 h-4 text-amber-500" />;
      case "rejected": return <XCircle className="w-4 h-4 text-destructive" />;
      default: return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "completed": return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Completed</Badge>;
      case "pending": return <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20">Pending</Badge>;
      case "rejected": return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">Rejected</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getAddressPlaceholder = (method: string) => {
    switch (method) {
      case "TON": return "EQ...";
      case "TRX20": return "T...";
      case "BEP20": return "0x...";
      default: return "";
    }
  };

  return (
    <div className="flex flex-col h-full p-6 pt-12">
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-foreground mb-1">Withdraw</h1>
        <p className="text-muted-foreground text-sm">Cash out your TON earnings.</p>
      </header>

      {/* Balance card */}
      <div className="bg-card rounded-2xl p-5 border border-card-border shadow-sm mb-5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl -mr-10 -mt-10" />
        <div className="text-sm font-medium text-muted-foreground mb-1">Available to withdraw</div>
        {isStatsLoading ? <Skeleton className="h-10 w-40 mb-2" /> : (
          <div className="text-4xl font-black font-mono tracking-tight">ꘜ{stats?.balance?.toFixed(4) || "0.0000"}</div>
        )}

        <div className="flex flex-wrap items-center gap-2 mt-3">
          {isSettingsLoading ? (
            <Skeleton className="h-6 w-36 rounded-full" />
          ) : (
            <div className="flex items-center gap-1.5 text-xs bg-secondary px-2.5 py-1 rounded-full text-muted-foreground">
              <Info className="w-3 h-3" />
              Min withdrawal: <span className="font-bold font-mono text-foreground">ꘜ{minWithdrawal.toFixed(2)}</span>
            </div>
          )}

          {stats && stats.pendingWithdrawals > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-amber-500 bg-amber-500/10 px-2.5 py-1 rounded-full">
              <AlertCircle className="w-3 h-3" />
              ꘜ{stats.pendingWithdrawals.toFixed(4)} pending
            </div>
          )}
        </div>
      </div>

      {/* Requirements section */}
      {isStatsLoading ? (
        <Skeleton className="h-36 w-full rounded-2xl mb-5" />
      ) : (
        <div className={cn(
          "rounded-2xl p-5 border mb-5 space-y-4",
          canWithdraw ? "bg-emerald-500/5 border-emerald-500/20" : "bg-card border-card-border"
        )}>
          <div className="flex items-center gap-2 mb-1">
            {canWithdraw ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            ) : (
              <Lock className="w-5 h-5 text-muted-foreground" />
            )}
            <span className="font-bold text-sm">
              {canWithdraw ? "Withdrawal Unlocked — Ready!" : "Withdrawal Requirements"}
            </span>
          </div>

          <ProgressBar value={referralCount} max={REFERRAL_REQUIREMENT} label="Referrals (permanent unlock)" />

          {!referralUnlocked && (
            <div className="mt-1">
              <p className="text-xs text-muted-foreground mb-2">
                Invite {REFERRAL_REQUIREMENT - referralCount} more friend{REFERRAL_REQUIREMENT - referralCount !== 1 ? "s" : ""} to unlock withdrawal.
              </p>
              <div className="flex items-center gap-2 bg-background rounded-lg p-2 border">
                <span className="text-xs font-mono text-primary truncate flex-1">{referralLink}</span>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={copyRefLink}>
                  {copiedRef ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
                </Button>
              </div>
            </div>
          )}

          <ProgressBar value={todayAds} max={DAILY_ADS_REQUIREMENT} label="Ads watched today (daily reset)" />

          {referralUnlocked && !dailyUnlocked && (
            <p className="text-xs text-muted-foreground">
              Watch {DAILY_ADS_REQUIREMENT - todayAds} more ad{DAILY_ADS_REQUIREMENT - todayAds !== 1 ? "s" : ""} today to withdraw. Resets at midnight.
            </p>
          )}
        </div>
      )}

      {/* Withdrawal form */}
      {canWithdraw && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Request Payout</h2>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount (ꘜ)</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono">ꘜ</span>
                        <Input type="number" step="0.01" min={minWithdrawal} className="pl-7 font-mono bg-background" {...field} />
                      </div>
                    </FormControl>
                    <FormDescription>Minimum: ꘜ{minWithdrawal.toFixed(2)}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="method"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Network</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-background">
                          <SelectValue placeholder="Select network" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {METHODS.map((m) => (
                          <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="destination"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {selectedMethod === "TON" ? "TON Wallet Address" : selectedMethod === "TRX20" ? "TRC20 Wallet Address" : "BEP20 Wallet Address"}
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder={getAddressPlaceholder(selectedMethod)}
                        className="bg-background font-mono text-sm"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>Double-check your address. Transfers are irreversible.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="w-full h-12 mt-2 font-bold text-base bg-primary hover:bg-primary/90 text-primary-foreground"
                disabled={isSubmitting || !stats?.balance || stats.balance < minWithdrawal}
              >
                {isSubmitting ? "Processing..." : "Withdraw TON 💎"}
              </Button>
            </form>
          </Form>
        </div>
      )}

      {/* Past withdrawals */}
      <div className="pb-6">
        <h2 className="text-lg font-semibold mb-4">Past Withdrawals</h2>
        {isWithdrawalsLoading ? (
          <div className="space-y-3">{[1, 2].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>
        ) : withdrawals?.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground flex flex-col items-center bg-card/50 rounded-xl border border-border/50">
            <Wallet className="w-8 h-8 mb-3 opacity-20" />
            <p>No withdrawal history.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {withdrawals?.map((wd) => (
              <div key={wd.id} className="flex items-center gap-4 bg-card p-4 rounded-xl border border-card-border">
                <div className="w-10 h-10 bg-secondary rounded-full flex items-center justify-center">
                  {getStatusIcon(wd.status)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-xs tracking-wider">{wd.method}</span>
                    {getStatusBadge(wd.status)}
                  </div>
                  <div className="text-xs text-muted-foreground font-mono truncate">{wd.destination}</div>
                  <div className="text-xs text-muted-foreground mt-1">{format(new Date(wd.createdAt), "MMM d, yyyy")}</div>
                </div>
                <div className="font-mono font-bold">ꘜ{wd.amount.toFixed(4)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
