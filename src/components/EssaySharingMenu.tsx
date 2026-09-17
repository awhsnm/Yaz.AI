import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, Eye, Lock, CheckCircle2, RotateCcw, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type Visibility = "private" | "shared" | "submitted" | "returned" | "graded";

export interface SharingState {
  visibility: Visibility;
  shared_with_classroom_id: string | null;
  shared_at: string | null;
  submitted_at: string | null;
}

interface ClassroomOption {
  classroom_id: string;
  classroom_name: string;
  teacher_name: string;
}

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "";

export const visibilityBadge = (s: SharingState, teacher: string) => {
  switch (s.visibility) {
    case "shared":
      return { icon: Eye, label: `Shared with ${teacher}`, hint: "Your teacher can view and comment", cls: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300" };
    case "submitted":
      return { icon: CheckCircle2, label: `Submitted${s.submitted_at ? ` on ${fmt(s.submitted_at)}` : ""}`, hint: `Sent to ${teacher}`, cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" };
    case "returned":
      return { icon: RotateCcw, label: "Returned for revision", hint: `${teacher} left comments for you`, cls: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" };
    case "graded":
      return { icon: Award, label: "Graded", hint: `${teacher} has graded this essay`, cls: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300" };
    default:
      return { icon: Lock, label: "Private", hint: "Only you can see this", cls: "bg-muted text-muted-foreground" };
  }
};

const EssaySharingMenu = ({
  essayId,
  state,
  onChange,
  compact = false,
  lessonEssay = false,
}: {
  essayId: string;
  state: SharingState;
  onChange: (next: SharingState) => void;
  compact?: boolean;
  /** Lesson (classroom/assignment) work always stays visible to the teacher. */
  lessonEssay?: boolean;
}) => {
  const { toast } = useToast();
  const [classrooms, setClassrooms] = useState<ClassroomOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<null | { action: "share" | "submit" | "unshare"; classroomId: string | null }>(null);

  useEffect(() => {
    let active = true;
    supabase.rpc("my_classrooms").then(({ data }) => {
      if (active) setClassrooms((data ?? []) as ClassroomOption[]);
    });
    return () => { active = false; };
  }, []);

  const current = useMemo(
    () => classrooms.find((c) => c.classroom_id === state.shared_with_classroom_id) ?? classrooms[0] ?? null,
    [classrooms, state.shared_with_classroom_id]
  );
  const teacherName = current?.teacher_name ?? "your teacher";
  const badge = visibilityBadge(state, teacherName);
  const Icon = badge.icon;

  const run = useCallback(async () => {
    if (!pending) return;
    setBusy(true);
    const classroomId = pending.classroomId ?? state.shared_with_classroom_id ?? classrooms[0]?.classroom_id ?? null;
    let error: { message: string } | null = null;
    if (pending.action === "share") {
      ({ error } = await supabase.rpc("share_essay_with_teacher", { _essay_id: essayId, _classroom_id: classroomId }));
      if (!error) onChange({ ...state, visibility: "shared", shared_with_classroom_id: classroomId, shared_at: new Date().toISOString() });
    } else if (pending.action === "unshare") {
      ({ error } = await supabase.rpc("unshare_essay", { _essay_id: essayId }));
      if (!error) onChange({ ...state, visibility: "private", shared_at: null });
    } else {
      ({ error } = await supabase.rpc("submit_essay_for_grading", { _essay_id: essayId, _classroom_id: classroomId }));
      if (!error) onChange({ ...state, visibility: "submitted", shared_with_classroom_id: classroomId, submitted_at: new Date().toISOString() });
    }
    setBusy(false);
    setPending(null);
    if (error) {
      toast({
        title: "Could not update sharing",
        description: error.message.includes("classroom")
          ? "Join your teacher's classroom with the lesson code first."
          : error.message,
        variant: "destructive",
      });
    } else {
      toast({ title: pending.action === "unshare" ? "Sharing stopped" : pending.action === "share" ? "Shared with your teacher" : "Submitted for grading" });
    }
  }, [pending, essayId, state, classrooms, onChange, toast]);

  const dialogCopy = () => {
    if (pending?.action === "unshare") {
      return { title: "Stop sharing this draft?", body: `${teacherName} will no longer be able to see this draft. It becomes private again.` };
    }
    const target = pending?.classroomId
      ? classrooms.find((c) => c.classroom_id === pending.classroomId)?.teacher_name ?? teacherName
      : teacherName;
    if (pending?.action === "submit") {
      return { title: "Submit for grading?", body: `This version will be submitted to ${target} for grading. Your teacher will be able to comment and add a grade.` };
    }
    return { title: "Share with your teacher?", body: `Your teacher, ${target}, will be able to view this draft and leave comments. This is not yet a final submission.` };
  };

  const copy = dialogCopy();
  const chooser = (action: "share" | "submit") =>
    classrooms.length > 1
      ? classrooms.map((c) => (
          <DropdownMenuItem key={c.classroom_id} className="font-display" onClick={() => setPending({ action, classroomId: c.classroom_id })}>
            {action === "share" ? "Share with" : "Submit to"} {c.teacher_name} · {c.classroom_name}
          </DropdownMenuItem>
        ))
      : (
        <DropdownMenuItem className="font-display" onClick={() => setPending({ action, classroomId: classrooms[0]?.classroom_id ?? null })}>
          {action === "share" ? "Share with teacher" : "Submit for grading"}
        </DropdownMenuItem>
      );

  return (
    <>
      <div className="flex items-center gap-2">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-display font-medium ${badge.cls}`}>
          <Icon className="w-3.5 h-3.5" />
          {badge.label}
          {!compact && <span className="opacity-70">— {badge.hint}</span>}
        </span>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 font-display text-xs" disabled={busy}>
              Sharing and submission
              <ChevronDown className="w-3 h-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel className="font-display text-xs text-muted-foreground">
              You choose who sees this essay. Nothing is shared automatically.
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {classrooms.length === 0 ? (
              <DropdownMenuItem disabled className="font-display">
                Join a classroom with a lesson code first
              </DropdownMenuItem>
            ) : (
              <>
                {(state.visibility === "private" || state.visibility === "returned") && chooser("share")}
                {!lessonEssay && (state.visibility === "shared" || state.visibility === "returned") && (
                  <DropdownMenuItem className="font-display" onClick={() => setPending({ action: "unshare", classroomId: null })}>
                    Stop sharing
                  </DropdownMenuItem>
                )}
                {lessonEssay && (
                  <DropdownMenuItem disabled className="font-display text-xs">
                    Lesson work always stays visible to your teacher
                  </DropdownMenuItem>
                )}
                {state.visibility !== "submitted" && chooser("submit")}
                {state.visibility === "submitted" && (
                  <DropdownMenuItem className="font-display" onClick={() => setPending({ action: "submit", classroomId: state.shared_with_classroom_id })}>
                    Submit a new version
                  </DropdownMenuItem>
                )}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">{copy.title}</AlertDialogTitle>
            <AlertDialogDescription className="font-display">{copy.body}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-display">Cancel</AlertDialogCancel>
            <AlertDialogAction className="font-display" disabled={busy} onClick={(e) => { e.preventDefault(); run(); }}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default EssaySharingMenu;
