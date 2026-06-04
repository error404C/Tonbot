import React from "react";
import { useTelegram } from "@/lib/telegram";
import { useGetLeaderboard, getGetLeaderboardQueryKey } from "@workspace/api-client-react";
import { Trophy, Medal, Star, Play } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export default function Leaderboard() {
  const { user } = useTelegram();

  const { data: leaderboard, isLoading } = useGetLeaderboard(
    { limit: 50 },
    {
      query: {
        queryKey: getGetLeaderboardQueryKey({ limit: 50 }),
      },
    }
  );

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return <Trophy className="w-5 h-5 text-yellow-500" />;
      case 2: return <Medal className="w-5 h-5 text-slate-300" />;
      case 3: return <Medal className="w-5 h-5 text-amber-700" />;
      default: return <span className="font-mono text-sm text-muted-foreground font-bold">{rank}</span>;
    }
  };

  const getRankStyle = (rank: number) => {
    switch (rank) {
      case 1: return "bg-yellow-500/10 border-yellow-500/30 text-yellow-500";
      case 2: return "bg-slate-300/10 border-slate-300/30 text-slate-300";
      case 3: return "bg-amber-700/10 border-amber-700/30 text-amber-700";
      default: return "bg-secondary text-secondary-foreground";
    }
  };

  return (
    <div className="flex flex-col h-full p-6 pt-12">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2 flex items-center gap-3">
          Top Earners
          <Star className="w-6 h-6 text-primary fill-primary" />
        </h1>
        <p className="text-muted-foreground">The most active users in the network.</p>
      </header>

      <div className="bg-card rounded-2xl p-4 border border-card-border mb-6 flex justify-around shadow-sm relative overflow-hidden">
        <div className="absolute -right-4 -top-4 w-24 h-24 bg-primary/10 rounded-full blur-xl pointer-events-none" />
        <div className="flex flex-col items-center justify-center">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Your Rank</div>
          <div className="text-xl font-bold font-mono text-primary">
            {isLoading ? <Skeleton className="h-7 w-12" /> : (
              leaderboard?.find(entry => entry.telegramId === user?.id)?.rank || "Unranked"
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 pb-6">
        <div className="flex items-center justify-between text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 mb-3">
          <div>User</div>
          <div>Earned</div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="flex items-center gap-4 bg-card/50 p-4 rounded-xl border border-border/50">
                <Skeleton className="w-8 h-8 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-24 mb-1" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <Skeleton className="h-5 w-16" />
              </div>
            ))}
          </div>
        ) : leaderboard?.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground bg-card/50 rounded-xl border border-border/50">
            <p>Leaderboard is empty.</p>
            <p className="text-sm mt-1">Be the first to earn!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {leaderboard?.map((entry) => {
              const isCurrentUser = entry.telegramId === user?.id;
              
              return (
                <div 
                  key={entry.telegramId} 
                  className={cn(
                    "flex items-center gap-4 p-3 rounded-xl border transition-all",
                    isCurrentUser 
                      ? "bg-primary/5 border-primary/30 shadow-[0_0_15px_-5px_hsl(var(--primary))]" 
                      : "bg-card border-card-border hover:border-border"
                  )}
                >
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center shrink-0 border",
                    getRankStyle(entry.rank)
                  )}>
                    {getRankIcon(entry.rank)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className={cn(
                      "font-medium truncate",
                      isCurrentUser ? "text-primary font-bold" : ""
                    )}>
                      {entry.firstName || entry.username || `User ${entry.telegramId.slice(0, 5)}...`}
                      {isCurrentUser && <span className="ml-2 text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded-sm">YOU</span>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                      <Play className="w-3 h-3" />
                      {entry.adsWatched} ads
                    </div>
                  </div>
                  
                  <div className={cn(
                    "font-mono font-bold shrink-0",
                    entry.rank <= 3 ? "text-foreground" : "text-muted-foreground",
                    isCurrentUser ? "text-primary" : ""
                  )}>
                    ꘜ{entry.totalEarned.toFixed(4)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
