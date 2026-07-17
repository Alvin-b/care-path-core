import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";

// SHA status callbacks land here. Configured on the SHA side per facility to POST to
//   /api/public/sha/callback/<hospital_id>
// Auth: HTTP Basic (username + password stored in sha_settings), OR X-Callback-Secret
// matching sha_settings.callback_secret. Body is a FHIR ClaimResponse or an
// arbitrary status envelope; we persist it against the bundle and update state.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Callback-Secret",
} as const;

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

// State mapping: SHA's claim-state extension → our enum
const STATE_MAP: Record<string, string> = {
  queued: "queued",
  approved: "approved",
  rejected: "rejected",
  "in-review": "in-review",
  "clinical-review": "clinical-review",
  "sent-for-payment-processing": "sent-for-payment-processing",
  "sent-to-surveillance": "sent-to-surveillance",
  "payment-completed": "payment-completed",
  "payment-declined": "payment-declined",
};

function extractState(body: unknown): { state: string | null; bundleId: string | null; claimRef: string | null; paidAmount: number | null } {
  let state: string | null = null;
  let bundleId: string | null = null;
  let claimRef: string | null = null;
  let paidAmount: number | null = null;
  const b = body as Record<string, unknown> | undefined;
  if (!b) return { state, bundleId, claimRef, paidAmount };

  // Common flat envelopes
  if (typeof b.state === "string") state = b.state;
  if (typeof b.status === "string" && !state) state = b.status;
  if (typeof b.bundle_id === "string") bundleId = b.bundle_id;
  if (typeof b.bundleId === "string" && !bundleId) bundleId = b.bundleId;
  if (typeof b.claim_id === "string") claimRef = b.claim_id;
  if (typeof b.claimId === "string" && !claimRef) claimRef = b.claimId;
  if (typeof b.paid_amount === "number") paidAmount = b.paid_amount;

  // FHIR ClaimResponse-ish
  const entry = (b.entry ?? []) as Array<{ resource?: Record<string, unknown> }>;
  for (const e of entry) {
    const r = e.resource;
    if (!r) continue;
    if (r.resourceType === "ClaimResponse") {
      const ext = (r.extension ?? []) as Array<{ url?: string; valueString?: string; valueDecimal?: number }>;
      for (const x of ext) {
        if (x.url?.endsWith("/claim-state") && typeof x.valueString === "string") state = x.valueString;
        if (x.url?.endsWith("/paid-amount") && typeof x.valueDecimal === "number") paidAmount = x.valueDecimal;
      }
      const req = (r.request as Record<string, unknown> | undefined) ?? undefined;
      const reqId = (req?.identifier as Record<string, unknown> | undefined)?.value;
      if (!claimRef && typeof reqId === "string") claimRef = reqId;
    }
  }
  return { state, bundleId, claimRef, paidAmount };
}

export const Route = createFileRoute("/api/public/sha/callback/$hospitalId")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request, params }) => {
        const hospitalId = params.hospitalId;
        const raw = await request.text();

        // Load settings via service role to check auth
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: s } = await supabaseAdmin
          .from("sha_settings")
          .select("callback_secret,callback_basic_user,callback_basic_pass")
          .eq("hospital_id", hospitalId)
          .maybeSingle();
        if (!s) {
          return new Response(JSON.stringify({ error: "unknown_hospital" }), {
            status: 404,
            headers: { "Content-Type": "application/json", ...CORS },
          });
        }

        let authed = false;
        const secretHeader = request.headers.get("x-callback-secret");
        if (s.callback_secret && secretHeader && safeEqual(secretHeader, s.callback_secret)) {
          authed = true;
        }
        const basic = request.headers.get("authorization");
        if (!authed && basic?.toLowerCase().startsWith("basic ")) {
          try {
            const decoded = Buffer.from(basic.slice(6).trim(), "base64").toString("utf8");
            const [u, p] = decoded.split(":");
            if (
              s.callback_basic_user &&
              s.callback_basic_pass &&
              safeEqual(u ?? "", s.callback_basic_user) &&
              safeEqual(p ?? "", s.callback_basic_pass)
            ) {
              authed = true;
            }
          } catch { /* ignored */ }
        }
        if (!authed) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json", ...CORS },
          });
        }

        let body: unknown;
        try { body = raw ? JSON.parse(raw) : null; } catch { body = { raw }; }
        const { state, bundleId, claimRef, paidAmount } = extractState(body);

        let claimQ = supabaseAdmin.from("sha_claims").select("id,hospital_id,state").eq("hospital_id", hospitalId);
        if (bundleId) claimQ = claimQ.eq("bundle_id", bundleId);
        else if (claimRef) claimQ = claimQ.eq("claim_ref", claimRef);
        else {
          return new Response(JSON.stringify({ error: "missing_bundle_or_claim_id" }), {
            status: 400,
            headers: { "Content-Type": "application/json", ...CORS },
          });
        }
        const { data: claim } = await claimQ.maybeSingle();
        if (!claim) {
          return new Response(JSON.stringify({ error: "claim_not_found" }), {
            status: 404,
            headers: { "Content-Type": "application/json", ...CORS },
          });
        }

        const mapped = state ? STATE_MAP[state] ?? null : null;
        const updates: Record<string, unknown> = {
          last_state_at: new Date().toISOString(),
          response_payload: body as never,
        };
        if (mapped) updates.state = mapped;
        if (mapped === "payment-completed" && paidAmount !== null) {
          updates.paid_amount = paidAmount;
          updates.paid_at = new Date().toISOString();
        }
        await supabaseAdmin.from("sha_claims").update(updates as never).eq("id", claim.id);
        await supabaseAdmin.from("sha_claim_events").insert({
          claim_id: claim.id,
          hospital_id: claim.hospital_id,
          event_type: "callback",
          from_state: claim.state,
          to_state: mapped ?? claim.state,
          http_status: 200,
          message: state ? `SHA callback: ${state}` : "SHA callback",
          payload: body as never,
        } as never);

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...CORS },
        });
      },
    },
  },
});
