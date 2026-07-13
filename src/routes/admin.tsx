import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Building2, LogOut, Plus, Puzzle, Stethoscope } from "lucide-react";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Platform Console — Afyacore HMIS" }] }),
  component: AdminConsole,
});

function AdminConsole() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [selectedHospital, setSelectedHospital] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  if (loading || !user) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-secondary/20">
      <header className="border-b bg-background">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Stethoscope className="h-4 w-4" />
            </div>
            <span className="font-semibold tracking-tight">Afyacore Console</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{user.email}</span>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                await supabase.auth.signOut();
                navigate({ to: "/" });
              }}
            >
              <LogOut className="mr-1 h-4 w-4" /> Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto grid gap-6 px-4 py-8 lg:grid-cols-[380px_1fr]">
        <HospitalsPanel selected={selectedHospital} onSelect={setSelectedHospital} />
        {selectedHospital ? (
          <ModulesPanel hospitalId={selectedHospital} />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Select a hospital</CardTitle>
              <CardDescription>
                Choose a hospital on the left to install and manage its modules.
              </CardDescription>
            </CardHeader>
          </Card>
        )}
      </main>
    </div>
  );
}

// ---------- Hospitals list + create ----------
function HospitalsPanel({
  selected,
  onSelect,
}: {
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", code: "", facility_level: "clinic", country: "KE" });

  const { data: hospitals = [], isLoading } = useQuery({
    queryKey: ["hospitals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hospitals")
        .select("id,name,code,facility_level,country,status")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const createMut = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from("hospitals").insert({
        name: form.name,
        code: form.code.toUpperCase(),
        facility_level: form.facility_level as never,
        country: form.country,
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (row) => {
      toast.success("Hospital registered");
      qc.invalidateQueries({ queryKey: ["hospitals"] });
      setOpen(false);
      setForm({ name: "", code: "", facility_level: "clinic", country: "KE" });
      onSelect(row.id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-4 w-4" /> Hospitals
          </CardTitle>
          <CardDescription>Registered tenants</CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="mr-1 h-4 w-4" /> New</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Register hospital</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Facility name</Label>
                <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <Label>Hospital code</Label>
                <Input placeholder="NRB001" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} />
              </div>
              <div>
                <Label>Facility level</Label>
                <Select value={form.facility_level} onValueChange={(v) => setForm((f) => ({ ...f, facility_level: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dispensary">Dispensary</SelectItem>
                    <SelectItem value="clinic">Clinic</SelectItem>
                    <SelectItem value="health_centre">Health Centre</SelectItem>
                    <SelectItem value="sub_county_hospital">Sub-county Hospital</SelectItem>
                    <SelectItem value="county_hospital">County Hospital</SelectItem>
                    <SelectItem value="referral_hospital">Referral Hospital</SelectItem>
                    <SelectItem value="private_hospital">Private Hospital</SelectItem>
                    <SelectItem value="diagnostic_centre">Diagnostic Centre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Country</Label>
                <Input value={form.country} onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))} />
              </div>
            </div>
            <DialogFooter>
              <Button disabled={!form.name || !form.code || createMut.isPending} onClick={() => createMut.mutate()}>
                Register
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && hospitals.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No hospitals yet. Note: only super-admins can register hospitals — grant your account the
            <code className="mx-1 rounded bg-muted px-1">super_admin</code> role first.
          </p>
        )}
        {hospitals.map((h) => (
          <button
            key={h.id}
            onClick={() => onSelect(h.id)}
            className={`flex w-full items-center justify-between rounded-md border p-3 text-left transition hover:bg-accent ${
              selected === h.id ? "border-primary bg-accent" : ""
            }`}
          >
            <div>
              <div className="font-medium">{h.name}</div>
              <div className="text-xs text-muted-foreground">
                {h.code} · {h.facility_level} · {h.country}
              </div>
            </div>
            <Badge variant="secondary">{h.status}</Badge>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}

// ---------- Modules per hospital ----------
function ModulesPanel({ hospitalId }: { hospitalId: string }) {
  const qc = useQueryClient();

  const { data: modules = [] } = useQuery({
    queryKey: ["modules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("modules")
        .select("id,code,name,category,description,is_core,min_plan,sort_order")
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: installed = [] } = useQuery({
    queryKey: ["hospital_modules", hospitalId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hospital_modules")
        .select("id,module_id,enabled")
        .eq("hospital_id", hospitalId);
      if (error) throw error;
      return data ?? [];
    },
  });

  const installedMap = new Map(installed.map((r) => [r.module_id, r]));

  const toggleMut = useMutation({
    mutationFn: async ({ moduleId, enabled }: { moduleId: string; enabled: boolean }) => {
      const existing = installedMap.get(moduleId);
      if (existing) {
        if (!enabled) {
          const { error } = await supabase.from("hospital_modules").delete().eq("id", existing.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("hospital_modules")
            .update({ enabled: true })
            .eq("id", existing.id);
          if (error) throw error;
        }
      } else if (enabled) {
        const { error } = await supabase
          .from("hospital_modules")
          .insert({ hospital_id: hospitalId, module_id: moduleId, enabled: true });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hospital_modules", hospitalId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const byCategory = modules.reduce<Record<string, typeof modules>>((acc, m) => {
    (acc[m.category] ||= []).push(m);
    return acc;
  }, {});

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Puzzle className="h-4 w-4" /> Installed modules
        </CardTitle>
        <CardDescription>
          Enable only the modules this facility offers — the mobile and desktop apps
          adapt their menus automatically.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {Object.entries(byCategory).map(([cat, list]) => (
          <div key={cat}>
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {cat.replace("_", " ")}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {list.map((m) => {
                const inst = installedMap.get(m.id);
                const on = !!inst?.enabled;
                return (
                  <div key={m.id} className="flex items-start justify-between rounded-md border bg-background p-3">
                    <div className="pr-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{m.name}</span>
                        {m.is_core && <Badge variant="secondary">core</Badge>}
                        <Badge variant="outline" className="text-[10px]">{m.min_plan}</Badge>
                      </div>
                      {m.description && (
                        <p className="mt-1 text-xs text-muted-foreground">{m.description}</p>
                      )}
                    </div>
                    <Switch
                      checked={on || m.is_core}
                      disabled={m.is_core}
                      onCheckedChange={(v) => toggleMut.mutate({ moduleId: m.id, enabled: v })}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
