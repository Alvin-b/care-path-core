import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Clock } from "lucide-react";

const priorityColor = (p: string) =>
  p === "emergency" ? "destructive" : p === "urgent" ? "default" : "secondary";

export function PatientReferrals({ patientId }: { patientId: string }) {
  const { data: referrals = [] } = useQuery({
    queryKey: ["patient-referrals", patientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("referrals")
        .select("id, priority, reason, status, queue_number, queue_date, created_at, completed_at, from_department:departments!referrals_from_department_id_fkey(name), to_department:departments!referrals_to_department_id_fkey(name)")
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  if (!referrals.length) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Referrals history</CardTitle>
        <CardDescription>Where this patient has been sent inside the facility.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {referrals.map((r) => (
          <div key={r.id} className="flex items-center justify-between rounded-md border bg-background p-3 text-sm">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium truncate">
                  {r.from_department?.name ?? "Reception"} <ArrowRight className="inline h-3.5 w-3.5" /> {r.to_department?.name}
                </span>
                <Badge variant={priorityColor(r.priority) as never} className="capitalize">{r.priority}</Badge>
                <Badge variant="outline" className="capitalize">{r.status.replace("_", " ")}</Badge>
                {r.queue_number != null && (
                  <span className="text-xs text-muted-foreground">Queue #{r.queue_number}</span>
                )}
              </div>
              {r.reason && <div className="text-xs text-muted-foreground truncate">{r.reason}</div>}
            </div>
            <div className="ml-3 shrink-0 flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {new Date(r.created_at).toLocaleString()}
            </div>
          </div>
        ))}
        <Link to="/queue" className="text-xs text-primary hover:underline">Open department queues →</Link>
      </CardContent>
    </Card>
  );
}
