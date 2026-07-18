import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ShieldCheck, ShieldAlert } from "lucide-react";
import { shaCheckEligibility } from "@/lib/sha.functions";

type IdType =
  | "National ID"
  | "Alien ID"
  | "Mandate Number"
  | "Temporary ID"
  | "SHA Number"
  | "Refugee ID"
  | "Passport"
  | "Birth Certificate";

const ID_TYPES: IdType[] = [
  "National ID", "SHA Number", "Passport", "Alien ID",
  "Refugee ID", "Birth Certificate", "Mandate Number", "Temporary ID",
];

type Result = {
  eligible: boolean;
  cr_id: string | null;
  full_name: string | null;
  coverageEndDate: string | null;
  message: string | null;
  reason: string | null;
  possible_solution: string | null;
};

export function ShaEligibilityCard({
  hospitalId,
  patientId,
  defaultShaNumber,
  defaultNationalId,
}: {
  hospitalId: string;
  patientId: string;
  defaultShaNumber?: string | null;
  defaultNationalId?: string | null;
}) {
  const check = useServerFn(shaCheckEligibility);
  const [idType, setIdType] = useState<IdType>(defaultShaNumber ? "SHA Number" : "National ID");
  const [idNumber, setIdNumber] = useState<string>(
    defaultShaNumber ?? defaultNationalId ?? "",
  );
  const [result, setResult] = useState<Result | null>(null);

  const mut = useMutation({
    mutationFn: async () =>
      check({
        data: {
          hospitalId,
          patientId,
          identificationType: idType,
          identificationNumber: idNumber.trim(),
        },
      }),
    onSuccess: (r) => {
      setResult({
        eligible: r.eligible,
        cr_id: r.cr_id,
        full_name: r.full_name,
        coverageEndDate: r.coverageEndDate,
        message: r.message,
        reason: r.reason,
        possible_solution: r.possible_solution,
      });
      if (r.eligible) toast.success("Patient is SHA-eligible");
      else toast.warning(r.reason ?? r.message ?? "Not eligible");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldCheck className="h-4 w-4" /> SHA eligibility
        </CardTitle>
        <CardDescription>
          Verify Social Health Authority coverage. On success we cache the CR ID for claims.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-[180px_1fr_auto]">
          <div>
            <Label>Identification type</Label>
            <Select value={idType} onValueChange={(v) => setIdType(v as IdType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ID_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Number</Label>
            <Input value={idNumber} onChange={(e) => setIdNumber(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button
              disabled={mut.isPending || idNumber.trim().length < 3}
              onClick={() => mut.mutate()}
            >
              {mut.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              Check
            </Button>
          </div>
        </div>

        {result && (
          <div className={`rounded-md border p-3 text-sm ${
            result.eligible
              ? "border-green-200 bg-green-50/60 dark:border-green-900/40 dark:bg-green-950/20"
              : "border-amber-200 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/20"
          }`}>
            <div className="flex flex-wrap items-center gap-2">
              {result.eligible ? (
                <Badge className="bg-green-600 hover:bg-green-600">Eligible</Badge>
              ) : (
                <Badge variant="destructive" className="gap-1"><ShieldAlert className="h-3 w-3" /> Not eligible</Badge>
              )}
              {result.cr_id && <Badge variant="outline">CR {result.cr_id}</Badge>}
              {result.coverageEndDate && (
                <span className="text-xs text-muted-foreground">
                  Coverage until {result.coverageEndDate}
                </span>
              )}
            </div>
            {result.full_name && (
              <div className="mt-1 text-xs text-muted-foreground">
                SHA name on file: <span className="text-foreground">{result.full_name}</span>
              </div>
            )}
            {(result.message || result.reason) && (
              <div className="mt-2 text-xs">
                {result.reason && <div><b>Reason:</b> {result.reason}</div>}
                {result.message && <div className="text-muted-foreground">{result.message}</div>}
                {result.possible_solution && (
                  <div className="text-muted-foreground"><b>Try:</b> {result.possible_solution}</div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
