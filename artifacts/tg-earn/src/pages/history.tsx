import React from "react";
import { useTelegram } from "@/lib/telegram";
import { useGetAdHistory, getGetAdHistoryQueryKey, useGetMyStats, getGetMyStatsQueryKey } from "@workspace/api-client-react";
import { format } from "date-fns";
import { Play, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function History() {
  const { user } = useTelegram();

  const { data: history, isLoading: isHistoryLoading } = useGetAdHistory(
    { telegramId: user?.id || "", limit: 50 },
    {
      query: {
        enabled: !!user?.id,
        queryKey: getGetAdHistoryQueryKey({ telegramId: user?.id || "", limit: 50 }),
      },
    }
  );

  const { data: stats, isLoading: isStatsLoading } = useGetMyStats(
    { telegramId: user?.id || "" },
    {
      query: {
        enabled: !!user?.id,
        queryKey: getGetMyStatsQueryKey({ telegramId: user?.id || "" }),
      },
    }
  );

  return (
    <div className="flex flex-col h-full p-6 pt-12">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">History</h1>
        <p className="text-muted-foreground">Your earning track record.</p>
      </header>

      <div className="bg-card rounded-2xl p-5 border border-card-border mb-8 shadow-sm flex items-center justify-between">
        <div>
          <div className="text-sm font-medium text-muted-foreground mb-1">Total Earned</div>
          {isStatsLoading ? (
            <Skeleton className="h-8 w-32" />
          ) : (
            <div className="text-2xl font-bold font-mono text-primary flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              ꘜ{stats?.totalEarned?.toFixed(4) || "0.0000"}
            </div>
          )}
        </div>
        <div className="text-right">
          <div className="text-sm font-medium text-muted-foreground mb-1">Ads Watched</div>
          {isStatsLoading ? (
            <Skeleton className="h-8 w-16 ml-auto" />
          ) : (
            <div className="text-2xl font-bold font-mono">{stats?.adsWatched || 0}</div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <h2 className="text-lg font-semibold mb-4">Recent Views</h2>
        
        {isHistoryLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-4 bg-card/50 p-4 rounded-xl border border-border/50">
                <Skeleton className="w-10 h-10 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-5 w-16" />
              </div>
            ))}
          </div>
        ) : history?.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground flex flex-col items-center justify-center">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
              <Play className="w-6 h-6 text-muted-foreground" />
            </div>
            <p>No ads watched yet.</p>
            <p className="text-sm mt-1">Start watching to earn!</p>
          </div>
        ) : (
          <div className="space-y-3 pb-4">
            {history?.map((view) => (
              <div key={view.id} className="flex items-center gap-4 bg-card p-4 rounded-xl border border-card-border hover:border-primary/50 transition-colors">
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                  <Play className="w-4 h-4 fill-current" />
                </div>
                <div className="flex-1">
                  <div className="font-medium">Ad Reward</div>
                  <div className="text-xs text-muted-foreground">
                    {format(new Date(view.createdAt), "MMM d, yyyy • h:mm a")}
                  </div>
                </div>
                <div className="font-mono font-bold text-primary">
                  +ꘜ{view.earned.toFixed(4)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
