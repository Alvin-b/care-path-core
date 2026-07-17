import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ChevronLeft, Plus, RefreshCw, Send, Stethoscope, Trash2 } from "lucide-react";
import {
  shaCreateClaim,
  shaGetClaimStatus,
  shaSubmitClaim,
} from "@/lib/sha.functions";

export const Route = createFileRoute("/sha")({
  head: () => ({ meta: [{ title: "SHA claims — Afyacore HMIS" }] }),
  component: ShaPage,
});

type ItemDraft = { code: string; display: string; quantity: number; unitPrice: number };
type DxDraft = { code: string; display: string };

function ShaPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => { if (!loading && !user) navigate({ to: "/auth" }); }, [loading, user, navigate]);

  const { data: profile } = useQuery({
    queryKey: ["my-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("hospital_id").eq("id", user!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (loading || !user) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  if (!profile?.hospital_id) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card className="max-w-md"><CardHeader><CardTitle>No hospital</CardTitle><CardDescription>Your account isn't linked to a hospital.</CardDescription></CardHeader></Card>
      </div>
    );
  }
  return <ShaInner hospitalId={profile.hospital_id} />;
}

function ShaInner({ hospitalId }: { hospitalId: string }) {
  const qc = useQueryClient();
  const submit = useServerFn(shaSubmitClaim);
  const status = useServerFn(shaGetClaimStatus);

  const { data: claims = [], isLoading } = useQuery({
    queryKey: ["sha-claims", hospitalId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sha_claims")
        .select("id, state, claim_type, subtype, total_amount, currency, created_at, submitted_at, sha_number, cr_id, patients:patient_id(first_name,middle_name,last_name,mrn)")
        .eq("hospital_id", hospitalId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const submitMut = useMutation({
    mutationFn: async (claimId: string) => submit({ data: { hospitalId, claimId } }),
    onSuccess: () => { toast.success("Claim submitted"); qc.invalidateQueries({ queryKey: ["sha-claims", hospitalId] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const statusMut = useMutation({
    mutationFn: async (claimId: string) => status({ data: { hospitalId, claimId } }),
    onSuccess: () => { toast.success("Status refreshed"); qc.invalidateQueries({ queryKey: ["sha-claims", hospitalId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const stateBadge = (s: string) => {
    const variant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      draft: "outline", submitted: "secondary", queued: "secondary",
      "in-review": "secondary", "clinical-review": "secondary",
      approved: "default", "sent-for-payment-processing": "default",
      "payment-completed": "default",
      rejected: "destructive", "payment-declined": "destructive", error: "destructive",
    };
    return <Badge variant={variant[s] ?? "outline"}>{s}</Badge>;
  };

  return (
    <div className="min-h-screen bg-secondary/20">
      <header className="border-b bg-background">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Stethoscope className="h-4 w-4" />
            </div>
            <span className="font-semibold tracking-tight">SHA claims</span>
          </Link>
          <Link to="/"><Button size="sm" variant="ghost"><ChevronLeft className="mr-1 h-4 w-4" />Home</Button></Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="claims">
          <TabsList className="mb-6">
            <TabsTrigger value="claims">Claims</TabsTrigger>
            <TabsTrigger value="new">New claim</TabsTrigger>
          </TabsList>

          <TabsContent value="claims">
            <Card>
              <CardHeader>
                <CardTitle>Claims</CardTitle>
                <CardDescription>Drafts, dispatched claims, and adjudication status from SHA.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
                {!isLoading && claims.length === 0 && (
                  <p className="text-sm text-muted-foreground">No claims yet. Create one from the "New claim" tab.</p>
                )}
                {claims.map((c) => {
                  const p = c.patients as { first_name: string | null; middle_name: string | null; last_name: string | null; mrn: string } | null;
                  const name = p ? [p.first_name, p.middle_name, p.last_name].filter(Boolean).join(" ") : "—";
                  return (
                    <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-background p-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{name}</span>
                          <span className="text-xs font-mono text-muted-foreground">{p?.mrn}</span>
                          <Badge variant="outline" className="uppercase">{c.claim_type}</Badge>
                          <Badge variant="outline" className="uppercase">{c.subtype}</Badge>
                          {stateBadge(c.state)}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {c.currency} {Number(c.total_amount).toFixed(2)} · created {new Date(c.created_at).toLocaleString()}
                          {c.submitted_at ? ` · submitted ${new Date(c.submitted_at).toLocaleString()}` : ""}
                          {c.cr_id ? ` · CR ${c.cr_id}` : ""}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {(c.state === "draft" || c.state === "error" || c.state === "rejected") && (
                          <Button size="sm" onClick={() => submitMut.mutate(c.id)} disabled={submitMut.isPending}>
                            <Send className="mr-1 h-3.5 w-3.5" /> Submit
                          </Button>
                        )}
                        {c.state !== "draft" && (
                          <Button size="sm" variant="outline" onClick={() => statusMut.mutate(c.id)} disabled={statusMut.isPending}>
                            <RefreshCw className="mr-1 h-3.5 w-3.5" /> Refresh
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="new">
            <NewClaim hospitalId={hospitalId} onCreated={() => qc.invalidateQueries({ queryKey: ["sha-claims", hospitalId] })} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function NewClaim({ hospitalId, onCreated }: { hospitalId: string; onCreated: () => void }) {
  const create = useServerFn(shaCreateClaim);
  const [patientId, setPatientId] = useState<string>("");
  const [patientSearch, setPatientSearch] = useState("");
  const [claimType, setClaimType] = useState<"claim" | "preauth">("claim");
  const [subtype, setSubtype] = useState<"op" | "ip" | "emg">("op");
  const [practitionerPuid, setPractitionerPuid] = useState("");
  const [practitionerName, setPractitionerName] = useState("");
  const today = new Date().toISOString().slice(0, 10);
  const [billableStart, setBillableStart] = useState(today);
  const [billableEnd, setBillableEnd] = useState(today);
  const [diagnoses, setDiagnoses] = useState<DxDraft[]>([{ code: "", display: "" }]);
  const [items, setItems] = useState<ItemDraft[]>([{ code: "", display: "", quantity: 1, unitPrice: 0 }]);

  const { data: patients = [] } = useQuery({
    queryKey: ["sha-new-patient-search", hospitalId, patientSearch],
    queryFn: async () => {
      if (patientSearch.trim().length < 2) return [];
      const q = `%${patientSearch.trim()}%`;
      const { data, error } = await supabase
        .from("patients")
        .select("id,mrn,first_name,middle_name,last_name,sha_number,sha_cr_id")
        .eq("hospital_id", hospitalId)
        .is("merged_into", null)
        .or(`first_name.ilike.${q},last_name.ilike.${q},mrn.ilike.${q},phone.ilike.${q},sha_number.ilike.${q}`)
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
  });

  const selected = patients.find((p) => p.id === patientId);
  const total = items.reduce((a, it) => a + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0), 0);

  const mut = useMutation({
    mutationFn: async () =>
      create({
        data: {
          hospitalId,
          patientId,
          claimType,
          subtype,
          practitioner_puid: practitionerPuid || null,
          practitioner_name: practitionerName || null,
          billable_start: billableStart,
          billable_end: billableEnd,
          diagnoses: diagnoses.filter((d) => d.code && d.display),
          items: items
            .filter((i) => i.code && i.quantity > 0 && i.unitPrice >= 0)
            .map((i) => ({
              code: i.code,
              display: i.display || i.code,
              quantity: Number(i.quantity),
              unitPrice: Number(i.unitPrice),
            })),
          currency: "KES",
        },
      }),
    onSuccess: () => {
      toast.success("Claim draft created");
      setPatientId(""); setPatientSearch(""); setDiagnoses([{ code: "", display: "" }]);
      setItems([{ code: "", display: "", quantity: 1, unitPrice: 0 }]);
      onCreated();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canSubmit =
    !!patientId &&
    diagnoses.some((d) => d.code && d.display) &&
    items.some((i) => i.code && i.quantity > 0);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <Card>
        <CardHeader>
          <CardTitle>New claim draft</CardTitle>
          <CardDescription>
            Build a claim locally; submit to SHA from the claims list. The patient must have a SHA CR ID
            cached from an eligibility check first.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Patient</Label>
            <Input placeholder="Search name, MRN, SHA #, phone…" value={patientSearch} onChange={(e) => setPatientSearch(e.target.value)} />
            {patientSearch.length >= 2 && (
              <div className="mt-2 space-y-1 rounded-md border bg-background p-2">
                {patients.length === 0 && <p className="p-2 text-xs text-muted-foreground">No matches.</p>}
                {patients.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`w-full rounded px-2 py-1.5 text-left text-sm hover:bg-secondary ${patientId === p.id ? "bg-secondary" : ""}`}
                    onClick={() => setPatientId(p.id)}
                  >
                    <span className="font-medium">{[p.first_name, p.middle_name, p.last_name].filter(Boolean).join(" ")}</span>
                    <span className="ml-2 text-xs font-mono text-muted-foreground">{p.mrn}</span>
                    {p.sha_cr_id ? <Badge variant="outline" className="ml-2 text-[10px]">CR {p.sha_cr_id}</Badge> : <Badge variant="destructive" className="ml-2 text-[10px]">no CR</Badge>}
                  </button>
                ))}
              </div>
            )}
            {selected && (
              <p className="mt-2 text-xs text-muted-foreground">
                Selected: {[selected.first_name, selected.last_name].filter(Boolean).join(" ")} · CR {selected.sha_cr_id ?? "—"} · SHA {selected.sha_number ?? "—"}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Claim type</Label>
              <Select value={claimType} onValueChange={(v) => setClaimType(v as "claim" | "preauth")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="claim">Claim</SelectItem>
                  <SelectItem value="preauth">Pre-authorization</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Sub-type</Label>
              <Select value={subtype} onValueChange={(v) => setSubtype(v as "op" | "ip" | "emg")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="op">Outpatient</SelectItem>
                  <SelectItem value="ip">Inpatient</SelectItem>
                  <SelectItem value="emg">Emergency</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Billable start</Label><Input type="date" value={billableStart} onChange={(e) => setBillableStart(e.target.value)} /></div>
            <div><Label>Billable end</Label><Input type="date" value={billableEnd} onChange={(e) => setBillableEnd(e.target.value)} /></div>
            <div><Label>Practitioner PUID</Label><Input value={practitionerPuid} onChange={(e) => setPractitionerPuid(e.target.value)} placeholder="PUID-…" /></div>
            <div><Label>Practitioner name</Label><Input value={practitionerName} onChange={(e) => setPractitionerName(e.target.value)} /></div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label>Diagnoses (ICD-11)</Label>
              <Button size="sm" variant="ghost" onClick={() => setDiagnoses([...diagnoses, { code: "", display: "" }])}><Plus className="mr-1 h-3.5 w-3.5" />Add</Button>
            </div>
            {diagnoses.map((d, i) => (
              <div key={i} className="mb-2 grid grid-cols-[110px_1fr_auto] gap-2">
                <Input placeholder="Code (e.g. GB61)" value={d.code} onChange={(e) => update(setDiagnoses, diagnoses, i, { code: e.target.value })} />
                <Input placeholder="Display (e.g. Chronic kidney disease)" value={d.display} onChange={(e) => update(setDiagnoses, diagnoses, i, { display: e.target.value })} />
                <Button size="icon" variant="ghost" onClick={() => setDiagnoses(diagnoses.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label>Service items (SHA intervention codes)</Label>
              <Button size="sm" variant="ghost" onClick={() => setItems([...items, { code: "", display: "", quantity: 1, unitPrice: 0 }])}><Plus className="mr-1 h-3.5 w-3.5" />Add</Button>
            </div>
            {items.map((it, i) => (
              <div key={i} className="mb-2 grid grid-cols-[130px_1fr_90px_130px_auto] gap-2">
                <Input placeholder="SHA-02-005" value={it.code} onChange={(e) => update(setItems, items, i, { code: e.target.value })} />
                <Input placeholder="Display" value={it.display} onChange={(e) => update(setItems, items, i, { display: e.target.value })} />
                <Input type="number" min={1} step={1} value={it.quantity} onChange={(e) => update(setItems, items, i, { quantity: Number(e.target.value) })} />
                <Input type="number" min={0} step="0.01" value={it.unitPrice} onChange={(e) => update(setItems, items, i, { unitPrice: Number(e.target.value) })} />
                <Button size="icon" variant="ghost" onClick={() => setItems(items.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            <div className="mt-2 text-right text-sm">Total: <b>KES {total.toFixed(2)}</b></div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Summary</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="text-muted-foreground">Patient: <span className="text-foreground">{selected ? [selected.first_name, selected.last_name].filter(Boolean).join(" ") : "—"}</span></div>
          <div className="text-muted-foreground">CR ID: <span className="text-foreground">{selected?.sha_cr_id ?? "—"}</span></div>
          <div className="text-muted-foreground">Diagnoses: <span className="text-foreground">{diagnoses.filter((d) => d.code && d.display).length}</span></div>
          <div className="text-muted-foreground">Items: <span className="text-foreground">{items.filter((i) => i.code && i.quantity > 0).length}</span></div>
          <div className="text-muted-foreground">Total: <span className="text-foreground font-semibold">KES {total.toFixed(2)}</span></div>
          <Button className="w-full" disabled={!canSubmit || mut.isPending} onClick={() => mut.mutate()}>
            {mut.isPending ? "Creating…" : "Save as draft"}
          </Button>
          <p className="text-xs text-muted-foreground">Drafts stay local until you press "Submit" on the claims list. SHA callbacks (queued, approved, payment-completed, …) update the status automatically.</p>
        </CardContent>
      </Card>
    </div>
  );
}

function update<T>(setter: (v: T[]) => void, arr: T[], i: number, patch: Partial<T>) {
  setter(arr.map((v, j) => (j === i ? { ...v, ...patch } : v)));
}
