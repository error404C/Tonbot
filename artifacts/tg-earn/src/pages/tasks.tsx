import React, { useRef, useState } from "react";
import { useTelegram } from "@/lib/telegram";
import {
  useGetTasks, getGetTasksQueryKey,
  useGetSettings,
  getGetMyStatsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle, ExternalLink, ListTodo, Loader2,
  Clock, XCircle, Upload, ImageIcon, Plus, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Task = {
  id: number; title: string; description: string; reward: number;
  url?: string | null; isActive: boolean; completed: boolean;
  submissionStatus: "none" | "pending" | "approved" | "rejected";
  createdAt: string;
};

function statusBadge(status: Task["submissionStatus"], completed: boolean) {
  if (completed || status === "approved") {
    return (
      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 h-8 px-3 text-xs gap-1.5">
        <CheckCircle className="w-3.5 h-3.5" /> Completed
      </Badge>
    );
  }
  if (status === "pending") {
    return (
      <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20 h-8 px-3 text-xs gap-1.5">
        <Clock className="w-3.5 h-3.5" /> Under Review
      </Badge>
    );
  }
  if (status === "rejected") {
    return null; // show re-submit button instead
  }
  return null;
}

export default function Tasks() {
  const { user } = useTelegram();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [proofTask, setProofTask] = useState<Task | null>(null);
  const [proofImg, setProofImg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: tasks, isLoading } = useGetTasks(
    { telegramId: user?.id || "" },
    { query: { enabled: !!user?.id, queryKey: getGetTasksQueryKey({ telegramId: user?.id || "" }) } }
  );

  const { data: settings } = useGetSettings();

  const openProofDialog = (task: Task) => {
    setProofTask(task);
    setProofImg(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Please upload an image under 5 MB.", variant: "destructive", duration: 3000 });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setProofImg(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmitProof = async () => {
    if (!proofTask || !proofImg || !user?.id) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/tasks/${proofTask.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telegramId: user.id, proofData: proofImg }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit proof");

      toast({
        title: "Proof Submitted!",
        description: "Your submission is under review. You'll be notified once it's approved.",
        duration: 3000,
      });
      setProofTask(null);
      setProofImg(null);
      queryClient.invalidateQueries({ queryKey: getGetTasksQueryKey({ telegramId: user.id }) });
      queryClient.invalidateQueries({ queryKey: getGetMyStatsQueryKey({ telegramId: user.id }) });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive", duration: 3000 });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full p-6 pt-12">
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-foreground mb-1 flex items-center gap-2">
          Tasks <ListTodo className="w-6 h-6 text-primary" />
        </h1>
        <p className="text-muted-foreground text-sm">Complete tasks, upload proof, and get paid.</p>
      </header>

      <div className="flex-1 pb-6 space-y-4">
        {isLoading ? (
          [1, 2, 3].map((i) => (
            <div key={i} className="bg-card p-4 rounded-xl border border-border">
              <Skeleton className="h-6 w-3/4 mb-2" />
              <Skeleton className="h-4 w-full mb-4" />
              <div className="flex justify-between items-center">
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-10 w-24" />
              </div>
            </div>
          ))
        ) : tasks?.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground bg-card/50 rounded-xl border border-border/50">
            <ListTodo className="w-8 h-8 mx-auto mb-3 opacity-20" />
            <p>No active tasks right now.</p>
            <p className="text-sm mt-1">Check back soon!</p>
          </div>
        ) : (
          (tasks as Task[])?.map((task) => {
            const isDone = task.completed || task.submissionStatus === "approved";
            const isPending = task.submissionStatus === "pending";
            const isRejected = task.submissionStatus === "rejected";

            return (
              <div
                key={task.id}
                className={cn(
                  "bg-card p-4 rounded-xl border transition-colors flex flex-col gap-3",
                  isDone ? "border-emerald-500/20" : isPending ? "border-amber-500/20" : "border-card-border hover:border-primary/30"
                )}
              >
                <div>
                  <h3 className="font-bold text-base leading-tight">{task.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
                </div>

                {isRejected && (
                  <div className="flex items-center gap-1.5 text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
                    <XCircle className="w-3.5 h-3.5 shrink-0" />
                    Proof rejected — please resubmit with a clearer screenshot.
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="font-mono font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-md text-sm">
                    +ꘜ{task.reward.toFixed(4)}
                  </div>

                  <div className="flex gap-2 items-center">
                    {task.url && !isDone && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={task.url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-4 h-4 mr-1" /> Open
                        </a>
                      </Button>
                    )}

                    {isDone ? (
                      statusBadge(task.submissionStatus, task.completed)
                    ) : isPending ? (
                      statusBadge("pending", false)
                    ) : (
                      <Button
                        size="sm"
                        className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold gap-1.5"
                        onClick={() => openProofDialog(task)}
                      >
                        <Upload className="w-4 h-4" />
                        {isRejected ? "Re-submit" : "Done"}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Add Task / Promote CTA */}
        {settings?.addTaskUrl && (
          <a
            href={settings.addTaskUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 flex items-center gap-4 bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-2xl p-4 hover:border-primary/40 transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
              <Plus className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm">Add a Task or Promote Your Link</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Want to reach thousands of users? List your task here!
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
          </a>
        )}
      </div>

      {/* Proof Upload Dialog */}
      <Dialog open={!!proofTask} onOpenChange={(open) => { if (!open) { setProofTask(null); setProofImg(null); } }}>
        <DialogContent className="max-w-[90%] rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Proof</DialogTitle>
            <DialogDescription>
              Take a screenshot showing you completed <strong>{proofTask?.title}</strong> and upload it below.
              Your submission will be reviewed before the reward is credited.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={handleFileChange}
            />

            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className={cn(
                "w-full h-40 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-3 transition-colors",
                proofImg ? "border-primary/40 bg-primary/5" : "border-border hover:border-primary/40 bg-muted/30"
              )}
            >
              {proofImg ? (
                <img src={proofImg} alt="Proof preview" className="h-full w-full object-contain rounded-xl p-1" />
              ) : (
                <>
                  <ImageIcon className="w-10 h-10 text-muted-foreground/40" />
                  <div className="text-sm text-muted-foreground text-center">
                    <span className="font-medium text-foreground">Tap to choose image</span>
                    <br />
                    Screenshot from your phone or gallery
                  </div>
                </>
              )}
            </button>

            {proofImg && (
              <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={() => fileRef.current?.click()}>
                Change Image
              </Button>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setProofTask(null); setProofImg(null); }} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmitProof}
              disabled={!proofImg || isSubmitting}
              className="bg-primary text-primary-foreground font-bold"
            >
              {isSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting...</> : "Submit Proof"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
