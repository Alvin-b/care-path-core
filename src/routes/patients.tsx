import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Stethoscope, UserPlus, Search, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/patients")({
  head: () => ({ meta: [{ title: "Patients — Afyacore HMIS" }] }),
  component: PatientsList,
});

function PatientsList() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  const { data: profile } = useQuery({
    queryKey: ["my-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles").select("*").eq("id", user!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const hospitalId = profile?.hospital_id;

  const { data: patients = [], isLoading } = useQuery({
    queryKey: ["patients", hospitalId, q],
    enabled: !!hospitalId,
    queryFn: async () => {
      let query = supabase
        .from("patients")
        .select("id,mrn,first_name,middle_name,last_name,sex,date_of_birth,phone,national_id,sha_number,is_deceased,is_vip,created_at")
        .eq("hospital_id", hospitalId!)
        .is("merged_into", null)
        .order("created_at", { ascending: false })
        .limit(100);
      const term = q.trim();
      if (term.length >= 2) {
        query = query.or(
          [
            `first_name.ilike.%${term}%`,
            `last_name.ilike.%${term}%`,
            `middle_name.ilike.%${term}%`,
            `mrn.ilike.%${term}%`,
            `phone.ilike.%${term}%`,
            `national_id.ilike.%${term}%`,
            `sha_number.ilike.%${term}%`,
          ].join(","),
        );
      }
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  if (loading || !user) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  }

  if (!hospitalId) {
    return (
      <Shell>
        <Card><CardContent className="py-16 text-center text-sm text-muted-foreground">
          <AlertTriangle className="mx-auto mb-3 h-6 w-6" />
          You aren't linked to a hospital yet. Ask an admin to invite you, or complete onboarding.
        </CardContent></Card>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Patients</h1>
          <p className="text-sm text-muted-foreground">Search and register patients for this hospital.</p>
        </div>
        <Link to="/patients/new">
          <Button><UserPlus className="mr-2 h-4 w-4" />Register patient</Button>
        </Link>
      </div>

      <div className="mb-4 relative max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, MRN, phone, national ID, SHA number…"
          className="pl-9"
        />
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">MRN</th>
                <th className="px-4 py-2 text-left">Name</th>
                <th className="px-4 py-2 text-left">Sex</th>
                <th className="px-4 py-2 text-left">DOB / Age</th>
                <th className="px-4 py-2 text-left">Phone</th>
                <th className="px-4 py-2 text-left">National ID</th>
                <th className="px-4 py-2 text-left">SHA</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
              )}
              {!isLoading && patients.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                  {q ? "No matches." : "No patients yet. Register the first one."}
                </td></tr>
              )}
              {patients.map((p) => (
                <tr key={p.id} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-2 font-mono text-xs">{p.mrn}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{[p.first_name, p.middle_name, p.last_name].filter(Boolean).join(" ")}</span>
                      {p.is_vip && <Badge variant="secondary" className="text-[10px]">VIP</Badge>}
                      {p.is_deceased && <Badge variant="destructive" className="text-[10px]">Deceased</Badge>}
                    </div>
                  </td>
                  <td className="px-4 py-2 capitalize">{p.sex}</td>
                  <td className="px-4 py-2">{formatDobAge(p.date_of_birth)}</td>
                  <td className="px-4 py-2">{p.phone ?? "—"}</td>
                  <td className="px-4 py-2">{p.national_id ?? "—"}</td>
                  <td className="px-4 py-2">{p.sha_number ?? "—"}</td>
                  <td className="px-4 py-2 text-right">
                    <Link to="/patients/$id" params={{ id: p.id }}>
                      <Button size="sm" variant="ghost">Open</Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-secondary/20">
      <header className="border-b bg-background">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Stethoscope className="h-4 w-4" />
            </div>
            <span className="font-semibold tracking-tight">Afyacore HMIS</span>
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <Link to="/hospital"><Button size="sm" variant="ghost">Dashboard</Button></Link>
            <Link to="/patients"><Button size="sm" variant="ghost">Patients</Button></Link>
          </nav>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">{children}</main>
    </div>
  );
}

function formatDobAge(dob: string | null | undefined) {
  if (!dob) return "—";
  const d = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return `${dob} · ${age}y`;
}
