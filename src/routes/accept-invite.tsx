import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { CheckCircle2, MailCheck, Stethoscope } from "lucide-react";

type Search = { token?: string };

export const Route = createFileRoute("/accept-invite")({
  head: () => ({ meta: [{ title: "Accept invite — Afyacore HMIS" }] }),
  validateSearch: (s: Record<string, unknown>): Search => ({ token: typeof s.token === "string" ? s.token : undefined }),
  component: AcceptInvite,
});

function AcceptInvite() {
  const { token } = Route.useSearch();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"idle" | "working" | "done" | "error">("idle");
  const [message, setMessage] = useState<string>("");
  const [hospitalName, setHospitalName] = useState<string>("");

  useEffect(() => {
    if (loading || !user || !token) return;
    (async () => {
      setStatus("working");
      const { data: invite, error } = await supabase
        .from("hospital_invites").select("*").eq("token", token).maybeSingle();
      if (error || !invite) { setStatus("error"); setMessage("Invite not found or already used."); return; }
      if (invite.status !== "pending") { setStatus("error"); setMessage(`This invite is ${invite.status}.`); return; }
      if (new Date(invite.expires_at) < new Date()) { setStatus("error"); setMessage("This invite has expired."); return; }
      if (invite.email.toLowerCase() !== (user.email ?? "").toLowerCase()) {
        setStatus("error");
        setMessage(`This invite is for ${invite.email}. Sign in with that email to accept.`);
        return;
      }

      // Attach hospital to profile
      const { error: pErr } = await supabase.from("profiles")
        .update({ hospital_id: invite.hospital_id })
        .eq("id", user.id);
      if (pErr) { setStatus("error"); setMessage(pErr.message); return; }

      // Assign role
      const { error: rErr } = await supabase.from("user_roles").insert({
        user_id: user.id, role: invite.role, hospital_id: invite.hospital_id,
      });
      if (rErr && !rErr.message.toLowerCase().includes("duplicate")) {
        setStatus("error"); setMessage(rErr.message); return;
      }

      // Mark invite accepted
      await supabase.from("hospital_invites").update({
        status: "accepted", accepted_at: new Date().toISOString(), accepted_by: user.id,
      }).eq("id", invite.id);

      // Look up hospital name for confirmation
      const { data: h } = await supabase.from("hospitals").select("name").eq("id", invite.hospital_id).maybeSingle();
      setHospitalName(h?.name ?? "");
      setStatus("done");
      toast.success("Invite accepted");
    })();
  }, [loading, user, token]);

  if (!token) {
    return <Centered><Card className="max-w-md"><CardHeader><CardTitle>Missing invite token</CardTitle><CardDescription>Open the exact link shared with you.</CardDescription></CardHeader></Card></Centered>;
  }
  if (loading) return <Centered>Loading…</Centered>;
  if (!user) {
    return (
      <Centered>
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><MailCheck className="h-5 w-5" /> Sign in to accept</CardTitle>
            <CardDescription>Sign in with the email address the invite was sent to.</CardDescription>
          </CardHeader>
          <CardContent><Button onClick={() => navigate({ to: "/auth", search: { redirect: `/accept-invite?token=${token}` } as never })}>Continue to sign in</Button></CardContent>
        </Card>
      </Centered>
    );
  }

  return (
    <Centered>
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {status === "done" ? <CheckCircle2 className="h-5 w-5 text-primary" /> : <MailCheck className="h-5 w-5" />}
            {status === "done" ? "Welcome aboard" : "Accepting invite…"}
          </CardTitle>
          <CardDescription>
            {status === "working" && "Confirming your invite and assigning your role."}
            {status === "done" && (hospitalName ? `You've been added to ${hospitalName}.` : "You've been added to the hospital.")}
            {status === "error" && message}
          </CardDescription>
        </CardHeader>
        {status === "done" && (
          <CardContent className="flex gap-2">
            <Link to="/hospital"><Button>Open hospital admin</Button></Link>
            <Link to="/"><Button variant="outline">Home</Button></Link>
          </CardContent>
        )}
      </Card>
    </Centered>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-secondary/20">
      <header className="border-b bg-background">
        <div className="container mx-auto flex h-16 items-center px-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Stethoscope className="h-4 w-4" />
            </div>
            <span className="font-semibold tracking-tight">Afyacore HMIS</span>
          </Link>
        </div>
      </header>
      <main className="container mx-auto flex min-h-[70vh] items-center justify-center px-4">{children}</main>
    </div>
  );
}
