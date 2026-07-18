import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Stethoscope, ChevronLeft, PhoneCall, PlayCircle, CheckCircle2, XCircle, Users } from "lucide-react";

export const Route = createFileRoute("/queue")({
  head: () => ({ meta: [{ title: "Department queue — Afyacore HMIS" }] }),
  component: QueuePage,
});

const priorityRank: Record<string, number> = { emergency: 0, urgent: 1, routine: 2 };
const priorityBadge = (p: string) =>
  p === "emergency" ? "destructive" : p === "urgent" ? "default" : "secondary";

function QueuePage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const qc = useQueryClient();
  const [deptId, setDeptId] = useState<string>("");

  useEffect(() => { if (!loading && !user) navigate({ to: "/auth" }); }, [loading, user, navigate]);

  const { data: profile } = useQuery({
    queryKey: ["my-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: departments = [] } = useQuery({
    queryKey: ["departments", profile?.hospital_id],
    enabled: !!profile?.hospital_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departments")
        .select("id,name,code")
        .eq("hospital_id", profile!.hospital_id!)
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!deptId && profile?.department_id) setDeptId(profile.department_id);
    else if (!deptId && departments[0]?.id) setDeptId(departments[0].id);
  }, [profile, departments, deptId]);

  const today = new Date().toISOString().slice(0, 10);

  const { data: queue = [] } = useQuery({
    queryKey: ["department-queue", deptId, today],
    enabled: !!deptId,
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("referrals")
        .select("id, priority, reason, clinical_notes, status, queue_number, called_at, started_at, created_at, from_user_id, patient:patients(id,mrn,first_name,last_name,sex,date_of_birth,allergies,chronic_conditions,is_vip), from_department:departments!referrals_from_department_id_fkey(name)")
        .eq("to_department_id", deptId)
        .eq("queue_date", today)
        .order("created_at", { ascending: true });
      if (error) throw error;
      const rows = data ?? [];
      return [...rows].sort((a, b) => {
        const s = ["queued", "called", "in_progress", "completed", "cancelled"];
        const sa = s.indexOf(a.status), sb = s.indexOf(b.status);
        if (sa !== sb) return sa - sb;
        const pa = priorityRank[a.priority] ?? 9, pb = priorityRank[b.priority] ?? 9;
        if (pa !== pb) return pa - pb;
        return (a.queue_number ?? 0) - (b.queue_number ?? 0);
      });
    },
  });

  const advance = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "called" | "in_progress" | "completed" | "cancelled" }) => {
      const { data, error } = await supabase.rpc("advance_referral", {
        _referral_id: id,
        _to_status: status,
        _notes: "",
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, v) => {
      const label: Record<string, string> = {
        called: "Patient called",
        in_progress: "Started",
        completed: "Marked complete",
        cancelled: "Cancelled",
      };
      toast.success(label[v.status]);
      qc.invalidateQueries({ queryKey: ["department-queue"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (loading || !user) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>;

  const waiting = queue.filter((r) => r.status === "queued");
  const called = queue.filter((r) => r.status === "called");
  const inprog = queue.filter((r) => r.status === "in_progress");
  const done = queue.filter((r) => r.status === "completed" || r.status === "cancelled");

  return (
    <div className="min-h-screen bg-secondary/20">
      <header className="border-b bg-background">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Stethoscope className="h-4 w-4" />
            </div>
            <span className="font-semibold tracking-tight">Department queue</span>
          </Link>
          <Link to="/patients"><Button size="sm" variant="ghost"><ChevronLeft className="mr-1 h-4 w-4" />Patients</Button></Link>
        </div>
      </header>

      <main className="container mx-auto max-w-6xl space-y-6 px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Today's queue</h1>
            <p className="text-sm text-muted-foreground">Incoming referrals for {today}. Refreshes every 15s.</p>
          </div>
          <div className="min-w-[240px]">
            <Select value={deptId} onValueChange={setDeptId}>
              <SelectTrigger><SelectValue placeholder="Choose department" /></SelectTrigger>
              <SelectContent>
                {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          <StatCard label="Waiting" value={waiting.length} tone="secondary" />
          <StatCard label="Called" value={called.length} tone="default" />
          <StatCard label="In progress" value={inprog.length} tone="default" />
          <StatCard label="Completed" value={done.length} tone="secondary" />
        </div>

        {queue.length === 0 ? (
          <Card>
            <CardContent className="flex items-center gap-3 py-12 text-muted-foreground">
              <Users className="h-5 w-5" />
              No patients queued for this department yet today.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {queue.map((r) => {
              const patient = r.patient as { id: string; mrn: string; first_name: string; last_name: string; sex: string; date_of_birth: string | null; allergies: string[] | null; chronic_conditions: string[] | null; is_vip: boolean } | null;
              const isDone = r.status === "completed" || r.status === "cancelled";
              return (
                <Card key={r.id} className={isDone ? "opacity-60" : ""}>
                  <CardContent className="flex flex-col gap-4 py-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex flex-1 min-w-0 items-start gap-4">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-lg font-semibold text-primary">
                        #{r.queue_number ?? "—"}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link to="/patients/$id" params={{ id: patient?.id ?? "" }} className="font-medium hover:underline">
                            {patient?.first_name} {patient?.last_name}
                          </Link>
                          {patient?.is_vip && <Badge variant="secondary">VIP</Badge>}
                          <Badge variant={priorityBadge(r.priority) as never} className="capitalize">{r.priority}</Badge>
                          <Badge variant="outline" className="capitalize">{r.status.replace("_", " ")}</Badge>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          <span className="font-mono">{patient?.mrn}</span>
                          {patient?.sex && <> · <span className="capitalize">{patient.sex}</span></>}
                          {r.from_department?.name && <> · From {r.from_department.name}</>}
                        </div>
                        {r.reason && <div className="mt-2 text-sm"><b>Reason:</b> {r.reason}</div>}
                        {r.clinical_notes && (
                          <div className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">{r.clinical_notes}</div>
                        )}
                        {(patient?.allergies?.length || patient?.chronic_conditions?.length) ? (
                          <div className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                            {patient.allergies?.length ? <>⚠ Allergies: {patient.allergies.join(", ")}</> : null}
                            {patient.allergies?.length && patient.chronic_conditions?.length ? " · " : ""}
                            {patient.chronic_conditions?.length ? <>Chronic: {patient.chronic_conditions.join(", ")}</> : null}
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 md:justify-end">
                      {r.status === "queued" && (
                        <Button size="sm" onClick={() => advance.mutate({ id: r.id, status: "called" })}>
                          <PhoneCall className="mr-1 h-4 w-4" />Call patient
                        </Button>
                      )}
                      {(r.status === "queued" || r.status === "called") && (
                        <Button size="sm" variant="secondary" onClick={() => advance.mutate({ id: r.id, status: "in_progress" })}>
                          <PlayCircle className="mr-1 h-4 w-4" />Start
                        </Button>
                      )}
                      {!isDone && (
                        <Button size="sm" variant="default" onClick={() => advance.mutate({ id: r.id, status: "completed" })}>
                          <CheckCircle2 className="mr-1 h-4 w-4" />Complete
                        </Button>
                      )}
                      {!isDone && (
                        <Button size="sm" variant="ghost" onClick={() => advance.mutate({ id: r.id, status: "cancelled" })}>
                          <XCircle className="mr-1 h-4 w-4" />Cancel
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: "default" | "secondary" }) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-3xl font-semibold">{value}</span>
          <Badge variant={tone as never}>today</Badge>
        </div>
      </CardContent>
    </Card>
  );
}
