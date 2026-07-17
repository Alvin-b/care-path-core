import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";

const asJson = (v: unknown): Json => JSON.parse(JSON.stringify(v ?? null)) as Json;
const asStr = (v: unknown): string | null => (typeof v === "string" ? v : null);

/**
 * SHA / Afyalink server functions.
 *
 * Every handler:
 *  1. Runs under requireSupabaseAuth (attaches an RLS-scoped supabase client
 *     as `context.supabase`, plus `context.userId`).
 *  2. Verifies the caller is a member (or admin) of the target hospital.
 *  3. Dynamically imports `./sha.server` — that module holds admin-key
 *     operations and must never load into the client bundle.
 */

async function assertMember(supabase: unknown, hospitalId: string) {
  const s = supabase as {
    rpc: (name: string, args: unknown) => Promise<{ data: boolean | null; error: { message: string } | null }>;
  };
  const { data, error } = await s.rpc("is_hospital_member", { _hospital_id: hospitalId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: not a member of this hospital.");
}
async function assertAdmin(supabase: unknown, hospitalId: string) {
  const s = supabase as {
    rpc: (name: string, args: unknown) => Promise<{ data: boolean | null; error: { message: string } | null }>;
  };
  const { data, error } = await s.rpc("is_hospital_admin", { _hospital_id: hospitalId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: hospital admin only.");
}

// ------------------- Settings -------------------

const HospitalOnly = z.object({ hospitalId: z.string().uuid() });

export const shaGetSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => HospitalOnly.parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, data.hospitalId);
    const mod = await import("./sha.server");
    return mod.getSettingsRedacted(data.hospitalId);
  });

const SettingsPatch = z.object({
  hospitalId: z.string().uuid(),
  patch: z.object({
    enabled: z.boolean().optional(),
    environment: z.enum(["sandbox", "production"]).optional(),
    base_url: z.string().url().optional(),
    fhir_base_url: z.string().url().optional(),
    facility_code: z.string().nullable().optional(),
    facility_level: z.string().nullable().optional(),
    token_url: z.string().url().nullable().optional(),
    client_id: z.string().nullable().optional(),
    client_secret: z.string().nullable().optional(),
    callback_secret: z.string().nullable().optional(),
    callback_basic_user: z.string().nullable().optional(),
    callback_basic_pass: z.string().nullable().optional(),
  }),
});

export const shaSaveSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => SettingsPatch.parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, data.hospitalId);
    const mod = await import("./sha.server");
    // Empty string on secret fields = leave alone (undefined). null explicit = clear.
    const patch: Record<string, unknown> = { ...data.patch };
    for (const k of ["client_secret", "callback_secret", "callback_basic_pass"] as const) {
      if (patch[k] === "") delete patch[k];
    }
    await mod.saveSettings(data.hospitalId, context.userId, patch);
    return { ok: true };
  });

export const shaTestConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => HospitalOnly.parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, data.hospitalId);
    const mod = await import("./sha.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    try {
      const token = await mod.getAccessToken(data.hospitalId);
      await supabaseAdmin.from("sha_settings").update({
        last_test_at: new Date().toISOString(),
        last_test_ok: true,
        last_test_message: "Token acquired.",
      } as never).eq("hospital_id", data.hospitalId);
      return { ok: true, message: "Token acquired.", tokenPreview: token.slice(0, 12) + "…" };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await supabaseAdmin.from("sha_settings").update({
        last_test_at: new Date().toISOString(),
        last_test_ok: false,
        last_test_message: message,
      } as never).eq("hospital_id", data.hospitalId);
      return { ok: false, message };
    }
  });

// ------------------- Eligibility -------------------

const EligibilityInput = z.object({
  hospitalId: z.string().uuid(),
  patientId: z.string().uuid().optional(),
  identificationType: z.enum([
    "National ID",
    "Alien ID",
    "Mandate Number",
    "Temporary ID",
    "SHA Number",
    "Refugee ID",
    "Passport",
    "Birth Certificate",
  ]),
  identificationNumber: z.string().min(3).max(64),
});

export const shaCheckEligibility = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => EligibilityInput.parse(raw))
  .handler(async ({ data, context }) => {
    await assertMember(context.supabase, data.hospitalId);
    const mod = await import("./sha.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let res;
    try {
      res = await mod.shaFetch<{ message?: Record<string, unknown> }>(
        data.hospitalId,
        "/patients/eligibility",
        {
          query: {
            identification_type: data.identificationType,
            identification_number: data.identificationNumber,
          },
        },
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await supabaseAdmin.from("sha_eligibility_checks").insert({
        hospital_id: data.hospitalId,
        patient_id: data.patientId ?? null,
        identification_type: data.identificationType,
        identification_number: data.identificationNumber,
        error_message: message,
        checked_by: context.userId,
      } as never);
      throw new Error(message);
    }

    const msg = (res.data?.message ?? {}) as Record<string, unknown>;
    const eligible = msg.eligible === 1 || msg.eligible === true;
    const cr_id = typeof msg.id === "string" ? msg.id : null;
    const insertRes = await supabaseAdmin
      .from("sha_eligibility_checks")
      .insert({
        hospital_id: data.hospitalId,
        patient_id: data.patientId ?? null,
        identification_type: data.identificationType,
        identification_number: data.identificationNumber,
        eligible,
        cr_id,
        sha_number:
          data.identificationType === "SHA Number"
            ? data.identificationNumber
            : (typeof msg.sha_number === "string" ? msg.sha_number : null),
        full_name: typeof msg.full_name === "string" ? msg.full_name : null,
        coverage_end_date:
          typeof msg.coverageEndDate === "string" ? msg.coverageEndDate : null,
        message: typeof msg.message === "string" ? msg.message : null,
        reason: typeof msg.reason === "string" ? msg.reason : null,
        possible_solution:
          typeof msg.possible_solution === "string" ? msg.possible_solution : null,
        response_payload: res.data as never,
        http_status: res.status,
        error_message: res.ok ? null : res.error ?? null,
        checked_by: context.userId,
      } as never)
      .select("id")
      .single();
    if (insertRes.error) throw new Error(insertRes.error.message);

    // Cache CR ID on the patient for later claim building.
    if (data.patientId && cr_id) {
      await supabaseAdmin
        .from("patients")
        .update({ sha_cr_id: cr_id } as never)
        .eq("id", data.patientId);
    }

    return {
      checkId: insertRes.data.id as string,
      ok: res.ok,
      eligible,
      cr_id,
      full_name: asStr(msg.full_name),
      coverageEndDate: asStr(msg.coverageEndDate),
      message: asStr(msg.message),
      reason: asStr(msg.reason),
      possible_solution: asStr(msg.possible_solution),
      raw: asJson(res.data),
      status: res.status,
    };
  });

const BenefitsInput = z.object({
  hospitalId: z.string().uuid(),
  patientId: z.string().uuid().optional(),
  crId: z.string().min(3),
});

export const shaGetPatientBenefits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => BenefitsInput.parse(raw))
  .handler(async ({ data, context }) => {
    await assertMember(context.supabase, data.hospitalId);
    const mod = await import("./sha.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const res = await mod.shaFetch(data.hospitalId, "/patients/benefits", {
      query: { patient_id: data.crId },
    });
    await supabaseAdmin.from("sha_eligibility_checks").insert({
      hospital_id: data.hospitalId,
      patient_id: data.patientId ?? null,
      identification_type: "CR ID",
      identification_number: data.crId,
      check_kind: "benefits",
      cr_id: data.crId,
      response_payload: res.data as never,
      http_status: res.status,
      error_message: res.ok ? null : res.error ?? null,
      checked_by: context.userId,
    } as never);
    return { ok: res.ok, status: res.status, data: asJson(res.data) };
  });

// ------------------- Claims -------------------

const CreateClaimInput = z.object({
  hospitalId: z.string().uuid(),
  patientId: z.string().uuid(),
  claimType: z.enum(["claim", "preauth"]).default("claim"),
  subtype: z.enum(["op", "ip", "emg"]).default("op"),
  practitioner_puid: z.string().nullable().optional(),
  practitioner_name: z.string().nullable().optional(),
  billable_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  billable_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  diagnoses: z
    .array(z.object({ code: z.string().min(1), display: z.string().min(1) }))
    .min(1),
  items: z
    .array(
      z.object({
        code: z.string().min(1),
        display: z.string().optional(),
        quantity: z.number().positive(),
        unitPrice: z.number().nonnegative(),
        servicedStart: z.string().optional(),
        servicedEnd: z.string().optional(),
      }),
    )
    .min(1),
  currency: z.string().default("KES"),
});

export const shaCreateClaim = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => CreateClaimInput.parse(raw))
  .handler(async ({ data, context }) => {
    await assertMember(context.supabase, data.hospitalId);
    const { data: patient, error: pErr } = await context.supabase
      .from("patients")
      .select("id,hospital_id,sha_cr_id,sha_number,first_name,middle_name,last_name,sex,date_of_birth")
      .eq("id", data.patientId)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!patient) throw new Error("Patient not found.");
    if (!patient.sha_cr_id) {
      throw new Error("This patient has no cached SHA CR ID — run an eligibility check first.");
    }
    const total = data.items.reduce((acc, it) => acc + it.quantity * it.unitPrice, 0);
    const { data: claim, error } = await context.supabase
      .from("sha_claims")
      .insert({
        hospital_id: data.hospitalId,
        patient_id: data.patientId,
        claim_type: data.claimType,
        subtype: data.subtype,
        cr_id: patient.sha_cr_id,
        sha_number: patient.sha_number,
        practitioner_puid: data.practitioner_puid ?? null,
        practitioner_name: data.practitioner_name ?? null,
        billable_start: data.billable_start,
        billable_end: data.billable_end,
        diagnoses: data.diagnoses as never,
        items: data.items as never,
        total_amount: total,
        currency: data.currency,
        state: "draft",
        created_by: context.userId,
      } as never)
      .select("id,bundle_id,claim_ref")
      .single();
    if (error) throw new Error(error.message);
    return claim;
  });

const ClaimAction = z.object({
  hospitalId: z.string().uuid(),
  claimId: z.string().uuid(),
});

export const shaSubmitClaim = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => ClaimAction.parse(raw))
  .handler(async ({ data, context }) => {
    await assertMember(context.supabase, data.hospitalId);

    const { data: claim, error } = await context.supabase
      .from("sha_claims")
      .select("*")
      .eq("id", data.claimId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!claim) throw new Error("Claim not found.");
    if (claim.state !== "draft" && claim.state !== "error" && claim.state !== "rejected") {
      throw new Error(`Claim is already ${claim.state}; cannot resubmit.`);
    }

    const { data: patient, error: pErr } = await context.supabase
      .from("patients")
      .select("first_name,middle_name,last_name,sex,date_of_birth")
      .eq("id", claim.patient_id)
      .single();
    if (pErr) throw new Error(pErr.message);

    const { data: hospital, error: hErr } = await context.supabase
      .from("hospitals")
      .select("name")
      .eq("id", claim.hospital_id)
      .single();
    if (hErr) throw new Error(hErr.message);

    const mod = await import("./sha.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const settings = await mod.getSettings(claim.hospital_id);
    if (!settings) throw new Error("SHA is not configured for this hospital.");
    if (!settings.enabled) throw new Error("SHA integration is disabled for this hospital.");

    const bundle = mod.buildClaimBundle(
      {
        bundle_id: claim.bundle_id,
        claim_ref: claim.claim_ref,
        claim_type: claim.claim_type as "claim" | "preauth",
        subtype: claim.subtype as "op" | "ip" | "emg",
        cr_id: claim.cr_id!,
        sha_number: claim.sha_number,
        patient,
        practitioner_puid: claim.practitioner_puid,
        practitioner_name: claim.practitioner_name,
        billable_start: claim.billable_start!,
        billable_end: claim.billable_end!,
        diagnoses: claim.diagnoses as Array<{ code: string; display: string }>,
        items: claim.items as ClaimItem[],
        total_amount: Number(claim.total_amount),
        currency: claim.currency,
      },
      settings,
      hospital.name,
    );

    const res = await mod.shaFetch(claim.hospital_id, "/v1/shr-med/bundle", {
      method: "POST",
      body: bundle,
    });

    const nextState: string = res.ok ? "submitted" : "error";
    await supabaseAdmin
      .from("sha_claims")
      .update({
        state: nextState,
        last_state_at: new Date().toISOString(),
        request_bundle: bundle as never,
        response_payload: res.data as never,
        http_status: res.status,
        error_message: res.ok ? null : res.error ?? null,
        submitted_at: res.ok ? new Date().toISOString() : claim.submitted_at,
        submitted_by: res.ok ? context.userId : claim.submitted_by,
      } as never)
      .eq("id", claim.id);
    await supabaseAdmin.from("sha_claim_events").insert({
      claim_id: claim.id,
      hospital_id: claim.hospital_id,
      event_type: "submit",
      from_state: claim.state,
      to_state: nextState,
      http_status: res.status,
      message: res.ok ? "Claim submitted to SHA" : res.error,
      payload: res.data as never,
      actor: context.userId,
    } as never);

    if (!res.ok) throw new Error(res.error ?? "SHA submission failed.");
    return { ok: true, status: res.status };
  });

export const shaGetClaimStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => ClaimAction.parse(raw))
  .handler(async ({ data, context }) => {
    await assertMember(context.supabase, data.hospitalId);
    const { data: claim, error } = await context.supabase
      .from("sha_claims")
      .select("id,hospital_id,bundle_id,state")
      .eq("id", data.claimId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!claim) throw new Error("Claim not found.");

    const mod = await import("./sha.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const res = await mod.shaFetch(claim.hospital_id, "/v1/shr-med/claim-status", {
      query: { bundle_id: claim.bundle_id },
    });

    await supabaseAdmin.from("sha_claim_events").insert({
      claim_id: claim.id,
      hospital_id: claim.hospital_id,
      event_type: "status",
      from_state: claim.state,
      to_state: claim.state,
      http_status: res.status,
      message: res.ok ? "Fetched claim status" : res.error,
      payload: res.data as never,
      actor: context.userId,
    } as never);

    if (!res.ok) throw new Error(res.error ?? "Status fetch failed.");
    return { ok: true as const, data: asJson(res.data) };
  });

type ClaimItem = {
  code: string;
  display?: string;
  quantity: number;
  unitPrice: number;
  servicedStart?: string;
  servicedEnd?: string;
};
