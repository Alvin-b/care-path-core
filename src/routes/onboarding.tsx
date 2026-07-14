import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { CheckCircle2, ChevronLeft, ChevronRight, Stethoscope } from "lucide-react";

export const Route = createFileRoute("/onboarding")({
  head: () => ({ meta: [{ title: "Facility onboarding — Afyacore HMIS" }] }),
  component: OnboardingWizard,
});

const LEVELS = [
  { value: "dispensary", label: "Dispensary" },
  { value: "clinic", label: "Clinic" },
  { value: "health_centre", label: "Health Centre" },
  { value: "diagnostic_centre", label: "Diagnostic Centre" },
  { value: "sub_county_hospital", label: "Sub-county Hospital" },
  { value: "county_hospital", label: "County Hospital" },
  { value: "referral_hospital", label: "Referral Hospital" },
  { value: "private_hospital", label: "Private Hospital" },
];

type FacilityLevel = (typeof LEVELS)[number]["value"];

function OnboardingWizard() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [step, setStep] = useState(1);

  const [facility, setFacility] = useState({
    name: "",
    code: "",
    facility_level: "clinic" as FacilityLevel,
    country: "KE",
    timezone: "Africa/Nairobi",
    currency: "KES",
    email: "",
    phone: "",
    address: "",
    sha_reg_no: "",
    tax_pin: "",
  });
  const [branch, setBranch] = useState({ name: "Main branch", code: "MAIN", address: "", phone: "" });
  const [branding, setBranding] = useState({
    app_name: "",
    primary_color: "#0f766e",
    accent_color: "#f59e0b",
  });
  const [selectedModules, setSelectedModules] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  // Load modules
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

  // Load recommended module codes when level changes
  const { data: recommended = [] } = useQuery({
    queryKey: ["recommended-modules", facility.facility_level],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("recommend_modules_for_level", {
        _level: facility.facility_level as never,
      });
      if (error) throw error;
      return (data ?? []) as string[];
    },
    enabled: !!facility.facility_level,
  });

  // Seed selected modules when recommendations arrive
  useEffect(() => {
    const core = modules.filter((m) => m.is_core).map((m) => m.code);
    setSelectedModules(new Set([...core, ...recommended]));
  }, [recommended, modules]);

  const modulesByCat = useMemo(() => {
    return modules.reduce<Record<string, typeof modules>>((acc, m) => {
      (acc[m.category] ||= []).push(m);
      return acc;
    }, {});
  }, [modules]);

  const submit = useMutation({
    mutationFn: async () => {
      // 1. hospital
      const { data: hospital, error: hErr } = await supabase
        .from("hospitals")
        .insert({
          name: facility.name,
          code: facility.code.toUpperCase(),
          facility_level: facility.facility_level as never,
          country: facility.country,
          timezone: facility.timezone,
          currency: facility.currency,
          email: facility.email || null,
          phone: facility.phone || null,
          address: facility.address || null,
          sha_reg_no: facility.sha_reg_no || null,
          tax_pin: facility.tax_pin || null,
        })
        .select()
        .single();
      if (hErr) throw hErr;

      // 2. primary branch
      const { error: bErr } = await supabase.from("branches").insert({
        hospital_id: hospital.id,
        name: branch.name,
        code: branch.code.toUpperCase(),
        address: branch.address || null,
        phone: branch.phone || null,
        is_primary: true,
        active: true,
      });
      if (bErr) throw bErr;

      // 3. branding
      const { error: brErr } = await supabase.from("hospital_branding").insert({
        hospital_id: hospital.id,
        app_name: branding.app_name || hospital.name,
        primary_color: branding.primary_color,
        accent_color: branding.accent_color,
      });
      if (brErr) throw brErr;

      // 4. install selected modules
      const chosen = modules.filter((m) => selectedModules.has(m.code) || m.is_core);
      if (chosen.length) {
        const { error: mErr } = await supabase.from("hospital_modules").insert(
          chosen.map((m) => ({ hospital_id: hospital.id, module_id: m.id, enabled: true })),
        );
        if (mErr) throw mErr;
      }

      return hospital;
    },
    onSuccess: (h) => {
      toast.success(`${h.name} onboarded successfully`);
      navigate({ to: "/admin" });
    },
    onError: (e: Error) => toast.error(e.message || "Failed to onboard hospital"),
  });

  if (loading || !user) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  }

  const canNext =
    (step === 1 && facility.name && facility.code && facility.facility_level) ||
    (step === 2 && branch.name && branch.code) ||
    step === 3 ||
    step === 4;

  return (
    <div className="min-h-screen bg-secondary/20">
      <header className="border-b bg-background">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Stethoscope className="h-4 w-4" />
            </div>
            <span className="font-semibold tracking-tight">Facility onboarding</span>
          </Link>
          <Link to="/admin"><Button size="sm" variant="ghost">Skip to console</Button></Link>
        </div>
      </header>

      <main className="container mx-auto max-w-3xl px-4 py-8">
        <StepIndicator step={step} />

        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Facility profile</CardTitle>
              <CardDescription>Tell us about the hospital or clinic.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Facility name" required>
                <Input value={facility.name} onChange={(e) => setFacility({ ...facility, name: e.target.value })} />
              </Field>
              <Field label="Hospital code" required hint="Short unique code, e.g. NRB001">
                <Input value={facility.code} onChange={(e) => setFacility({ ...facility, code: e.target.value })} />
              </Field>
              <Field label="Facility level" required>
                <Select
                  value={facility.facility_level}
                  onValueChange={(v) => setFacility({ ...facility, facility_level: v as FacilityLevel })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LEVELS.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Country"><Input value={facility.country} onChange={(e) => setFacility({ ...facility, country: e.target.value })} /></Field>
              <Field label="Timezone"><Input value={facility.timezone} onChange={(e) => setFacility({ ...facility, timezone: e.target.value })} /></Field>
              <Field label="Currency"><Input value={facility.currency} onChange={(e) => setFacility({ ...facility, currency: e.target.value })} /></Field>
              <Field label="Contact email"><Input type="email" value={facility.email} onChange={(e) => setFacility({ ...facility, email: e.target.value })} /></Field>
              <Field label="Contact phone"><Input value={facility.phone} onChange={(e) => setFacility({ ...facility, phone: e.target.value })} /></Field>
              <div className="sm:col-span-2">
                <Field label="Physical address"><Input value={facility.address} onChange={(e) => setFacility({ ...facility, address: e.target.value })} /></Field>
              </div>
              <Field label="SHA registration no."><Input value={facility.sha_reg_no} onChange={(e) => setFacility({ ...facility, sha_reg_no: e.target.value })} /></Field>
              <Field label="KRA / Tax PIN"><Input value={facility.tax_pin} onChange={(e) => setFacility({ ...facility, tax_pin: e.target.value })} /></Field>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Primary branch</CardTitle>
              <CardDescription>Every facility needs at least one branch. You can add more later.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Branch name" required><Input value={branch.name} onChange={(e) => setBranch({ ...branch, name: e.target.value })} /></Field>
              <Field label="Branch code" required><Input value={branch.code} onChange={(e) => setBranch({ ...branch, code: e.target.value })} /></Field>
              <div className="sm:col-span-2"><Field label="Address"><Input value={branch.address} onChange={(e) => setBranch({ ...branch, address: e.target.value })} /></Field></div>
              <Field label="Phone"><Input value={branch.phone} onChange={(e) => setBranch({ ...branch, phone: e.target.value })} /></Field>
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>Modules</CardTitle>
              <CardDescription>
                We've pre-selected modules typical for a <b>{LEVELS.find((l) => l.value === facility.facility_level)?.label}</b>. Adjust to match this facility.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {Object.entries(modulesByCat).map(([cat, list]) => (
                <div key={cat}>
                  <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{cat.replace("_", " ")}</div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {list.map((m) => {
                      const on = selectedModules.has(m.code) || m.is_core;
                      const rec = recommended.includes(m.code);
                      return (
                        <label key={m.id} className="flex cursor-pointer items-start gap-3 rounded-md border bg-background p-3">
                          <Checkbox
                            checked={on}
                            disabled={m.is_core}
                            onCheckedChange={(v) => {
                              const next = new Set(selectedModules);
                              if (v) next.add(m.code); else next.delete(m.code);
                              setSelectedModules(next);
                            }}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-medium">{m.name}</span>
                              {m.is_core && <Badge variant="secondary" className="text-[10px]">core</Badge>}
                              {rec && <Badge className="text-[10px]">recommended</Badge>}
                              <Badge variant="outline" className="text-[10px]">{m.min_plan}</Badge>
                            </div>
                            {m.description && <p className="mt-1 text-xs text-muted-foreground">{m.description}</p>}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {step === 4 && (
          <Card>
            <CardHeader>
              <CardTitle>Branding</CardTitle>
              <CardDescription>How the apps will present this hospital.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field label="Display name (in apps)"><Input value={branding.app_name} placeholder={facility.name} onChange={(e) => setBranding({ ...branding, app_name: e.target.value })} /></Field>
              </div>
              <Field label="Primary colour">
                <div className="flex items-center gap-2">
                  <Input type="color" value={branding.primary_color} onChange={(e) => setBranding({ ...branding, primary_color: e.target.value })} className="h-10 w-14 p-1" />
                  <Input value={branding.primary_color} onChange={(e) => setBranding({ ...branding, primary_color: e.target.value })} />
                </div>
              </Field>
              <Field label="Accent colour">
                <div className="flex items-center gap-2">
                  <Input type="color" value={branding.accent_color} onChange={(e) => setBranding({ ...branding, accent_color: e.target.value })} className="h-10 w-14 p-1" />
                  <Input value={branding.accent_color} onChange={(e) => setBranding({ ...branding, accent_color: e.target.value })} />
                </div>
              </Field>
            </CardContent>
          </Card>
        )}

        <div className="mt-6 flex items-center justify-between">
          <Button variant="ghost" disabled={step === 1} onClick={() => setStep((s) => s - 1)}>
            <ChevronLeft className="mr-1 h-4 w-4" /> Back
          </Button>
          {step < 4 ? (
            <Button disabled={!canNext} onClick={() => setStep((s) => s + 1)}>
              Continue <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button disabled={submit.isPending} onClick={() => submit.mutate()}>
              <CheckCircle2 className="mr-1 h-4 w-4" /> {submit.isPending ? "Onboarding…" : "Finish onboarding"}
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}

function StepIndicator({ step }: { step: number }) {
  const steps = ["Facility", "Branch", "Modules", "Branding"];
  return (
    <ol className="mb-6 flex items-center gap-3 text-sm">
      {steps.map((label, i) => {
        const n = i + 1;
        const done = n < step;
        const active = n === step;
        return (
          <li key={label} className="flex items-center gap-2">
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs font-medium ${
                active ? "border-primary bg-primary text-primary-foreground"
                  : done ? "border-primary bg-primary/10 text-primary"
                    : "text-muted-foreground"
              }`}
            >
              {n}
            </span>
            <span className={active ? "font-medium" : "text-muted-foreground"}>{label}</span>
            {n < steps.length && <span className="mx-1 h-px w-6 bg-border" />}
          </li>
        );
      })}
    </ol>
  );
}

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}{required && <span className="text-destructive"> *</span>}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
