import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Stethoscope, ChevronLeft, UserCheck, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/patients/new")({
  head: () => ({ meta: [{ title: "Register patient — Afyacore HMIS" }] }),
  component: RegisterPatient,
});

const SEX = [
  { v: "male", l: "Male" }, { v: "female", l: "Female" },
  { v: "intersex", l: "Intersex" }, { v: "unknown", l: "Unknown" },
] as const;
const MARITAL = ["single","married","divorced","widowed","separated","cohabiting","unknown"] as const;
const BLOOD = ["unknown","A+","A-","B+","B-","AB+","AB-","O+","O-"] as const;
const RELATIONSHIPS = ["Spouse","Parent","Child","Sibling","Guardian","Friend","Other"];
const LANGUAGES = ["English","Swahili","Kikuyu","Luo","Kalenjin","Kamba","Kisii","Meru","Somali","Other"];

type FormState = {
  first_name: string; middle_name: string; last_name: string; other_names: string; preferred_name: string;
  date_of_birth: string; dob_estimated: boolean;
  sex: typeof SEX[number]["v"]; gender_identity: string;
  marital_status: typeof MARITAL[number]; blood_group: typeof BLOOD[number];
  occupation: string; employer: string; preferred_language: string; religion: string; nationality: string;
  national_id: string; passport_no: string; birth_cert_no: string; sha_number: string; nhif_number: string;
  phone: string; alt_phone: string; email: string;
  address_line: string; county: string; sub_county: string; ward: string; village: string; postal_code: string;
  nok_name: string; nok_relationship: string; nok_phone: string; nok_alt_phone: string; nok_address: string;
  emergency_contact_name: string; emergency_contact_phone: string; emergency_contact_relationship: string;
  allergies: string; chronic_conditions: string; disabilities: string;
  notes: string;
  consent_data_processing: boolean; consent_sms: boolean;
  is_vip: boolean; is_confidential: boolean;
  branch_id: string;
};

const empty: FormState = {
  first_name: "", middle_name: "", last_name: "", other_names: "", preferred_name: "",
  date_of_birth: "", dob_estimated: false,
  sex: "unknown", gender_identity: "",
  marital_status: "unknown", blood_group: "unknown",
  occupation: "", employer: "", preferred_language: "", religion: "", nationality: "Kenyan",
  national_id: "", passport_no: "", birth_cert_no: "", sha_number: "", nhif_number: "",
  phone: "", alt_phone: "", email: "",
  address_line: "", county: "", sub_county: "", ward: "", village: "", postal_code: "",
  nok_name: "", nok_relationship: "", nok_phone: "", nok_alt_phone: "", nok_address: "",
  emergency_contact_name: "", emergency_contact_phone: "", emergency_contact_relationship: "",
  allergies: "", chronic_conditions: "", disabilities: "",
  notes: "",
  consent_data_processing: false, consent_sms: false,
  is_vip: false, is_confidential: false,
  branch_id: "",
};

function RegisterPatient() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [f, setF] = useState<FormState>(empty);
  const [checkedDupes, setCheckedDupes] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  const { data: profile } = useQuery({
    queryKey: ["my-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const hospitalId = profile?.hospital_id;

  const { data: branches = [] } = useQuery({
    queryKey: ["branches", hospitalId],
    enabled: !!hospitalId,
    queryFn: async () => {
      const { data, error } = await supabase.from("branches").select("id,name,is_primary").eq("hospital_id", hospitalId!).eq("active", true).order("is_primary", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!f.branch_id && branches.length) setF((s) => ({ ...s, branch_id: branches[0].id }));
  }, [branches, f.branch_id]);

  const dupCheck = useMutation({
    mutationFn: async () => {
      if (!hospitalId) return [];
      const { data, error } = await supabase.rpc("find_patient_duplicates", {
        _hospital_id: hospitalId,
        _first_name: f.first_name || null,
        _last_name: f.last_name || null,
        _dob: f.date_of_birth || null,
        _phone: f.phone || null,
        _national_id: f.national_id || null,
      } as never);
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; mrn: string; first_name: string; last_name: string; phone: string | null }>;
    },
  });

  const canCheck = f.first_name.trim() && f.last_name.trim();
  const canSubmit = f.first_name.trim() && f.last_name.trim() && f.sex && f.consent_data_processing && !!hospitalId;

  const submit = useMutation({
    mutationFn: async () => {
      if (!hospitalId) throw new Error("No hospital linked to your profile.");
      const toArr = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
      const payload = {
        hospital_id: hospitalId,
        branch_id: f.branch_id || null,
        first_name: f.first_name.trim(),
        middle_name: f.middle_name.trim() || null,
        last_name: f.last_name.trim(),
        other_names: f.other_names.trim() || null,
        preferred_name: f.preferred_name.trim() || null,
        date_of_birth: f.date_of_birth || null,
        dob_estimated: f.dob_estimated,
        sex: f.sex,
        gender_identity: f.gender_identity.trim() || null,
        marital_status: f.marital_status,
        blood_group: f.blood_group,
        occupation: f.occupation.trim() || null,
        employer: f.employer.trim() || null,
        preferred_language: f.preferred_language || null,
        religion: f.religion.trim() || null,
        nationality: f.nationality.trim() || null,
        national_id: f.national_id.trim() || null,
        passport_no: f.passport_no.trim() || null,
        birth_cert_no: f.birth_cert_no.trim() || null,
        sha_number: f.sha_number.trim() || null,
        nhif_number: f.nhif_number.trim() || null,
        phone: f.phone.trim() || null,
        alt_phone: f.alt_phone.trim() || null,
        email: f.email.trim() || null,
        address_line: f.address_line.trim() || null,
        county: f.county.trim() || null,
        sub_county: f.sub_county.trim() || null,
        ward: f.ward.trim() || null,
        village: f.village.trim() || null,
        postal_code: f.postal_code.trim() || null,
        nok_name: f.nok_name.trim() || null,
        nok_relationship: f.nok_relationship || null,
        nok_phone: f.nok_phone.trim() || null,
        nok_alt_phone: f.nok_alt_phone.trim() || null,
        nok_address: f.nok_address.trim() || null,
        emergency_contact_name: f.emergency_contact_name.trim() || null,
        emergency_contact_phone: f.emergency_contact_phone.trim() || null,
        emergency_contact_relationship: f.emergency_contact_relationship || null,
        allergies: toArr(f.allergies),
        chronic_conditions: toArr(f.chronic_conditions),
        disabilities: toArr(f.disabilities),
        notes: f.notes.trim() || null,
        consent_data_processing: f.consent_data_processing,
        consent_sms: f.consent_sms,
        consent_signed_at: f.consent_data_processing ? new Date().toISOString() : null,
        is_vip: f.is_vip,
        is_confidential: f.is_confidential,
        registered_by: user?.id ?? null,
      };
      const { data, error } = await supabase.from("patients").insert(payload).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (p) => {
      toast.success(`Registered ${p.first_name} ${p.last_name} — MRN ${p.mrn}`);
      navigate({ to: "/patients/$id", params: { id: p.id } });
    },
    onError: (e: Error) => toast.error(e.message || "Failed to register patient"),
  });

  if (loading || !user) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>;

  return (
    <div className="min-h-screen bg-secondary/20">
      <header className="border-b bg-background">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link to="/patients" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Stethoscope className="h-4 w-4" />
            </div>
            <span className="font-semibold tracking-tight">Register patient</span>
          </Link>
          <Link to="/patients"><Button size="sm" variant="ghost"><ChevronLeft className="mr-1 h-4 w-4" />Back</Button></Link>
        </div>
      </header>

      <main className="container mx-auto max-w-4xl space-y-6 px-4 py-8">
        {!hospitalId && (
          <Card><CardContent className="flex items-center gap-3 py-6 text-sm text-muted-foreground">
            <AlertTriangle className="h-5 w-5" />
            Your profile isn't linked to a hospital yet — ask an admin to invite you first.
          </CardContent></Card>
        )}

        <Section title="Identity" desc="Legal names as they appear on ID.">
          <Grid>
            <Field label="First name" required><Input value={f.first_name} onChange={(e) => setF({ ...f, first_name: e.target.value })} /></Field>
            <Field label="Middle name"><Input value={f.middle_name} onChange={(e) => setF({ ...f, middle_name: e.target.value })} /></Field>
            <Field label="Last name" required><Input value={f.last_name} onChange={(e) => setF({ ...f, last_name: e.target.value })} /></Field>
            <Field label="Other names"><Input value={f.other_names} onChange={(e) => setF({ ...f, other_names: e.target.value })} /></Field>
            <Field label="Preferred name / nickname"><Input value={f.preferred_name} onChange={(e) => setF({ ...f, preferred_name: e.target.value })} /></Field>
            <Field label="Registering branch">
              <Select value={f.branch_id} onValueChange={(v) => setF({ ...f, branch_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
                <SelectContent>
                  {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}{b.is_primary ? " (primary)" : ""}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </Grid>
        </Section>

        <Section title="Demographics">
          <Grid>
            <Field label="Date of birth">
              <Input type="date" value={f.date_of_birth} onChange={(e) => setF({ ...f, date_of_birth: e.target.value })} />
            </Field>
            <Field label="DOB is estimated">
              <label className="flex h-10 items-center gap-2">
                <Checkbox checked={f.dob_estimated} onCheckedChange={(v) => setF({ ...f, dob_estimated: !!v })} />
                <span className="text-sm text-muted-foreground">Approximate age only</span>
              </label>
            </Field>
            <Field label="Sex" required>
              <Select value={f.sex} onValueChange={(v) => setF({ ...f, sex: v as FormState["sex"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SEX.map((s) => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Gender identity (optional)"><Input value={f.gender_identity} onChange={(e) => setF({ ...f, gender_identity: e.target.value })} /></Field>
            <Field label="Marital status">
              <Select value={f.marital_status} onValueChange={(v) => setF({ ...f, marital_status: v as FormState["marital_status"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{MARITAL.map((m) => <SelectItem key={m} value={m} className="capitalize">{m}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Blood group">
              <Select value={f.blood_group} onValueChange={(v) => setF({ ...f, blood_group: v as FormState["blood_group"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{BLOOD.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Occupation"><Input value={f.occupation} onChange={(e) => setF({ ...f, occupation: e.target.value })} /></Field>
            <Field label="Employer"><Input value={f.employer} onChange={(e) => setF({ ...f, employer: e.target.value })} /></Field>
            <Field label="Preferred language">
              <Select value={f.preferred_language} onValueChange={(v) => setF({ ...f, preferred_language: v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{LANGUAGES.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Religion"><Input value={f.religion} onChange={(e) => setF({ ...f, religion: e.target.value })} /></Field>
            <Field label="Nationality"><Input value={f.nationality} onChange={(e) => setF({ ...f, nationality: e.target.value })} /></Field>
          </Grid>
        </Section>

        <Section title="Identifiers & insurance" desc="At least one identifier recommended.">
          <Grid>
            <Field label="National ID"><Input value={f.national_id} onChange={(e) => setF({ ...f, national_id: e.target.value })} /></Field>
            <Field label="Passport no."><Input value={f.passport_no} onChange={(e) => setF({ ...f, passport_no: e.target.value })} /></Field>
            <Field label="Birth certificate no."><Input value={f.birth_cert_no} onChange={(e) => setF({ ...f, birth_cert_no: e.target.value })} /></Field>
            <Field label="SHA number"><Input value={f.sha_number} onChange={(e) => setF({ ...f, sha_number: e.target.value })} /></Field>
            <Field label="NHIF number (legacy)"><Input value={f.nhif_number} onChange={(e) => setF({ ...f, nhif_number: e.target.value })} /></Field>
          </Grid>
        </Section>

        <Section title="Contact & address">
          <Grid>
            <Field label="Phone"><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="+2547…" /></Field>
            <Field label="Alt phone"><Input value={f.alt_phone} onChange={(e) => setF({ ...f, alt_phone: e.target.value })} /></Field>
            <Field label="Email"><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
            <div className="sm:col-span-2"><Field label="Physical address"><Input value={f.address_line} onChange={(e) => setF({ ...f, address_line: e.target.value })} /></Field></div>
            <Field label="County"><Input value={f.county} onChange={(e) => setF({ ...f, county: e.target.value })} /></Field>
            <Field label="Sub-county"><Input value={f.sub_county} onChange={(e) => setF({ ...f, sub_county: e.target.value })} /></Field>
            <Field label="Ward"><Input value={f.ward} onChange={(e) => setF({ ...f, ward: e.target.value })} /></Field>
            <Field label="Village / estate"><Input value={f.village} onChange={(e) => setF({ ...f, village: e.target.value })} /></Field>
            <Field label="Postal code"><Input value={f.postal_code} onChange={(e) => setF({ ...f, postal_code: e.target.value })} /></Field>
          </Grid>
        </Section>

        <Section title="Next of kin">
          <Grid>
            <Field label="Full name"><Input value={f.nok_name} onChange={(e) => setF({ ...f, nok_name: e.target.value })} /></Field>
            <Field label="Relationship">
              <Select value={f.nok_relationship} onValueChange={(v) => setF({ ...f, nok_relationship: v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{RELATIONSHIPS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Phone"><Input value={f.nok_phone} onChange={(e) => setF({ ...f, nok_phone: e.target.value })} /></Field>
            <Field label="Alt phone"><Input value={f.nok_alt_phone} onChange={(e) => setF({ ...f, nok_alt_phone: e.target.value })} /></Field>
            <div className="sm:col-span-2"><Field label="Address"><Input value={f.nok_address} onChange={(e) => setF({ ...f, nok_address: e.target.value })} /></Field></div>
          </Grid>
        </Section>

        <Section title="Emergency contact" desc="Person to call in an emergency — may be the same as next of kin.">
          <Grid>
            <Field label="Full name"><Input value={f.emergency_contact_name} onChange={(e) => setF({ ...f, emergency_contact_name: e.target.value })} /></Field>
            <Field label="Phone"><Input value={f.emergency_contact_phone} onChange={(e) => setF({ ...f, emergency_contact_phone: e.target.value })} /></Field>
            <Field label="Relationship">
              <Select value={f.emergency_contact_relationship} onValueChange={(v) => setF({ ...f, emergency_contact_relationship: v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{RELATIONSHIPS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          </Grid>
        </Section>

        <Section title="Clinical flags" desc="Comma-separated. Optional but strongly recommended.">
          <Grid>
            <div className="sm:col-span-2"><Field label="Known allergies"><Input value={f.allergies} onChange={(e) => setF({ ...f, allergies: e.target.value })} placeholder="e.g. Penicillin, Peanuts" /></Field></div>
            <div className="sm:col-span-2"><Field label="Chronic conditions"><Input value={f.chronic_conditions} onChange={(e) => setF({ ...f, chronic_conditions: e.target.value })} placeholder="e.g. Hypertension, Diabetes" /></Field></div>
            <div className="sm:col-span-2"><Field label="Disabilities"><Input value={f.disabilities} onChange={(e) => setF({ ...f, disabilities: e.target.value })} placeholder="e.g. Visual impairment" /></Field></div>
            <div className="sm:col-span-2"><Field label="Registration notes"><Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} rows={3} /></Field></div>
          </Grid>
        </Section>

        <Section title="Flags & consent">
          <Grid>
            <label className="flex items-center gap-3 rounded-md border bg-background p-3">
              <Checkbox checked={f.is_vip} onCheckedChange={(v) => setF({ ...f, is_vip: !!v })} />
              <div><div className="text-sm font-medium">VIP patient</div><div className="text-xs text-muted-foreground">Notify management on arrival</div></div>
            </label>
            <label className="flex items-center gap-3 rounded-md border bg-background p-3">
              <Checkbox checked={f.is_confidential} onCheckedChange={(v) => setF({ ...f, is_confidential: !!v })} />
              <div><div className="text-sm font-medium">Confidential record</div><div className="text-xs text-muted-foreground">Restrict visibility in queues</div></div>
            </label>
            <label className="flex items-center gap-3 rounded-md border bg-background p-3 sm:col-span-2">
              <Checkbox checked={f.consent_data_processing} onCheckedChange={(v) => setF({ ...f, consent_data_processing: !!v })} />
              <div><div className="text-sm font-medium">Consent to data processing <span className="text-destructive">*</span></div><div className="text-xs text-muted-foreground">Patient consents to storage & use of their health data per Kenya Data Protection Act.</div></div>
            </label>
            <label className="flex items-center gap-3 rounded-md border bg-background p-3 sm:col-span-2">
              <Checkbox checked={f.consent_sms} onCheckedChange={(v) => setF({ ...f, consent_sms: !!v })} />
              <div><div className="text-sm font-medium">SMS communication consent</div><div className="text-xs text-muted-foreground">Appointment reminders, results notifications.</div></div>
            </label>
          </Grid>
        </Section>

        <Card>
          <CardContent className="flex flex-col gap-3 py-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground">
              Run a duplicate check before saving to avoid double-registration.
            </div>
            <Button
              variant="outline"
              disabled={!canCheck || dupCheck.isPending}
              onClick={() => { setCheckedDupes(true); dupCheck.mutate(); }}
            >
              <UserCheck className="mr-2 h-4 w-4" />
              {dupCheck.isPending ? "Checking…" : "Check for duplicates"}
            </Button>
          </CardContent>
          {checkedDupes && dupCheck.data && (
            <CardContent className="border-t pt-4">
              {dupCheck.data.length === 0 ? (
                <div className="text-sm text-muted-foreground">No potential duplicates found.</div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-amber-600">
                    <AlertTriangle className="h-4 w-4" /> {dupCheck.data.length} possible duplicate(s):
                  </div>
                  <ul className="space-y-1 text-sm">
                    {dupCheck.data.map((d) => (
                      <li key={d.id} className="flex items-center justify-between rounded-md border bg-muted/30 p-2">
                        <span><span className="font-mono text-xs">{d.mrn}</span> — {d.first_name} {d.last_name} {d.phone ? `· ${d.phone}` : ""}</span>
                        <Link to="/patients/$id" params={{ id: d.id }}>
                          <Button size="sm" variant="ghost">Open existing</Button>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          )}
        </Card>

        <div className="flex items-center justify-end gap-2">
          <Link to="/patients"><Button variant="ghost">Cancel</Button></Link>
          <Button disabled={!canSubmit || submit.isPending} onClick={() => submit.mutate()}>
            {submit.isPending ? "Registering…" : "Register patient"}
          </Button>
        </div>
      </main>
    </div>
  );
}

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle>{desc && <CardDescription>{desc}</CardDescription>}</CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}
function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}{required && <span className="text-destructive"> *</span>}</Label>
      {children}
    </div>
  );
}
