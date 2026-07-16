import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, PackageCheck, Trash2 } from "lucide-react";
import { Shell } from "./inventory";

export const Route = createFileRoute("/pharmacy")({
  head: () => ({ meta: [{ title: "Pharmacy — Afyacore HMIS" }] }),
  component: PharmacyPage,
});

type Prescription = {
  id: string; status: string; notes: string | null; created_at: string;
  patient_id: string; patient: { mrn: string; first_name: string; last_name: string } | null;
};
type PrescriptionItem = {
  id: string; item_id: string; dosage: string | null; frequency: string | null;
  quantity_ordered: number; quantity_dispensed: number;
  item: { name: string; unit: string; strength: string | null } | null;
};

function PharmacyPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, loading } = useAuth();
  const [tab, setTab] = useState<"pending"|"dispensed"|"all">("pending");
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => { if (!loading && !user) navigate({ to: "/auth" }); }, [loading, user, navigate]);

  const { data: profile } = useQuery({
    queryKey: ["my-profile", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle()).data,
  });
  const hospitalId = profile?.hospital_id;

  const { data: rx = [], isLoading } = useQuery<Prescription[]>({
    queryKey: ["prescriptions", hospitalId, tab],
    enabled: !!hospitalId,
    queryFn: async () => {
      let q = supabase.from("prescriptions")
        .select("id,status,notes,created_at,patient_id,patient:patients(mrn,first_name,last_name)")
        .eq("hospital_id", hospitalId!)
        .order("created_at", { ascending: false })
        .limit(100);
      if (tab === "pending") q = q.in("status", ["pending","partial"] as never);
      else if (tab === "dispensed") q = q.eq("status", "dispensed" as never);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as never;
    },
  });

  if (loading || !user) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>;

  return (
    <Shell active="pharmacy">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pharmacy</h1>
          <p className="text-sm text-muted-foreground">Prescriptions queue and dispensing.</p>
        </div>
        <NewPrescriptionDialog hospitalId={hospitalId ?? undefined} onSaved={() => qc.invalidateQueries({ queryKey: ["prescriptions"] })} />
      </div>

      <div className="mb-4 flex gap-1">
        {(["pending","dispensed","all"] as const).map((t) => (
          <Button key={t} size="sm" variant={tab === t ? "secondary" : "ghost"} onClick={() => setTab(t)} className="capitalize">{t}</Button>
        ))}
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">Created</th>
                <th className="px-4 py-2 text-left">Patient</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Notes</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>}
              {!isLoading && rx.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No prescriptions.</td></tr>}
              {rx.map((r) => (
                <tr key={r.id} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-2 text-xs">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="px-4 py-2">
                    {r.patient ? (
                      <Link to="/patients/$id" params={{ id: r.patient_id }} className="hover:underline">
                        <span className="font-mono text-xs">{r.patient.mrn}</span> · {r.patient.first_name} {r.patient.last_name}
                      </Link>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-2"><StatusBadge status={r.status} /></td>
                  <td className="px-4 py-2 text-muted-foreground line-clamp-1 max-w-xs">{r.notes ?? "—"}</td>
                  <td className="px-4 py-2 text-right">
                    <Button size="sm" variant={r.status === "dispensed" ? "ghost" : "default"} onClick={() => setOpenId(r.id)}>
                      {r.status === "dispensed" ? "View" : "Dispense"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {openId && <DispenseDialog prescriptionId={openId} onClose={() => setOpenId(null)} onDone={() => qc.invalidateQueries({ queryKey: ["prescriptions"] })} />}
    </Shell>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { v: "default"|"secondary"|"outline"|"destructive"; l: string }> = {
    pending: { v: "outline", l: "Pending" },
    partial: { v: "secondary", l: "Partial" },
    dispensed: { v: "default", l: "Dispensed" },
    cancelled: { v: "destructive", l: "Cancelled" },
  };
  const m = map[status] ?? { v: "outline" as const, l: status };
  return <Badge variant={m.v}>{m.l}</Badge>;
}

// ---------------- Dispense ----------------
function DispenseDialog({ prescriptionId, onClose, onDone }: { prescriptionId: string; onClose: () => void; onDone: () => void }) {
  const { data: items = [], isLoading } = useQuery<PrescriptionItem[]>({
    queryKey: ["rx-items", prescriptionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prescription_items")
        .select("id,item_id,dosage,frequency,quantity_ordered,quantity_dispensed,item:inventory_items(name,unit,strength)")
        .eq("prescription_id", prescriptionId);
      if (error) throw error;
      return (data ?? []) as never;
    },
  });

  const [amounts, setAmounts] = useState<Record<string, string>>({});
  useEffect(() => {
    const init: Record<string, string> = {};
    for (const it of items) init[it.id] = String(Math.max(0, Number(it.quantity_ordered) - Number(it.quantity_dispensed)));
    setAmounts(init);
  }, [items]);

  const dispense = useMutation({
    mutationFn: async () => {
      const lines = items
        .map((it) => ({ prescription_item_id: it.id, quantity: Number(amounts[it.id] || 0) }))
        .filter((l) => l.quantity > 0);
      if (lines.length === 0) throw new Error("Nothing to dispense");
      const { data, error } = await supabase.rpc("dispense_prescription", {
        _prescription_id: prescriptionId,
        _lines: lines,
      } as never);
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      const r = data as { status: string };
      toast.success(`Prescription ${r.status}`);
      onDone(); onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Dispense prescription</DialogTitle></DialogHeader>
        {isLoading ? <div className="py-6 text-center text-muted-foreground">Loading…</div> : (
          <div className="space-y-3">
            {items.map((it) => {
              const outstanding = Number(it.quantity_ordered) - Number(it.quantity_dispensed);
              return (
                <div key={it.id} className="grid grid-cols-1 gap-2 rounded-md border bg-muted/20 p-3 sm:grid-cols-[1fr_auto]">
                  <div className="text-sm">
                    <div className="font-medium">{it.item?.name}{it.item?.strength ? ` ${it.item.strength}` : ""}</div>
                    <div className="text-xs text-muted-foreground">
                      {it.dosage ? `${it.dosage} · ` : ""}{it.frequency ?? ""}
                    </div>
                    <div className="text-xs mt-1">Ordered: {it.quantity_ordered} · Dispensed: {it.quantity_dispensed} · Outstanding: <b>{outstanding}</b> {it.item?.unit}</div>
                  </div>
                  <div className="flex items-end gap-2">
                    <div>
                      <Label className="text-xs">Dispense now</Label>
                      <Input
                        type="number"
                        step="0.001"
                        max={outstanding}
                        min={0}
                        value={amounts[it.id] ?? ""}
                        onChange={(e) => setAmounts({ ...amounts, [it.id]: e.target.value })}
                        className="w-28"
                        disabled={outstanding <= 0}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Close</Button>
          <Button disabled={dispense.isPending || items.every((i) => Number(i.quantity_dispensed) >= Number(i.quantity_ordered))} onClick={() => dispense.mutate()}>
            <PackageCheck className="mr-2 h-4 w-4" />{dispense.isPending ? "Dispensing…" : "Confirm dispense"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------- New prescription ----------------
type Line = { item_id: string; dosage: string; frequency: string; quantity_ordered: string };

function NewPrescriptionDialog({ hospitalId, onSaved }: { hospitalId?: string; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [patientSearch, setPatientSearch] = useState("");
  const [patient, setPatient] = useState<{ id: string; label: string } | null>(null);
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([{ item_id: "", dosage: "", frequency: "", quantity_ordered: "" }]);
  const { user } = useAuth();

  const { data: patients = [] } = useQuery({
    queryKey: ["patient-picker", hospitalId, patientSearch],
    enabled: !!hospitalId && patientSearch.length >= 2 && !patient,
    queryFn: async () => {
      const { data, error } = await supabase.from("patients")
        .select("id,mrn,first_name,last_name,phone")
        .eq("hospital_id", hospitalId!)
        .is("merged_into", null)
        .or(`first_name.ilike.%${patientSearch}%,last_name.ilike.%${patientSearch}%,mrn.ilike.%${patientSearch}%,phone.ilike.%${patientSearch}%`)
        .limit(8);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: items = [] } = useQuery({
    queryKey: ["rx-items-picker", hospitalId],
    enabled: !!hospitalId && open,
    queryFn: async () => {
      const { data, error } = await supabase.from("inventory_items")
        .select("id,name,strength,unit,category").eq("hospital_id", hospitalId!)
        .eq("active", true).eq("category", "medication" as never).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!hospitalId || !patient) throw new Error("Pick a patient");
      const validLines = lines.filter((l) => l.item_id && Number(l.quantity_ordered) > 0);
      if (validLines.length === 0) throw new Error("Add at least one medication line");

      const { data: rx, error } = await supabase.from("prescriptions").insert({
        hospital_id: hospitalId,
        patient_id: patient.id,
        prescribed_by: user?.id ?? null,
        notes: notes.trim() || null,
      } as never).select().single();
      if (error) throw error;
      const r = rx as { id: string };

      const { error: liErr } = await supabase.from("prescription_items").insert(
        validLines.map((l) => ({
          prescription_id: r.id,
          item_id: l.item_id,
          dosage: l.dosage.trim() || null,
          frequency: l.frequency.trim() || null,
          quantity_ordered: Number(l.quantity_ordered),
        })) as never,
      );
      if (liErr) throw liErr;
    },
    onSuccess: () => {
      toast.success("Prescription created");
      setOpen(false);
      setPatient(null); setPatientSearch(""); setNotes("");
      setLines([{ item_id: "", dosage: "", frequency: "", quantity_ordered: "" }]);
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />New prescription</Button></DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>New prescription</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Patient</Label>
            {patient ? (
              <div className="flex items-center justify-between rounded-md border bg-muted/30 p-2 text-sm">
                <span>{patient.label}</span>
                <Button size="sm" variant="ghost" onClick={() => setPatient(null)}>Change</Button>
              </div>
            ) : (
              <>
                <Input value={patientSearch} onChange={(e) => setPatientSearch(e.target.value)} placeholder="Search by name, MRN, phone…" />
                {patientSearch.length >= 2 && patients.length > 0 && (
                  <div className="mt-1 rounded-md border bg-background text-sm">
                    {patients.map((raw) => {
                      const p = raw as { id: string; mrn: string; first_name: string; last_name: string; phone: string|null };
                      return (
                        <button key={p.id} type="button"
                          className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-muted/50"
                          onClick={() => { setPatient({ id: p.id, label: `${p.mrn} · ${p.first_name} ${p.last_name}${p.phone ? " · " + p.phone : ""}` }); setPatientSearch(""); }}>
                          <span className="font-mono text-xs">{p.mrn}</span>
                          <span className="flex-1 px-2">{p.first_name} {p.last_name}</span>
                          <span className="text-xs text-muted-foreground">{p.phone ?? ""}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label>Medications</Label>
              <Button size="sm" variant="outline" onClick={() => setLines([...lines, { item_id: "", dosage: "", frequency: "", quantity_ordered: "" }])}>
                <Plus className="mr-1 h-3 w-3" />Add line
              </Button>
            </div>
            <div className="space-y-2">
              {lines.map((l, idx) => (
                <div key={idx} className="grid grid-cols-1 gap-2 rounded-md border p-2 sm:grid-cols-[2fr_1fr_1fr_auto_auto]">
                  <Select value={l.item_id} onValueChange={(v) => {
                    const c = [...lines]; c[idx] = { ...c[idx], item_id: v }; setLines(c);
                  }}>
                    <SelectTrigger><SelectValue placeholder="Select medication" /></SelectTrigger>
                    <SelectContent>
                      {items.map((raw) => {
                        const it = raw as { id: string; name: string; strength: string|null; unit: string };
                        return <SelectItem key={it.id} value={it.id}>{it.name}{it.strength ? ` ${it.strength}` : ""}</SelectItem>;
                      })}
                    </SelectContent>
                  </Select>
                  <Input placeholder="Dosage" value={l.dosage} onChange={(e) => { const c=[...lines]; c[idx]={...c[idx],dosage:e.target.value}; setLines(c); }} />
                  <Input placeholder="Frequency (e.g. BD ×7)" value={l.frequency} onChange={(e) => { const c=[...lines]; c[idx]={...c[idx],frequency:e.target.value}; setLines(c); }} />
                  <Input type="number" placeholder="Qty" className="w-20" value={l.quantity_ordered} onChange={(e) => { const c=[...lines]; c[idx]={...c[idx],quantity_ordered:e.target.value}; setLines(c); }} />
                  <Button size="icon" variant="ghost" onClick={() => setLines(lines.filter((_, i) => i !== idx))} disabled={lines.length === 1}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <Label>Notes</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Clinical notes / instructions" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={!patient || create.isPending} onClick={() => create.mutate()}>{create.isPending ? "Saving…" : "Create prescription"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
