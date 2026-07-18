import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Send, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Priority = "routine" | "urgent" | "emergency";

export function ReferPatientDialog({
  patientId,
  hospitalId,
  patientName,
  triggerLabel = "Refer patient",
}: {
  patientId: string;
  hospitalId: string;
  patientName?: string;
  triggerLabel?: string;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [toDept, setToDept] = useState<string>("");
  const [priority, setPriority] = useState<Priority>("routine");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  const { data: departments = [] } = useQuery({
    queryKey: ["departments", hospitalId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departments")
        .select("id,name,code")
        .eq("hospital_id", hospitalId)
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const submit = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("create_referral", {
        _patient_id: patientId,
        _to_department_id: toDept,
        _priority: priority,
        _reason: reason,
        _clinical_notes: notes || "",
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Referral sent — the receiving department has been notified.");
      qc.invalidateQueries({ queryKey: ["patient-referrals", patientId] });
      qc.invalidateQueries({ queryKey: ["department-queue"] });
      setOpen(false);
      setToDept(""); setReason(""); setNotes(""); setPriority("routine");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Send className="mr-1 h-4 w-4" />{triggerLabel}</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Refer {patientName ?? "patient"}</DialogTitle>
          <DialogDescription>
            Send this patient to another department. They will be added to that department's queue
            and staff on duty will get an in-app notification.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>Send to department</Label>
            <Select value={toDept} onValueChange={setToDept}>
              <SelectTrigger><SelectValue placeholder="Choose a department" /></SelectTrigger>
              <SelectContent>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}{d.code ? ` · ${d.code}` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs text-muted-foreground">
              Your role controls which departments you can refer to. Not-allowed choices will be rejected on submit.
            </p>
          </div>

          <div>
            <Label>Priority</Label>
            <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="routine">Routine</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="emergency">Emergency</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Reason for referral</Label>
            <Textarea
              rows={2}
              placeholder="e.g. Chest X-ray to rule out pneumonia"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <div>
            <Label>Clinical notes / instructions</Label>
            <Textarea
              rows={4}
              placeholder="Diagnostics, working diagnosis, medications given, anything the receiving team needs to know…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            disabled={!toDept || !reason.trim() || submit.isPending}
            onClick={() => submit.mutate()}
          >
            {submit.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Send className="mr-1 h-4 w-4" />}
            Send referral
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
