import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Building2, LogOut, Stethoscope, Users, Palette, Settings2, GitBranch, Puzzle, Trash2, Copy, ShieldCheck } from "lucide-react";
import { ShaSettingsTab } from "@/components/sha-settings-tab";

export const Route = createFileRoute("/hospital")({
  head: () => ({ meta: [{ title: "Hospital admin — Afyacore HMIS" }] }),
  component: HospitalAdmin,
});

const ROLES = [
  "hospital_admin","doctor","nurse","triage_nurse","receptionist","pharmacist",
  "lab_tech","radiographer","accountant","cashier","storekeeper","hr","manager",
] as const;

function HospitalAdmin() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  // Load current user's profile to find their hospital
  const { data: profile, isLoading: profLoading } = useQuery({
    queryKey: ["my-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: hospital } = useQuery({
    queryKey: ["my-hospital", profile?.hospital_id],
    enabled: !!profile?.hospital_id,
    queryFn: async () => {
      const { data, error } = await supabase.from("hospitals").select("*").eq("id", profile!.hospital_id!).single();
      if (error) throw error;
      return data;
    },
  });

  if (loading || profLoading || !user) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  }

  if (!profile?.hospital_id || !hospital) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>No hospital assigned</CardTitle>
            <CardDescription>
              Your account isn't linked to a hospital yet. Ask your platform administrator to onboard your
              facility, or if you're a super-admin visit the platform console.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Link to="/admin"><Button variant="outline">Platform console</Button></Link>
            <Link to="/onboarding"><Button>Onboard a hospital</Button></Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary/20">
      <header className="border-b bg-background">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Stethoscope className="h-4 w-4" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold tracking-tight">{hospital.name}</div>
              <div className="text-[11px] text-muted-foreground">Hospital admin · {hospital.code}</div>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{user.email}</span>
            <Button size="sm" variant="outline" onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/" }); }}>
              <LogOut className="mr-1 h-4 w-4" /> Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="modules">
          <TabsList className="mb-6 flex-wrap">
            <TabsTrigger value="modules"><Puzzle className="mr-1 h-4 w-4" /> Modules</TabsTrigger>
            <TabsTrigger value="branches"><GitBranch className="mr-1 h-4 w-4" /> Branches</TabsTrigger>
            <TabsTrigger value="staff"><Users className="mr-1 h-4 w-4" /> Staff & invites</TabsTrigger>
            <TabsTrigger value="branding"><Palette className="mr-1 h-4 w-4" /> Branding</TabsTrigger>
            <TabsTrigger value="settings"><Settings2 className="mr-1 h-4 w-4" /> Settings</TabsTrigger>
            <TabsTrigger value="sha"><ShieldCheck className="mr-1 h-4 w-4" /> SHA</TabsTrigger>
          </TabsList>
          <TabsContent value="modules"><ModulesTab hospitalId={hospital.id} /></TabsContent>
          <TabsContent value="branches"><BranchesTab hospitalId={hospital.id} /></TabsContent>
          <TabsContent value="staff"><StaffTab hospitalId={hospital.id} /></TabsContent>
          <TabsContent value="branding"><BrandingTab hospitalId={hospital.id} /></TabsContent>
          <TabsContent value="settings"><SettingsTab hospitalId={hospital.id} hospitalCode={hospital.code} /></TabsContent>
          <TabsContent value="sha"><ShaSettingsTab hospitalId={hospital.id} /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

// ---------------- Modules ----------------
function ModulesTab({ hospitalId }: { hospitalId: string }) {
  const qc = useQueryClient();
  const { data: modules = [] } = useQuery({
    queryKey: ["modules"],
    queryFn: async () => {
      const { data, error } = await supabase.from("modules")
        .select("id,code,name,category,description,is_core,min_plan,sort_order").order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: installed = [] } = useQuery({
    queryKey: ["hospital_modules", hospitalId],
    queryFn: async () => {
      const { data, error } = await supabase.from("hospital_modules")
        .select("id,module_id,enabled").eq("hospital_id", hospitalId);
      if (error) throw error;
      return data ?? [];
    },
  });
  const map = new Map(installed.map((r) => [r.module_id, r]));
  const toggle = useMutation({
    mutationFn: async ({ moduleId, enabled }: { moduleId: string; enabled: boolean }) => {
      const existing = map.get(moduleId);
      if (existing) {
        if (!enabled) {
          const { error } = await supabase.from("hospital_modules").delete().eq("id", existing.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("hospital_modules").update({ enabled: true }).eq("id", existing.id);
          if (error) throw error;
        }
      } else if (enabled) {
        const { error } = await supabase.from("hospital_modules").insert({ hospital_id: hospitalId, module_id: moduleId, enabled: true });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hospital_modules", hospitalId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const byCat = modules.reduce<Record<string, typeof modules>>((a, m) => { (a[m.category] ||= []).push(m); return a; }, {});
  return (
    <div className="space-y-5">
      {Object.entries(byCat).map(([cat, list]) => (
        <Card key={cat}>
          <CardHeader className="pb-2"><CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">{cat.replace("_", " ")}</CardTitle></CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            {list.map((m) => {
              const inst = map.get(m.id);
              const on = !!inst?.enabled;
              return (
                <div key={m.id} className="flex items-start justify-between rounded-md border bg-background p-3">
                  <div className="pr-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium">{m.name}</span>
                      {m.is_core && <Badge variant="secondary" className="text-[10px]">core</Badge>}
                      <Badge variant="outline" className="text-[10px]">{m.min_plan}</Badge>
                    </div>
                    {m.description && <p className="mt-1 text-xs text-muted-foreground">{m.description}</p>}
                  </div>
                  <Switch checked={on || m.is_core} disabled={m.is_core} onCheckedChange={(v) => toggle.mutate({ moduleId: m.id, enabled: v })} />
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ---------------- Branches ----------------
function BranchesTab({ hospitalId }: { hospitalId: string }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", code: "", address: "", phone: "" });
  const { data: branches = [] } = useQuery({
    queryKey: ["branches", hospitalId],
    queryFn: async () => {
      const { data, error } = await supabase.from("branches").select("*").eq("hospital_id", hospitalId).order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });
  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("branches").insert({
        hospital_id: hospitalId, name: form.name, code: form.code.toUpperCase(),
        address: form.address || null, phone: form.phone || null, is_primary: false, active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Branch added"); setForm({ name: "", code: "", address: "", phone: "" }); qc.invalidateQueries({ queryKey: ["branches", hospitalId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="h-4 w-4" /> Branches</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {branches.length === 0 && <p className="text-sm text-muted-foreground">No branches yet.</p>}
          {branches.map((b) => (
            <div key={b.id} className="flex items-center justify-between rounded-md border bg-background p-3">
              <div>
                <div className="flex items-center gap-2 font-medium">{b.name} {b.is_primary && <Badge>primary</Badge>}</div>
                <div className="text-xs text-muted-foreground">{b.code} · {b.address || "—"} · {b.phone || "—"}</div>
              </div>
              <Badge variant={b.active ? "secondary" : "outline"}>{b.active ? "active" : "inactive"}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Add branch</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><Label>Code</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
          <div><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <Button className="w-full" disabled={!form.name || !form.code || add.isPending} onClick={() => add.mutate()}>Add branch</Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------- Staff & invites ----------------
function StaffTab({ hospitalId }: { hospitalId: string }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ email: "", role: "doctor" as (typeof ROLES)[number] });

  const { data: invites = [] } = useQuery({
    queryKey: ["invites", hospitalId],
    queryFn: async () => {
      const { data, error } = await supabase.from("hospital_invites").select("*")
        .eq("hospital_id", hospitalId).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: members = [] } = useQuery({
    queryKey: ["members", hospitalId],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles")
        .select("id,email,full_name,title,hospital_id")
        .eq("hospital_id", hospitalId);
      if (error) throw error;
      return data ?? [];
    },
  });

  const invite = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("hospital_invites").insert({
        hospital_id: hospitalId, email: form.email.trim().toLowerCase(), role: form.role,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Invite created"); setForm({ email: "", role: "doctor" }); qc.invalidateQueries({ queryKey: ["invites", hospitalId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const revoke = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("hospital_invites").update({ status: "revoked" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invites", hospitalId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const inviteUrl = (token: string) => `${window.location.origin}/accept-invite?token=${token}`;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Pending invites</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {invites.length === 0 && <p className="text-sm text-muted-foreground">No invites yet.</p>}
            {invites.map((i) => (
              <div key={i.id} className="flex items-center justify-between rounded-md border bg-background p-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 font-medium">
                    {i.email} <Badge variant="outline">{i.role}</Badge>
                    <Badge variant={i.status === "pending" ? "secondary" : "outline"}>{i.status}</Badge>
                  </div>
                  <div className="mt-1 truncate text-xs text-muted-foreground">expires {new Date(i.expires_at).toLocaleDateString()}</div>
                </div>
                <div className="flex items-center gap-1">
                  {i.status === "pending" && (
                    <>
                      <Button size="icon" variant="ghost" onClick={() => { navigator.clipboard.writeText(inviteUrl(i.token)); toast.success("Invite link copied"); }}>
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => revoke.mutate(i.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Team members</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {members.length === 0 && <p className="text-sm text-muted-foreground">No staff yet — invite users above.</p>}
            {members.map((m) => (
              <div key={m.id} className="flex items-center justify-between rounded-md border bg-background p-3">
                <div>
                  <div className="font-medium">{m.full_name || m.email}</div>
                  <div className="text-xs text-muted-foreground">{m.email} {m.title ? `· ${m.title}` : ""}</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Invite a staff member</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div>
            <Label>Role</Label>
            <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as (typeof ROLES)[number] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{r.replace("_", " ")}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button className="w-full" disabled={!form.email || invite.isPending} onClick={() => invite.mutate()}>Send invite</Button>
          <p className="text-xs text-muted-foreground">
            An invite link will be generated. Copy and share it with the staff member — they'll sign in
            with this email to accept the role.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------- Branding ----------------
function BrandingTab({ hospitalId }: { hospitalId: string }) {
  const qc = useQueryClient();
  const { data: b } = useQuery({
    queryKey: ["branding", hospitalId],
    queryFn: async () => {
      const { data, error } = await supabase.from("hospital_branding").select("*").eq("hospital_id", hospitalId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const [form, setForm] = useState<Record<string, string>>({});
  useEffect(() => { if (b) setForm(b as unknown as Record<string, string>); }, [b]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        hospital_id: hospitalId,
        app_name: form.app_name ?? null,
        logo_url: form.logo_url ?? null,
        splash_url: form.splash_url ?? null,
        primary_color: form.primary_color ?? null,
        secondary_color: form.secondary_color ?? null,
        accent_color: form.accent_color ?? null,
        receipt_header: form.receipt_header ?? null,
        receipt_footer: form.receipt_footer ?? null,
        report_header: form.report_header ?? null,
        prescription_header: form.prescription_header ?? null,
      };
      const { error } = await supabase.from("hospital_branding").upsert(payload, { onConflict: "hospital_id" });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Branding saved"); qc.invalidateQueries({ queryKey: ["branding", hospitalId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const bind = (k: string) => ({ value: form[k] ?? "", onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value }) });

  return (
    <Card>
      <CardHeader><CardTitle>Branding</CardTitle><CardDescription>Applied to the mobile apps, receipts, prescriptions and reports.</CardDescription></CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><Label>App display name</Label><Input {...bind("app_name")} /></div>
        <div><Label>Logo URL</Label><Input {...bind("logo_url")} /></div>
        <div><Label>Splash URL</Label><Input {...bind("splash_url")} /></div>
        <div><Label>Primary colour</Label><Input type="color" {...bind("primary_color")} /></div>
        <div><Label>Secondary colour</Label><Input type="color" {...bind("secondary_color")} /></div>
        <div><Label>Accent colour</Label><Input type="color" {...bind("accent_color")} /></div>
        <div className="sm:col-span-2"><Label>Receipt header</Label><Textarea rows={2} {...bind("receipt_header")} /></div>
        <div className="sm:col-span-2"><Label>Receipt footer</Label><Textarea rows={2} {...bind("receipt_footer")} /></div>
        <div className="sm:col-span-2"><Label>Prescription header</Label><Textarea rows={2} {...bind("prescription_header")} /></div>
        <div className="sm:col-span-2"><Label>Report header</Label><Textarea rows={2} {...bind("report_header")} /></div>
        <div className="sm:col-span-2"><Button disabled={save.isPending} onClick={() => save.mutate()}>Save branding</Button></div>
      </CardContent>
    </Card>
  );
}

// ---------------- Settings ----------------
function SettingsTab({ hospitalId, hospitalCode }: { hospitalId: string; hospitalCode: string }) {
  const qc = useQueryClient();
  const [key, setKey] = useState({ category: "clinical", key: "", value: "" });
  const { data: settings = [] } = useQuery({
    queryKey: ["settings", hospitalId],
    queryFn: async () => {
      const { data, error } = await supabase.from("hospital_settings").select("*").eq("hospital_id", hospitalId).order("category");
      if (error) throw error;
      return data ?? [];
    },
  });
  const save = useMutation({
    mutationFn: async () => {
      let parsed: unknown = key.value;
      try { parsed = JSON.parse(key.value); } catch { /* keep string */ }
      const { error } = await supabase.from("hospital_settings").upsert(
        { hospital_id: hospitalId, category: key.category, key: key.key, value: parsed as never },
        { onConflict: "hospital_id,category,key" },
      );
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Setting saved"); setKey({ category: key.category, key: "", value: "" }); qc.invalidateQueries({ queryKey: ["settings", hospitalId] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("hospital_settings").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings", hospitalId] }),
  });

  const configUrl = typeof window !== "undefined" ? `${window.location.origin}/api/public/config/${hospitalCode}` : "";

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <Card>
        <CardHeader>
          <CardTitle>Facility settings</CardTitle>
          <CardDescription>Category · key · JSON value. Consumed by the apps at runtime.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {settings.length === 0 && <p className="text-sm text-muted-foreground">No settings yet.</p>}
          {settings.map((s) => (
            <div key={s.id} className="flex items-start justify-between gap-2 rounded-md border bg-background p-3">
              <div className="min-w-0">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">{s.category}</div>
                <div className="font-medium">{s.key}</div>
                <pre className="mt-1 max-w-full overflow-x-auto rounded bg-muted p-2 text-xs">{JSON.stringify(s.value, null, 2)}</pre>
              </div>
              <Button size="icon" variant="ghost" onClick={() => del.mutate(s.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Add / update setting</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Category</Label>
              <Select value={key.category} onValueChange={(v) => setKey({ ...key, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["clinical","billing","pharmacy","laboratory","sha","notifications","general"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Key</Label><Input value={key.key} onChange={(e) => setKey({ ...key, key: e.target.value })} placeholder="e.g. consultation_fee" /></div>
            <div><Label>Value (JSON or string)</Label><Textarea rows={4} value={key.value} onChange={(e) => setKey({ ...key, value: e.target.value })} placeholder='e.g. 500 or {"amount":500}' /></div>
            <Button className="w-full" disabled={!key.key || save.isPending} onClick={() => save.mutate()}>Save setting</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">App bootstrap URL</CardTitle><CardDescription>Your mobile/desktop apps read this URL at startup.</CardDescription></CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Input readOnly value={configUrl} />
              <Button size="icon" variant="outline" onClick={() => { navigator.clipboard.writeText(configUrl); toast.success("URL copied"); }}><Copy className="h-4 w-4" /></Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Returns branding, timezone, currency and the list of enabled module codes for this hospital.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
