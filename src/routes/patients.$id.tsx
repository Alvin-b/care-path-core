import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Stethoscope, ChevronLeft, Phone, Mail, MapPin, Heart, ShieldAlert, UserCheck, Clock } from "lucide-react";

export const Route = createFileRoute("/patients/$id")({
  head: () => ({ meta: [{ title: "Patient — Afyacore HMIS" }] }),
  component: PatientDetail,
});

function PatientDetail() {
  const navigate = useNavigate();
  const { id } = Route.useParams();
  const { user, loading } = useAuth();

  useEffect(() => { if (!loading && !user) navigate({ to: "/auth" }); }, [loading, user, navigate]);

  const { data: p, isLoading, error } = useQuery({
    queryKey: ["patient", id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("patients").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: registrar } = useQuery({
    queryKey: ["patient-registrar", p?.registered_by],
    enabled: !!p?.registered_by,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("id", p!.registered_by!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },

  if (loading || isLoading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  if (error) return <div className="p-8 text-sm text-destructive">{error.message}</div>;
  if (!p) return <div className="p-8 text-sm text-muted-foreground">Patient not found.</div>;

  const fullName = [p.first_name, p.middle_name, p.last_name].filter(Boolean).join(" ");
  const age = p.date_of_birth ? ageFrom(p.date_of_birth) : null;

  return (
    <div className="min-h-screen bg-secondary/20">
      <header className="border-b bg-background">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link to="/patients" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Stethoscope className="h-4 w-4" />
            </div>
            <span className="font-semibold tracking-tight">Patient record</span>
          </Link>
          <Link to="/patients"><Button size="sm" variant="ghost"><ChevronLeft className="mr-1 h-4 w-4" />All patients</Button></Link>
        </div>
      </header>

      <main className="container mx-auto max-w-4xl space-y-6 px-4 py-8">
        <Card>
          <CardContent className="flex flex-col gap-4 py-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight">{fullName}</h1>
                {p.is_vip && <Badge variant="secondary">VIP</Badge>}
                {p.is_confidential && <Badge variant="outline">Confidential</Badge>}
                {p.is_deceased && <Badge variant="destructive">Deceased</Badge>}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                <span className="font-mono">{p.mrn}</span> · <span className="capitalize">{p.sex}</span>
                {age !== null && <> · {age}y{p.dob_estimated ? " (est.)" : ""}</>}
                {p.blood_group !== "unknown" && <> · Blood {p.blood_group}</>}
              </div>
            </div>
          </CardContent>
        </Card>

        {(p.allergies?.length || p.chronic_conditions?.length) ? (
          <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/20">
            <CardContent className="space-y-2 py-4 text-sm">
              {p.allergies?.length > 0 && (
                <div className="flex items-start gap-2">
                  <ShieldAlert className="mt-0.5 h-4 w-4 text-amber-600" />
                  <div><b>Allergies:</b> {p.allergies.join(", ")}</div>
                </div>
              )}
              {p.chronic_conditions?.length > 0 && (
                <div className="flex items-start gap-2">
                  <Heart className="mt-0.5 h-4 w-4 text-amber-600" />
                  <div><b>Chronic:</b> {p.chronic_conditions.join(", ")}</div>
                </div>
              )}
            </CardContent>
          </Card>
        ) : null}

        <div className="grid gap-6 md:grid-cols-2">
          <InfoCard title="Identity">
            <Row k="MRN" v={p.mrn} mono />
            <Row k="National ID" v={p.national_id} />
            <Row k="Passport" v={p.passport_no} />
            <Row k="Birth cert." v={p.birth_cert_no} />
            <Row k="SHA number" v={p.sha_number} />
            <Row k="NHIF (legacy)" v={p.nhif_number} />
            <Row k="Nationality" v={p.nationality} />
          </InfoCard>

          <InfoCard title="Demographics">
            <Row k="Date of birth" v={p.date_of_birth ? `${p.date_of_birth}${p.dob_estimated ? " (est.)" : ""}` : null} />
            <Row k="Sex" v={p.sex} capitalize />
            <Row k="Gender identity" v={p.gender_identity} />
            <Row k="Marital status" v={p.marital_status} capitalize />
            <Row k="Blood group" v={p.blood_group === "unknown" ? null : p.blood_group} />
            <Row k="Occupation" v={p.occupation} />
            <Row k="Employer" v={p.employer} />
            <Row k="Language" v={p.preferred_language} />
            <Row k="Religion" v={p.religion} />
          </InfoCard>

          <InfoCard title={<span className="flex items-center gap-2"><Phone className="h-4 w-4" />Contact</span>}>
            <Row k="Phone" v={p.phone} />
            <Row k="Alt phone" v={p.alt_phone} />
            <Row k="Email" v={p.email} icon={<Mail className="h-3.5 w-3.5" />} />
            <Row k="Address" v={p.address_line} icon={<MapPin className="h-3.5 w-3.5" />} />
            <Row k="County" v={p.county} />
            <Row k="Sub-county" v={p.sub_county} />
            <Row k="Ward" v={p.ward} />
            <Row k="Village" v={p.village} />
            <Row k="Postal" v={p.postal_code} />
          </InfoCard>

          <InfoCard title="Next of kin & emergency">
            <Row k="NoK name" v={p.nok_name} />
            <Row k="Relationship" v={p.nok_relationship} />
            <Row k="NoK phone" v={p.nok_phone} />
            <Row k="NoK alt phone" v={p.nok_alt_phone} />
            <Row k="NoK address" v={p.nok_address} />
            <hr className="my-2" />
            <Row k="Emergency name" v={p.emergency_contact_name} />
            <Row k="Emergency phone" v={p.emergency_contact_phone} />
            <Row k="Relationship" v={p.emergency_contact_relationship} />
          </InfoCard>
        </div>

        {p.notes && (
          <Card>
            <CardHeader><CardTitle className="text-base">Notes</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground whitespace-pre-wrap">{p.notes}</CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

function InfoCard({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-1.5 text-sm">{children}</CardContent>
    </Card>
  );
}
function Row({ k, v, mono, capitalize, icon }: { k: string; v: string | null | undefined; mono?: boolean; capitalize?: boolean; icon?: React.ReactNode }) {
  if (v === null || v === undefined || v === "") return null;
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-muted-foreground">{k}</span>
      <span className={`${mono ? "font-mono text-xs" : ""} ${capitalize ? "capitalize" : ""} flex items-center gap-1.5 text-right`}>
        {icon}{v}
      </span>
    </div>
  );
}
function ageFrom(dob: string) {
  const d = new Date(dob); const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a--;
  return a;
}
