import React, { useState } from "react";
import { useTelegram } from "@/lib/telegram";
import {
  useGetAdminStats, getGetAdminStatsQueryKey,
  useGetSettings,
  useUpdateAdminSettings,
  useGetAdminWithdrawals, getGetAdminWithdrawalsQueryKey,
  useApproveWithdrawal,
  useRejectWithdrawal,
  useGetTasks, getGetTasksQueryKey,
  useCreateTask,
  useDeleteTask,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ShieldAlert, Users, TrendingUp, Wallet, ListTodo, Check, X,
  Loader2, Plus, Trash2, Radio, Search, Ban, CircleCheck, DollarSign,
  MessageSquare, ChevronLeft, UserCircle, ClipboardCheck, CheckCircle2, XCircle,
  ToggleLeft, ToggleRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export default function Admin() {
  const { user } = useTelegram();
  const adminTelegramId = user?.id || "";

  const { error: statsError } = useGetAdminStats(
    { adminTelegramId },
    { query: { enabled: !!adminTelegramId, queryKey: getGetAdminStatsQueryKey({ adminTelegramId }), retry: false } }
  );

  const isUnauthorized = !!statsError && (statsError as any)?.response?.status === 403;

  if (isUnauthorized) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <ShieldAlert className="w-16 h-16 text-destructive mb-4" />
        <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
        <p className="text-muted-foreground">You do not have permission to view this page.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-6 pt-12">
      <header className="mb-5">
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
          Admin Panel <ShieldAlert className="w-6 h-6 text-primary" />
        </h1>
      </header>

      <Tabs defaultValue="stats" className="flex-1 flex flex-col min-h-0">
        <TabsList className="grid grid-cols-5 mb-3 h-auto shrink-0">
          <TabsTrigger value="stats"       className="text-[10px] py-2">Stats</TabsTrigger>
          <TabsTrigger value="settings"    className="text-[10px] py-2">Settings</TabsTrigger>
          <TabsTrigger value="payouts"     className="text-[10px] py-2">Payouts</TabsTrigger>
          <TabsTrigger value="tasks"       className="text-[10px] py-2">Tasks</TabsTrigger>
          <TabsTrigger value="users"       className="text-[10px] py-2">Users</TabsTrigger>
        </TabsList>
        <TabsList className="grid grid-cols-3 mb-5 h-auto shrink-0">
          <TabsTrigger value="proofs"      className="text-[10px] py-2">Proofs</TabsTrigger>
          <TabsTrigger value="broadcast"   className="text-[10px] py-2">Broadcast</TabsTrigger>
          <TabsTrigger value="channels"    className="text-[10px] py-2">Channels</TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-y-auto pb-6 hide-scrollbar">
          <TabsContent value="stats"     className="m-0"><AdminStatsTab     adminTelegramId={adminTelegramId} /></TabsContent>
          <TabsContent value="settings"  className="m-0"><AdminSettingsTab  adminTelegramId={adminTelegramId} /></TabsContent>
          <TabsContent value="payouts"   className="m-0"><AdminWithdrawalsTab adminTelegramId={adminTelegramId} /></TabsContent>
          <TabsContent value="tasks"     className="m-0"><AdminTasksTab     adminTelegramId={adminTelegramId} /></TabsContent>
          <TabsContent value="users"     className="m-0"><AdminUsersTab     adminTelegramId={adminTelegramId} /></TabsContent>
          <TabsContent value="proofs"    className="m-0"><AdminProofsTab    adminTelegramId={adminTelegramId} /></TabsContent>
          <TabsContent value="broadcast" className="m-0"><AdminBroadcastTab adminTelegramId={adminTelegramId} /></TabsContent>
          <TabsContent value="channels"  className="m-0"><AdminChannelsTab  adminTelegramId={adminTelegramId} /></TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

// ── Stats ─────────────────────────────────────────────────────────────────────
function AdminStatsTab({ adminTelegramId }: { adminTelegramId: string }) {
  const { data: stats, isLoading } = useGetAdminStats(
    { adminTelegramId },
    { query: { enabled: !!adminTelegramId, queryKey: getGetAdminStatsQueryKey({ adminTelegramId }), retry: false } }
  );

  if (isLoading) return <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>;

  const items = [
    { label: "Total Users",       value: stats?.totalUsers ?? 0,                                    icon: Users },
    { label: "Ads Watched",       value: stats?.totalAdsWatched ?? 0,                                icon: TrendingUp },
    { label: "Total Earned",      value: `ꘜ${(stats?.totalEarned ?? 0).toFixed(4)}`,                icon: Wallet },
    { label: "Total Withdrawn",   value: `ꘜ${(stats?.totalWithdrawn ?? 0).toFixed(2)}`,             icon: Wallet },
    { label: "Pending Payouts",   value: `ꘜ${(stats?.pendingWithdrawals ?? 0).toFixed(2)}`,         icon: Wallet },
    { label: "Active Tasks",      value: stats?.activeTasks ?? 0,                                    icon: ListTodo },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map((item, i) => (
        <div key={i} className="bg-card p-4 rounded-xl border border-border flex flex-col gap-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            <item.icon className="w-4 h-4" />
            <span className="text-xs font-medium">{item.label}</span>
          </div>
          <div className="text-lg font-bold">{item.value}</div>
        </div>
      ))}
    </div>
  );
}

// ── Settings ──────────────────────────────────────────────────────────────────
function AdminSettingsTab({ adminTelegramId }: { adminTelegramId: string }) {
  const { data: settings, isLoading, refetch } = useGetSettings();
  const updateSettings = useUpdateAdminSettings();
  const { toast } = useToast();

  const [form, setForm] = useState({
    earnPerAd: "0",
    referralReward: "0",
    minWithdrawal: "0",
    addTaskUrl: "",
    dailyWatchLimit: "20",
    withdrawalAdsRequired: "15",
    airdropEnded: false,
    airdropChannel: "",
    monetagScript: "",
    extraAdminIds: "",
  });

  React.useEffect(() => {
    if (settings) setForm({
      earnPerAd: settings.earnPerAd.toString(),
      referralReward: settings.referralReward.toString(),
      minWithdrawal: settings.minWithdrawal.toString(),
      addTaskUrl: settings.addTaskUrl ?? "",
      dailyWatchLimit: (settings.dailyWatchLimit ?? 20).toString(),
      withdrawalAdsRequired: (settings.withdrawalAdsRequired ?? 15).toString(),
      airdropEnded: settings.airdropEnded ?? false,
      airdropChannel: settings.airdropChannel ?? "",
      monetagScript: settings.monetagScript ?? "",
      extraAdminIds: settings.extraAdminIds ?? "",
    });
  }, [settings]);

  const handleSave = () => {
    updateSettings.mutate(
      {
        data: {
          adminTelegramId,
          earnPerAd: Number(form.earnPerAd),
          referralReward: Number(form.referralReward),
          minWithdrawal: Number(form.minWithdrawal),
          addTaskUrl: form.addTaskUrl,
          dailyWatchLimit: Number(form.dailyWatchLimit),
          withdrawalAdsRequired: Number(form.withdrawalAdsRequired),
          airdropEnded: form.airdropEnded,
          airdropChannel: form.airdropChannel,
          monetagScript: form.monetagScript,
          extraAdminIds: form.extraAdminIds,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "✅ Settings Saved", duration: 3000 });
          refetch();
        },
        onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive", duration: 3000 }),
      }
    );
  };

  if (isLoading) return <Skeleton className="h-80 w-full rounded-xl" />;

  return (
    <div className="space-y-5">
      {/* Earnings */}
      <div className="bg-card p-5 rounded-xl border border-border space-y-4">
        <div className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Earnings</div>
        {[
          { label: "Earn Per Ad (ꘜ)", key: "earnPerAd" as const, step: "0.0001" },
          { label: "Referral Reward (ꘜ)", key: "referralReward" as const, step: "0.0001" },
          { label: "Min Withdrawal (ꘜ)", key: "minWithdrawal" as const, step: "0.1" },
        ].map(({ label, key, step }) => (
          <div key={key} className="space-y-2">
            <Label>{label}</Label>
            <Input type="number" step={step} value={form[key] as string} onChange={e => setForm({ ...form, [key]: e.target.value })} />
          </div>
        ))}
      </div>

      {/* Limits */}
      <div className="bg-card p-5 rounded-xl border border-border space-y-4">
        <div className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Limits</div>
        <div className="space-y-2">
          <Label>Daily Watch Limit</Label>
          <Input type="number" min="1" step="1" value={form.dailyWatchLimit} onChange={e => setForm({ ...form, dailyWatchLimit: e.target.value })} />
          <p className="text-xs text-muted-foreground">Max ads a user can watch per day to earn.</p>
        </div>
        <div className="space-y-2">
          <Label>Withdrawal Ads Required (per day)</Label>
          <Input type="number" min="0" step="1" value={form.withdrawalAdsRequired} onChange={e => setForm({ ...form, withdrawalAdsRequired: e.target.value })} />
          <p className="text-xs text-muted-foreground">How many ads today a user must have watched to request a withdrawal.</p>
        </div>
      </div>

      {/* Airdrop Ended Toggle */}
      <div className="bg-card p-5 rounded-xl border border-border space-y-4">
        <div className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Airdrop Status</div>
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">End Airdrop</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {form.airdropEnded
                ? "🔴 Airdrop ended — users see the ended screen"
                : "🟢 Airdrop active — mini app is open"}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setForm({ ...form, airdropEnded: !form.airdropEnded })}
            className="text-primary"
          >
            {form.airdropEnded
              ? <ToggleRight className="w-10 h-10" />
              : <ToggleLeft className="w-10 h-10 text-muted-foreground" />}
          </button>
        </div>

        {form.airdropEnded && (
          <div className="space-y-2">
            <Label>Channel Link for Updates</Label>
            <Input
              type="url"
              placeholder="https://t.me/your_channel"
              value={form.airdropChannel}
              onChange={e => setForm({ ...form, airdropChannel: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Users will see a button to join this channel on the airdrop ended screen.
            </p>
          </div>
        )}
      </div>

      {/* Monetag Script */}
      <div className="bg-card p-5 rounded-xl border border-border space-y-4">
        <div className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Ad Network</div>
        <div className="space-y-2">
          <Label>Monetag Script Tag</Label>
          <Textarea
            placeholder={"<script src='//libtl.com/sdk.js' data-zone='11083687' data-sdk='show_11083687'></script>"}
            value={form.monetagScript}
            onChange={e => setForm({ ...form, monetagScript: e.target.value })}
            className="font-mono text-xs bg-background min-h-[80px]"
          />
          <p className="text-xs text-muted-foreground">
            Paste the full Monetag script tag. The zone ID and SDK name will be extracted automatically. Changes take effect after page reload.
          </p>
        </div>
      </div>

      {/* Admin IDs */}
      <div className="bg-card p-5 rounded-xl border border-border space-y-4">
        <div className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Admin Access</div>
        <div className="space-y-2">
          <Label>Extra Admin Telegram IDs</Label>
          <Input
            placeholder="123456789, 987654321"
            value={form.extraAdminIds}
            onChange={e => setForm({ ...form, extraAdminIds: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            Comma-separated Telegram user IDs of additional admins.
          </p>
        </div>
      </div>

      {/* Task Link */}
      <div className="bg-card p-5 rounded-xl border border-border space-y-4">
        <div className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Tasks</div>
        <div className="space-y-2">
          <Label>Add Task / Promote Link</Label>
          <Input
            type="url"
            placeholder="https://t.me/your_channel"
            value={form.addTaskUrl}
            onChange={e => setForm({ ...form, addTaskUrl: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            Users see a "Promote Your Link" button at the bottom of the Tasks page.
          </p>
        </div>
      </div>

      <Button className="w-full" onClick={handleSave} disabled={updateSettings.isPending}>
        {updateSettings.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        Save All Settings
      </Button>
    </div>
  );
}

// ── Withdrawals ───────────────────────────────────────────────────────────────
function AdminWithdrawalsTab({ adminTelegramId }: { adminTelegramId: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: withdrawals, isLoading } = useGetAdminWithdrawals(
    { adminTelegramId, status: "pending" },
    { query: { enabled: !!adminTelegramId, queryKey: getGetAdminWithdrawalsQueryKey({ adminTelegramId, status: "pending" }) } }
  );

  const approve = useApproveWithdrawal({
    mutation: {
      onSuccess: () => {
        toast({ title: "Approved ✅", duration: 3000 });
        queryClient.invalidateQueries({ queryKey: getGetAdminWithdrawalsQueryKey({ adminTelegramId, status: "pending" }) });
      },
    },
  });
  const reject = useRejectWithdrawal({
    mutation: {
      onSuccess: () => {
        toast({ title: "Rejected", duration: 3000 });
        queryClient.invalidateQueries({ queryKey: getGetAdminWithdrawalsQueryKey({ adminTelegramId, status: "pending" }) });
      },
    },
  });

  if (isLoading) return <Skeleton className="h-32 w-full rounded-xl" />;
  if (!withdrawals?.length) return (
    <div className="text-center py-10 text-muted-foreground border rounded-xl border-dashed">No pending withdrawals</div>
  );

  return (
    <div className="space-y-3">
      {withdrawals.map(w => (
        <div key={w.id} className="bg-card p-4 rounded-xl border border-border">
          <div className="flex justify-between items-start mb-2">
            <div>
              <div className="font-bold font-mono">ꘜ{w.amount.toFixed(4)}</div>
              <div className="text-xs text-primary font-medium">{w.method}</div>
            </div>
            <div className="text-right">
              <div className="text-sm font-medium">{w.user?.username ? `@${w.user.username}` : w.user?.firstName || "User"}</div>
              <div className="text-xs text-muted-foreground">{w.user?.telegramId}</div>
            </div>
          </div>
          <div className="bg-muted p-2 rounded text-xs break-all mb-3 font-mono">{w.destination}</div>
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border-none"
              onClick={() => approve.mutate({ withdrawalId: w.id, data: { adminTelegramId } })}
              disabled={approve.isPending || reject.isPending}
            >
              <Check className="w-4 h-4 mr-1" /> Approve
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="flex-1"
              onClick={() => reject.mutate({ withdrawalId: w.id, data: { adminTelegramId } })}
              disabled={approve.isPending || reject.isPending}
            >
              <X className="w-4 h-4 mr-1" /> Reject
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Tasks ─────────────────────────────────────────────────────────────────────
function AdminTasksTab({ adminTelegramId }: { adminTelegramId: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", reward: "0.05", url: "" });

  const { data: tasks, isLoading } = useGetTasks(
    { telegramId: adminTelegramId },
    { query: { enabled: !!adminTelegramId, queryKey: getGetTasksQueryKey({ telegramId: adminTelegramId }) } }
  );

  const createTask = useCreateTask({
    mutation: {
      onSuccess: () => {
        toast({ title: "Task created", duration: 3000 });
        setIsOpen(false);
        setForm({ title: "", description: "", reward: "0.05", url: "" });
        queryClient.invalidateQueries({ queryKey: getGetTasksQueryKey({ telegramId: adminTelegramId }) });
      },
    },
  });
  const deleteTask = useDeleteTask({
    mutation: {
      onSuccess: () => {
        toast({ title: "Task deleted", duration: 3000 });
        queryClient.invalidateQueries({ queryKey: getGetTasksQueryKey({ telegramId: adminTelegramId }) });
      },
    },
  });

  return (
    <div className="space-y-4">
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button className="w-full"><Plus className="w-4 h-4 mr-2" /> Add Task</Button>
        </DialogTrigger>
        <DialogContent className="max-w-[90%] rounded-xl sm:max-w-md">
          <DialogHeader><DialogTitle>New Task</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            {[
              { label: "Title", key: "title" as const, placeholder: "Join Telegram Channel" },
              { label: "Description", key: "description" as const, placeholder: "Join our official channel" },
              { label: "URL (optional)", key: "url" as const, placeholder: "https://t.me/..." },
            ].map(({ label, key, placeholder }) => (
              <div key={key} className="space-y-2">
                <Label>{label}</Label>
                <Input value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} placeholder={placeholder} />
              </div>
            ))}
            <div className="space-y-2">
              <Label>Reward (ꘜ)</Label>
              <Input type="number" step="0.001" value={form.reward} onChange={e => setForm({ ...form, reward: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => createTask.mutate({ data: { adminTelegramId, title: form.title, description: form.description, reward: Number(form.reward), url: form.url || undefined, isActive: true } })}
              disabled={createTask.isPending || !form.title}
            >
              {createTask.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isLoading ? <Skeleton className="h-24 w-full rounded-xl" /> : (
        <div className="space-y-3">
          {tasks?.map(task => (
            <div key={task.id} className="bg-card p-3 rounded-xl border border-border flex justify-between items-center gap-2">
              <div className="min-w-0 flex-1">
                <div className="font-bold truncate">{task.title}</div>
                <div className="text-xs text-primary font-mono">ꘜ{task.reward.toFixed(4)}</div>
              </div>
              <Button
                variant="destructive"
                size="icon"
                onClick={() => deleteTask.mutate({ taskId: task.id, data: { adminTelegramId } })}
                disabled={deleteTask.isPending}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
          {!tasks?.length && <div className="text-center py-6 text-muted-foreground text-sm">No tasks created yet</div>}
        </div>
      )}
    </div>
  );
}

// ── Task Proof Submissions ────────────────────────────────────────────────────
interface TaskSubmission {
  id: number; userId: number; taskId: number; proofData: string;
  status: string; reviewNote: string | null; createdAt: string;
  user: { telegramId: string; username: string | null; firstName: string | null };
  task: { title: string; reward: number };
}

function AdminProofsTab({ adminTelegramId }: { adminTelegramId: string }) {
  const { toast } = useToast();
  const [submissions, setSubmissions] = useState<TaskSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [previewImg, setPreviewImg] = useState<string | null>(null);

  const fetchSubmissions = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/admin/task-submissions?adminTelegramId=${adminTelegramId}&status=pending`);
      const data = await res.json();
      setSubmissions(Array.isArray(data) ? data : []);
    } catch {
      toast({ title: "Error", description: "Failed to load submissions.", variant: "destructive", duration: 3000 });
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => { if (adminTelegramId) fetchSubmissions(); }, [adminTelegramId]);

  const handleApprove = async (sub: TaskSubmission) => {
    setProcessingId(sub.id);
    try {
      const res = await fetch(`/api/admin/task-submissions/${sub.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminTelegramId }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast({ title: "Approved!", description: `ꘜ${sub.task.reward.toFixed(4)} credited to user.`, duration: 3000 });
      setSubmissions(s => s.filter(x => x.id !== sub.id));
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive", duration: 3000 });
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (sub: TaskSubmission) => {
    setProcessingId(sub.id);
    try {
      const res = await fetch(`/api/admin/task-submissions/${sub.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminTelegramId, reviewNote: rejectNote }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast({ title: "Rejected", duration: 3000 });
      setSubmissions(s => s.filter(x => x.id !== sub.id));
      setRejectingId(null);
      setRejectNote("");
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive", duration: 3000 });
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <>
      <Dialog open={!!previewImg} onOpenChange={open => { if (!open) setPreviewImg(null); }}>
        <DialogContent className="max-w-[95%] rounded-2xl p-2">
          {previewImg && <img src={previewImg} alt="Proof" className="w-full rounded-xl max-h-[80vh] object-contain" />}
        </DialogContent>
      </Dialog>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-primary" />
            <h2 className="font-bold">Task Proof Submissions</h2>
          </div>
          <Button variant="outline" size="sm" onClick={fetchSubmissions} disabled={isLoading}>
            {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Refresh"}
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-3">{[1,2].map(i => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}</div>
        ) : submissions.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground border rounded-xl border-dashed">
            <ClipboardCheck className="w-8 h-8 mx-auto mb-2 opacity-20" />
            No pending submissions
          </div>
        ) : (
          <div className="space-y-4">
            {submissions.map(sub => (
              <div key={sub.id} className="bg-card rounded-xl border border-border p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-bold text-sm">{sub.task.title}</div>
                    <div className="text-xs text-primary font-mono">+ꘜ{sub.task.reward.toFixed(4)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">{sub.user.firstName || sub.user.username || "User"}</div>
                    <div className="text-xs text-muted-foreground">
                      {sub.user.username ? `@${sub.user.username}` : sub.user.telegramId}
                    </div>
                  </div>
                </div>

                <button
                  className="w-full rounded-xl overflow-hidden border bg-muted flex items-center justify-center h-36"
                  onClick={() => setPreviewImg(sub.proofData)}
                >
                  <img src={sub.proofData} alt="Proof screenshot" className="h-full w-full object-cover" />
                </button>
                <p className="text-xs text-muted-foreground text-center">Tap image to view full size</p>

                {rejectingId === sub.id && (
                  <div className="space-y-2">
                    <Input
                      placeholder="Reason for rejection (optional)"
                      value={rejectNote}
                      onChange={e => setRejectNote(e.target.value)}
                      className="bg-background"
                    />
                  </div>
                )}

                {rejectingId === sub.id ? (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => { setRejectingId(null); setRejectNote(""); }}>
                      Cancel
                    </Button>
                    <Button size="sm" variant="destructive" className="flex-1" onClick={() => handleReject(sub)} disabled={processingId === sub.id}>
                      {processingId === sub.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <><X className="w-4 h-4 mr-1" /> Confirm Reject</>}
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border-none"
                      onClick={() => handleApprove(sub)}
                      disabled={processingId === sub.id}
                    >
                      {processingId === sub.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4 mr-1" /> Approve</>}
                    </Button>
                    <Button size="sm" variant="destructive" className="flex-1" onClick={() => setRejectingId(sub.id)}>
                      <X className="w-4 h-4 mr-1" /> Reject
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ── Users ──────────────────────────────────────────────────────────────────────
interface AdminUser {
  id: number; telegramId: string; username: string | null; firstName: string | null;
  balance: number; totalEarned: number; adsWatched: number; isBanned: boolean; createdAt: string;
}

function AdminUsersTab({ adminTelegramId }: { adminTelegramId: string }) {
  const { toast } = useToast();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [contactMsg, setContactMsg] = useState("");
  const [balanceDelta, setBalanceDelta] = useState("");
  const [processing, setProcessing] = useState(false);

  const fetchUsers = async (q?: string) => {
    setIsLoading(true);
    try {
      const url = `/api/admin/users?adminTelegramId=${adminTelegramId}${q ? `&search=${encodeURIComponent(q)}` : ""}`;
      const res = await fetch(url);
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch {
      toast({ title: "Error", description: "Failed to load users.", variant: "destructive", duration: 3000 });
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => { if (adminTelegramId) fetchUsers(); }, [adminTelegramId]);

  const apiAction = async (path: string, body: object) => {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminTelegramId, ...body }),
    });
    if (!res.ok) throw new Error((await res.json()).error || "Failed");
    return res.json();
  };

  const handleBan = async (u: AdminUser) => {
    setProcessing(true);
    try {
      await apiAction(`/api/admin/users/${u.id}/${u.isBanned ? "unban" : "ban"}`, {});
      toast({ title: u.isBanned ? "User Unbanned" : "User Banned", duration: 3000 });
      setUsers(us => us.map(x => x.id === u.id ? { ...x, isBanned: !x.isBanned } : x));
      if (selectedUser?.id === u.id) setSelectedUser(prev => prev ? { ...prev, isBanned: !prev.isBanned } : null);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive", duration: 3000 });
    } finally {
      setProcessing(false);
    }
  };

  const handleBalance = async (u: AdminUser) => {
    if (!balanceDelta) return;
    setProcessing(true);
    try {
      const result = await apiAction(`/api/admin/users/${u.id}/balance`, { amount: parseFloat(balanceDelta) });
      toast({ title: "Balance Updated", description: `New balance: ꘜ${result.newBalance.toFixed(4)}`, duration: 3000 });
      setBalanceDelta("");
      setUsers(us => us.map(x => x.id === u.id ? { ...x, balance: result.newBalance } : x));
      if (selectedUser?.id === u.id) setSelectedUser(prev => prev ? { ...prev, balance: result.newBalance } : null);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive", duration: 3000 });
    } finally {
      setProcessing(false);
    }
  };

  const handleContact = async (u: AdminUser) => {
    if (!contactMsg.trim()) return;
    setProcessing(true);
    try {
      await apiAction(`/api/admin/users/${u.id}/contact`, { message: contactMsg });
      toast({ title: "Message Sent ✅", duration: 3000 });
      setContactMsg("");
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive", duration: 3000 });
    } finally {
      setProcessing(false);
    }
  };

  if (selectedUser) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setSelectedUser(null)} className="gap-1">
          <ChevronLeft className="w-4 h-4" /> Back
        </Button>

        <div className="bg-card p-4 rounded-xl border border-border">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <UserCircle className="w-7 h-7 text-primary" />
            </div>
            <div>
              <div className="font-bold">{selectedUser.firstName || selectedUser.username || "User"}</div>
              <div className="text-xs text-muted-foreground">{selectedUser.username ? `@${selectedUser.username}` : selectedUser.telegramId}</div>
            </div>
            {selectedUser.isBanned && <Badge variant="destructive" className="ml-auto">Banned</Badge>}
          </div>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-background rounded-lg p-3 text-center border">
              <div className="text-xs text-muted-foreground mb-1">Balance</div>
              <div className="font-mono font-bold text-sm">ꘜ{selectedUser.balance.toFixed(4)}</div>
            </div>
            <div className="bg-background rounded-lg p-3 text-center border">
              <div className="text-xs text-muted-foreground mb-1">Total Earned</div>
              <div className="font-mono font-bold text-sm">ꘜ{selectedUser.totalEarned.toFixed(4)}</div>
            </div>
            <div className="bg-background rounded-lg p-3 text-center border">
              <div className="text-xs text-muted-foreground mb-1">Ads</div>
              <div className="font-mono font-bold text-sm">{selectedUser.adsWatched}</div>
            </div>
          </div>
        </div>

        {/* Adjust balance */}
        <div className="bg-card p-4 rounded-xl border border-border space-y-3">
          <div className="font-semibold text-sm">Adjust Balance</div>
          <div className="flex gap-2">
            <Input placeholder="e.g. +0.01 or -0.5" value={balanceDelta} onChange={e => setBalanceDelta(e.target.value)} className="bg-background font-mono" />
            <Button onClick={() => handleBalance(selectedUser)} disabled={processing || !balanceDelta} size="sm">
              {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <DollarSign className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        {/* Send message */}
        <div className="bg-card p-4 rounded-xl border border-border space-y-3">
          <div className="font-semibold text-sm">Send Message</div>
          <Textarea placeholder="Message to send via Telegram..." value={contactMsg} onChange={e => setContactMsg(e.target.value)} className="bg-background text-sm min-h-[80px]" />
          <Button onClick={() => handleContact(selectedUser)} disabled={processing || !contactMsg.trim()} size="sm" className="w-full">
            {processing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <MessageSquare className="w-4 h-4 mr-2" />}
            Send via Telegram
          </Button>
        </div>

        {/* Ban/Unban */}
        <Button
          variant={selectedUser.isBanned ? "outline" : "destructive"}
          className="w-full"
          onClick={() => handleBan(selectedUser)}
          disabled={processing}
        >
          {selectedUser.isBanned ? <><CircleCheck className="w-4 h-4 mr-2" /> Unban User</> : <><Ban className="w-4 h-4 mr-2" /> Ban User</>}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by ID, username..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === "Enter" && fetchUsers(search)}
            className="pl-9 bg-background"
          />
        </div>
        <Button onClick={() => fetchUsers(search)} disabled={isLoading} size="sm">
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>
      ) : users.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground border rounded-xl border-dashed">No users found</div>
      ) : (
        <div className="space-y-2">
          {users.map(u => (
            <button
              key={u.id}
              className="w-full text-left bg-card p-3 rounded-xl border border-border flex items-center gap-3 hover:border-primary/30 transition-colors"
              onClick={() => setSelectedUser(u)}
            >
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <UserCircle className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">
                  {u.firstName || u.username || u.telegramId}
                  {u.isBanned && <span className="ml-2 text-xs text-destructive">(banned)</span>}
                </div>
                <div className="text-xs text-muted-foreground">ꘜ{u.balance.toFixed(4)} • {u.adsWatched} ads</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Broadcast ─────────────────────────────────────────────────────────────────
interface BroadcastJob { id: string; total: number; sent: number; failed: number; status: "running" | "done"; }

function AdminBroadcastTab({ adminTelegramId }: { adminTelegramId: string }) {
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [job, setJob] = useState<BroadcastJob | null>(null);
  const intervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const clearPoll = () => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  };

  const pollStatus = (jobId: string) => {
    intervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/admin/broadcast/${jobId}/status?adminTelegramId=${adminTelegramId}`);
        if (!res.ok) { clearPoll(); return; }
        const data: BroadcastJob = await res.json();
        setJob(data);
        if (data.status === "done") { clearPoll(); setIsSending(false); }
      } catch { clearPoll(); setIsSending(false); }
    }, 1000);
  };

  const handleSend = async () => {
    if (!message.trim() || isSending) return;
    setIsSending(true);
    setJob(null);
    try {
      const res = await fetch("/api/admin/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminTelegramId, message: message.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start broadcast");
      setJob({ id: data.jobId, total: 0, sent: 0, failed: 0, status: "running" });
      pollStatus(data.jobId);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive", duration: 3000 });
      setIsSending(false);
    }
  };

  React.useEffect(() => () => clearPoll(), []);

  const progress = job && job.total > 0 ? Math.round(((job.sent + job.failed) / job.total) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="bg-card p-4 rounded-xl border border-border space-y-3">
        <div className="flex items-center gap-2">
          <Radio className="w-5 h-5 text-primary" />
          <span className="font-semibold">Broadcast to All Users</span>
        </div>
        <Textarea
          placeholder="Write your message (Markdown supported)..."
          value={message}
          onChange={e => setMessage(e.target.value)}
          className="bg-background min-h-[120px] text-sm"
          disabled={isSending}
        />
        <Button onClick={handleSend} disabled={isSending || !message.trim()} className="w-full">
          {isSending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending...</> : <><Radio className="w-4 h-4 mr-2" /> Send to All</>}
        </Button>
      </div>

      {job && (
        <div className="bg-card p-4 rounded-xl border border-border space-y-3">
          <div className="flex justify-between items-center text-sm">
            <span className="font-semibold">{job.status === "done" ? "Broadcast Complete" : "Sending..."}</span>
            <span className="font-mono text-muted-foreground">{progress}%</span>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all duration-300", job.status === "done" ? "bg-emerald-500" : "bg-primary")}
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Total: <strong className="text-foreground">{job.total}</strong></span>
            <span className="text-emerald-500">Sent: <strong>{job.sent}</strong></span>
            <span className="text-destructive">Failed: <strong>{job.failed}</strong></span>
          </div>
          {job.status === "done" && job.failed > 0 && (
            <p className="text-xs text-muted-foreground">
              {job.failed} user{job.failed !== 1 ? "s" : ""} couldn't be reached (blocked bot or deactivated account).
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Required Channels ─────────────────────────────────────────────────────────
interface RequiredChannel { id: number; channelId: string; title: string; url: string; checkMembership: boolean; }

function AdminChannelsTab({ adminTelegramId }: { adminTelegramId: string }) {
  const { toast } = useToast();
  const [channels, setChannels] = React.useState<RequiredChannel[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isOpen, setIsOpen] = React.useState(false);
  const [form, setForm] = React.useState({ channelId: "", title: "", url: "", checkMembership: false });
  const [saving, setSaving] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<number | null>(null);
  const [togglingId, setTogglingId] = React.useState<number | null>(null);

  const fetchChannels = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/channels");
      const data = await res.json();
      setChannels(Array.isArray(data) ? data : []);
    } catch {
      toast({ title: "Error", description: "Failed to load channels.", variant: "destructive", duration: 3000 });
    } finally { setIsLoading(false); }
  };

  React.useEffect(() => { fetchChannels(); }, []);

  const handleAdd = async () => {
    if (!form.channelId.trim() || !form.title.trim() || !form.url.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminTelegramId, ...form }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const ch: RequiredChannel = await res.json();
      setChannels(prev => [...prev, ch]);
      setForm({ channelId: "", title: "", url: "", checkMembership: false });
      setIsOpen(false);
      toast({ title: "Channel added ✅", duration: 3000 });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive", duration: 3000 });
    } finally { setSaving(false); }
  };

  const handleToggleCheck = async (ch: RequiredChannel) => {
    setTogglingId(ch.id);
    try {
      const res = await fetch(`/api/admin/channels/${ch.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminTelegramId, checkMembership: !ch.checkMembership }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const updated: RequiredChannel = await res.json();
      setChannels(prev => prev.map(c => c.id === ch.id ? updated : c));
      toast({
        title: updated.checkMembership ? "Check enabled ✅" : "Check disabled",
        description: updated.checkMembership
          ? "Bot will verify membership for this channel."
          : "Users can proceed without joining this channel.",
        duration: 3000,
      });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive", duration: 3000 });
    } finally { setTogglingId(null); }
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/channels/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminTelegramId }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setChannels(prev => prev.filter(c => c.id !== id));
      toast({ title: "Channel removed", duration: 3000 });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive", duration: 3000 });
    } finally { setDeletingId(null); }
  };

  return (
    <div className="space-y-4">
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-sm text-muted-foreground space-y-1">
        <p><strong className="text-foreground">Membership Check ON</strong> — bot verifies via Telegram API. Bot must be admin in that channel/group.</p>
        <p><strong className="text-foreground">Membership Check OFF</strong> — channel link is shown but no verification. Users always pass.</p>
        <p className="text-primary font-medium">Admins always bypass all checks.</p>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button className="w-full"><Plus className="w-4 h-4 mr-2" /> Add Channel</Button>
        </DialogTrigger>
        <DialogContent className="max-w-[90%] rounded-xl sm:max-w-md">
          <DialogHeader><DialogTitle>Add Required Channel</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Channel / Group Username</Label>
              <Input
                placeholder="@yourchannel"
                value={form.channelId}
                onChange={e => setForm({ ...form, channelId: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Display Name</Label>
              <Input
                placeholder="TONStream Official"
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Invite Link</Label>
              <Input
                placeholder="https://t.me/yourchannel"
                value={form.url}
                onChange={e => setForm({ ...form, url: e.target.value })}
              />
            </div>
            <div className="flex items-center justify-between p-3 bg-background rounded-xl border">
              <div>
                <div className="font-medium text-sm">Membership Check</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {form.checkMembership ? "Bot will verify the user is a member" : "Show link only — no verification"}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setForm({ ...form, checkMembership: !form.checkMembership })}
                className={cn("transition-colors", form.checkMembership ? "text-primary" : "text-muted-foreground")}
              >
                {form.checkMembership
                  ? <ToggleRight className="w-10 h-10" />
                  : <ToggleLeft className="w-10 h-10" />}
              </button>
            </div>
            {form.checkMembership && (
              <p className="text-xs text-amber-500 bg-amber-500/10 rounded-lg px-3 py-2">
                ⚠️ Bot must be added as <strong>admin</strong> in this channel/group for the check to work.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button onClick={handleAdd} disabled={saving || !form.channelId.trim() || !form.title.trim() || !form.url.trim()}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Add Channel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="space-y-2">{[1,2].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>
      ) : channels.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground border rounded-xl border-dashed">
          <Users className="w-8 h-8 mx-auto mb-2 opacity-20" />
          <p className="text-sm">No channels added yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {channels.map(ch => (
            <div key={ch.id} className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="flex items-center gap-3 p-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-base">📢</div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm truncate">{ch.title}</div>
                  <div className="text-xs text-primary font-mono truncate">{ch.channelId}</div>
                </div>
                <Button
                  variant="destructive"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => handleDelete(ch.id)}
                  disabled={deletingId === ch.id}
                >
                  {deletingId === ch.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                </Button>
              </div>
              <div className="border-t flex items-center justify-between px-3 py-2 bg-muted/30">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "w-2 h-2 rounded-full",
                    ch.checkMembership ? "bg-emerald-500" : "bg-muted-foreground/40"
                  )} />
                  <span className="text-xs text-muted-foreground">
                    {ch.checkMembership ? "Membership check ON" : "Membership check OFF"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleCheck(ch)}
                  disabled={togglingId === ch.id}
                  className={cn(
                    "transition-colors",
                    togglingId === ch.id ? "opacity-50" : "",
                    ch.checkMembership ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  {togglingId === ch.id
                    ? <Loader2 className="w-7 h-7 animate-spin" />
                    : ch.checkMembership
                      ? <ToggleRight className="w-8 h-8" />
                      : <ToggleLeft className="w-8 h-8" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
