import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TelegramProvider, useTelegram } from "@/lib/telegram";
import { Layout } from "@/components/layout";
import { useGetSettings } from "@workspace/api-client-react";
import { ExternalLink, Users, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Pages
import Home from "@/pages/home";
import History from "@/pages/history";
import Withdraw from "@/pages/withdraw";
import Leaderboard from "@/pages/leaderboard";
import Tasks from "@/pages/tasks";
import Admin from "@/pages/admin";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

// ── Airdrop Ended Screen ──────────────────────────────────────────────────────
function AirdropEndedScreen({ channelUrl }: { channelUrl?: string | null }) {
  return (
    <div className="min-h-[100dvh] w-full bg-background flex flex-col items-center justify-center">
      <div className="w-full max-w-[428px] h-[100dvh] flex flex-col items-center justify-center relative p-8">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative text-center">
          <div className="text-7xl mb-6">🌊</div>
          <h1 className="text-3xl font-black tracking-tight mb-3 text-foreground">Airdrop Ended</h1>
          <p className="text-muted-foreground text-base mb-2 leading-relaxed">
            The <span className="text-primary font-semibold">TONStream Rewards</span> airdrop campaign has concluded.
          </p>
          <p className="text-muted-foreground text-sm mb-8">
            Thank you for participating! Stay tuned for future campaigns and announcements.
          </p>
          {channelUrl && (
            <a
              href={channelUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-bold px-6 py-3 rounded-xl shadow-[0_0_30px_-8px_hsl(var(--primary))] hover:bg-primary/90 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Join Channel for Updates
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Must Join Channels Screen ─────────────────────────────────────────────────
interface ChannelCheck {
  id: number;
  channelId: string;
  title: string;
  url: string;
  isJoined: boolean;
}

function MustJoinScreen({
  channels,
  onRecheck,
  isChecking,
}: {
  channels: ChannelCheck[];
  onRecheck: () => void;
  isChecking: boolean;
}) {
  return (
    <div className="min-h-[100dvh] w-full bg-background flex flex-col items-center justify-center">
      <div className="w-full max-w-[428px] h-[100dvh] flex flex-col items-center justify-center relative p-6">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-72 h-72 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative w-full text-center">
          <div className="w-20 h-20 rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center mx-auto mb-5">
            <Users className="w-9 h-9 text-primary" />
          </div>
          <h1 className="text-2xl font-black tracking-tight mb-2">Join Our Channels</h1>
          <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
            Please join all the channels below to access <span className="text-primary font-semibold">TONStream Rewards</span>.
          </p>

          <div className="space-y-3 mb-6 text-left">
            {channels.map((ch) => (
              <a
                key={ch.id}
                href={ch.url}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "flex items-center gap-4 p-4 rounded-xl border transition-all",
                  ch.isJoined
                    ? "bg-emerald-500/5 border-emerald-500/30"
                    : "bg-card border-border hover:border-primary/40"
                )}
              >
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-lg font-bold",
                  ch.isJoined ? "bg-emerald-500/15 text-emerald-500" : "bg-primary/10 text-primary"
                )}>
                  {ch.isJoined ? <CheckCircle2 className="w-5 h-5" /> : "📢"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={cn("font-bold truncate", ch.isJoined && "text-emerald-400")}>
                    {ch.title}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{ch.channelId}</div>
                </div>
                {!ch.isJoined && <ExternalLink className="w-4 h-4 text-muted-foreground shrink-0" />}
              </a>
            ))}
          </div>

          <Button
            onClick={onRecheck}
            disabled={isChecking}
            className="w-full h-13 text-base font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_0_30px_-8px_hsl(var(--primary))]"
          >
            {isChecking ? (
              <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Verifying...</>
            ) : (
              <><RefreshCw className="w-5 h-5 mr-2" /> I've Joined — Check Now</>
            )}
          </Button>
          <p className="text-xs text-muted-foreground mt-3">
            Tap all channel links above to join, then press check.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── App Content (with guards) ─────────────────────────────────────────────────
function AppContent() {
  const { user } = useTelegram();
  const { data: settings } = useGetSettings();
  const [recheckKey, setRecheckKey] = useState(0);
  const [isRechecking, setIsRechecking] = useState(false);

  const { data: channelCheck, refetch: refetchCheck } = useQuery({
    queryKey: ["channels-check", user?.id, recheckKey],
    queryFn: async () => {
      if (!user?.id) return { allJoined: true, channels: [] };
      const res = await fetch(`/api/channels/check?telegramId=${user.id}`);
      if (!res.ok) return { allJoined: true, channels: [] };
      return res.json() as Promise<{ allJoined: boolean; channels: ChannelCheck[] }>;
    },
    enabled: !!user?.id,
    staleTime: 10_000,
  });

  const handleRecheck = async () => {
    setIsRechecking(true);
    await refetchCheck();
    setIsRechecking(false);
  };

  // Airdrop ended takes priority
  if (settings?.airdropEnded) {
    return <AirdropEndedScreen channelUrl={settings.airdropChannel} />;
  }

  // Must-join channels gate
  if (channelCheck && !channelCheck.allJoined) {
    return (
      <MustJoinScreen
        channels={channelCheck.channels}
        onRecheck={handleRecheck}
        isChecking={isRechecking}
      />
    );
  }

  return (
    <Layout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/tasks" component={Tasks} />
        <Route path="/history" component={History} />
        <Route path="/withdraw" component={Withdraw} />
        <Route path="/leaderboard" component={Leaderboard} />
        <Route path="/admin" component={Admin} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TelegramProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <AppContent />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </TelegramProvider>
    </QueryClientProvider>
  );
}

export default App;
