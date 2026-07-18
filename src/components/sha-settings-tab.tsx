import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Copy, ShieldCheck, ShieldOff, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { shaGetSettings, shaSaveSettings, shaTestConnection } from "@/lib/sha.functions";

type Patch = {
  enabled?: boolean;
  environment?: "sandbox" | "production";
  base_url?: string;
  fhir_base_url?: string;
  facility_code?: string | null;
  facility_level?: string | null;
  token_url?: string | null;
  client_id?: string | null;
  client_secret?: string | null;
  callback_secret?: string | null;
  callback_basic_user?: string | null;
  callback_basic_pass?: string | null;
};

const SANDBOX = {
  base_url: "https://ilm-dev.dha.go.ke/uat-middleware/api/v1",
  fhir_base_url: "https://ilm-dev.dha.go.ke/uat-middleware/api",
  token_url: "https://ilm-dev.dha.go.ke/auth/realms/hie/protocol/openid-connect/token",
};

export function ShaSettingsTab({ hospitalId }: { hospitalId: string }) {
  const qc = useQueryClient();
  const getSettings = useServerFn(shaGetSettings);
  const saveSettings = useServerFn(shaSaveSettings);
  const testConn = useServerFn(shaTestConnection);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["sha-settings", hospitalId],
    queryFn: () => getSettings({ data: { hospitalId } }),
  });

  const [form, setForm] = useState<Patch>({});
  useEffect(() => {
    if (settings) {
      setForm({
        enabled: settings.enabled,
        environment: settings.environment,
        base_url: settings.base_url,
        fhir_base_url: settings.fhir_base_url,
        facility_code: settings.facility_code,
        facility_level: settings.facility_level,
        token_url: settings.token_url,
        client_id: settings.client_id,
        callback_basic_user: settings.callback_basic_user,
        client_secret: "",
        callback_secret: "",
        callback_basic_pass: "",
      });
    } else if (!isLoading) {
      setForm({
        enabled: false,
        environment: "sandbox",
        base_url: SANDBOX.base_url,
        fhir_base_url: SANDBOX.fhir_base_url,
        token_url: SANDBOX.token_url,
      });
    }
  }, [settings, isLoading]);

  const save = useMutation({
    mutationFn: () => saveSettings({ data: { hospitalId, patch: form } }),
    onSuccess: () => {
      toast.success("SHA settings saved");
      qc.invalidateQueries({ queryKey: ["sha-settings", hospitalId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const test = useMutation({
    mutationFn: () => testConn({ data: { hospitalId } }),
    onSuccess: (r) => {
      if (r.ok) toast.success(`Connected — token ${r.tokenPreview}`);
      else toast.error(r.message);
      qc.invalidateQueries({ queryKey: ["sha-settings", hospitalId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const callbackUrl = typeof window !== "undefined"
    ? `${window.location.origin}/api/public/sha/callback/${hospitalId}`
    : "";

  const bind = (k: keyof Patch) => ({
    value: (form[k] as string) ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value }),
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <Card>
        <CardHeader>
          <CardTitle>SHA / Afyalink integration</CardTitle>
          <CardDescription>
            Connect this facility to the Social Health Authority for eligibility checks and claims dispatch.
            Sandbox defaults point to <code className="text-xs">ilm-dev.dha.go.ke</code>; switch to production
            when you have live credentials.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2 flex items-center justify-between rounded-md border bg-background p-3">
            <div>
              <div className="font-medium">Integration enabled</div>
              <div className="text-xs text-muted-foreground">
                When off, eligibility and claim buttons stay hidden across the app.
              </div>
            </div>
            <Switch
              checked={!!form.enabled}
              onCheckedChange={(v) => setForm({ ...form, enabled: v })}
            />
          </div>

          <div>
            <Label>Environment</Label>
            <Select
              value={form.environment ?? "sandbox"}
              onValueChange={(v) => setForm({ ...form, environment: v as "sandbox" | "production" })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sandbox">Sandbox (ilm-dev)</SelectItem>
                <SelectItem value="production">Production</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Facility level</Label>
            <Input placeholder="Level 2 / Level 4 …" {...bind("facility_level")} />
          </div>
          <div className="sm:col-span-2">
            <Label>Facility code (FR / FID)</Label>
            <Input placeholder="FID-…" {...bind("facility_code")} />
          </div>

          <div className="sm:col-span-2">
            <Label>API base URL</Label>
            <Input {...bind("base_url")} />
          </div>
          <div className="sm:col-span-2">
            <Label>FHIR base URL</Label>
            <Input {...bind("fhir_base_url")} />
          </div>
          <div className="sm:col-span-2">
            <Label>OAuth token URL</Label>
            <Input {...bind("token_url")} />
          </div>
          <div>
            <Label>Client ID</Label>
            <Input {...bind("client_id")} />
          </div>
          <div>
            <Label>Client secret</Label>
            <Input
              type="password"
              placeholder={settings?.has_client_secret ? "•••• saved — leave blank to keep" : "Paste secret"}
              {...bind("client_secret")}
            />
          </div>

          <div className="sm:col-span-2 mt-4 border-t pt-4">
            <div className="mb-2 text-sm font-medium">Callback authentication</div>
            <p className="text-xs text-muted-foreground">
              SHA posts asynchronous status updates to your callback URL. Configure either a shared secret
              header or HTTP Basic on the SHA side, then mirror it here so we can verify inbound requests.
            </p>
          </div>
          <div className="sm:col-span-2">
            <Label>Callback shared secret</Label>
            <Input
              type="password"
              placeholder={settings?.has_callback_secret ? "•••• saved — leave blank to keep" : ""}
              {...bind("callback_secret")}
            />
          </div>
          <div>
            <Label>Callback basic user</Label>
            <Input {...bind("callback_basic_user")} />
          </div>
          <div>
            <Label>Callback basic password</Label>
            <Input
              type="password"
              placeholder={settings?.has_callback_basic_pass ? "•••• saved — leave blank to keep" : ""}
              {...bind("callback_basic_pass")}
            />
          </div>

          <div className="sm:col-span-2 flex flex-wrap items-center gap-2 pt-2">
            <Button disabled={save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? "Saving…" : "Save settings"}
            </Button>
            <Button variant="outline" disabled={test.isPending || !settings} onClick={() => test.mutate()}>
              {test.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              Test connection
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Status</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              {settings?.enabled ? (
                <><ShieldCheck className="h-4 w-4 text-green-600" /><span>Enabled</span></>
              ) : (
                <><ShieldOff className="h-4 w-4 text-muted-foreground" /><span className="text-muted-foreground">Disabled</span></>
              )}
              {settings?.environment && (
                <Badge variant="outline" className="ml-auto uppercase">{settings.environment}</Badge>
              )}
            </div>
            <div className="text-muted-foreground">
              Facility: <span className="text-foreground">{settings?.facility_code ?? "—"}</span>
            </div>
            <div className="text-muted-foreground">
              Last test:{" "}
              {settings?.last_test_at
                ? <span className={settings.last_test_ok ? "text-green-600" : "text-destructive"}>
                    {new Date(settings.last_test_at).toLocaleString()} · {settings.last_test_ok ? "ok" : "failed"}
                  </span>
                : <span className="text-foreground">never</span>}
            </div>
            {settings?.last_test_message && (
              <div className="rounded bg-muted p-2 text-xs">{settings.last_test_message}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Callback URL</CardTitle>
            <CardDescription>Give this to SHA when registering your facility.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Input readOnly value={callbackUrl} />
              <Button size="icon" variant="outline" onClick={() => { navigator.clipboard.writeText(callbackUrl); toast.success("URL copied"); }}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Handles queued, in-review, approved, payment-completed and rejected events from SHA and updates the matching claim automatically.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
