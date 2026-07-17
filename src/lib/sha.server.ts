// Server-only helpers for the Kenya SHA / Afyalink integration.
// Imported dynamically from server-function handlers only — never at module
// scope of a client-reachable file.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type ShaSettings = {
  hospital_id: string;
  enabled: boolean;
  environment: "sandbox" | "production";
  base_url: string;
  fhir_base_url: string;
  facility_code: string | null;
  facility_level: string | null;
  token_url: string | null;
  client_id: string | null;
  client_secret: string | null;
  callback_secret: string | null;
  callback_basic_user: string | null;
  callback_basic_pass: string | null;
};

export type ShaSettingsRedacted = Omit<
  ShaSettings,
  "client_secret" | "callback_secret" | "callback_basic_pass"
> & {
  has_client_secret: boolean;
  has_callback_secret: boolean;
  has_callback_basic_pass: boolean;
  last_test_at: string | null;
  last_test_ok: boolean | null;
  last_test_message: string | null;
};

export async function getSettings(hospitalId: string): Promise<ShaSettings | null> {
  const { data, error } = await supabaseAdmin
    .from("sha_settings")
    .select("*")
    .eq("hospital_id", hospitalId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as ShaSettings | null) ?? null;
}

export async function getSettingsRedacted(
  hospitalId: string,
): Promise<ShaSettingsRedacted | null> {
  const { data, error } = await supabaseAdmin
    .from("sha_settings")
    .select("*")
    .eq("hospital_id", hospitalId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const s = data as ShaSettings & {
    last_test_at: string | null;
    last_test_ok: boolean | null;
    last_test_message: string | null;
  };
  return {
    hospital_id: s.hospital_id,
    enabled: s.enabled,
    environment: s.environment,
    base_url: s.base_url,
    fhir_base_url: s.fhir_base_url,
    facility_code: s.facility_code,
    facility_level: s.facility_level,
    token_url: s.token_url,
    client_id: s.client_id,
    callback_basic_user: s.callback_basic_user,
    has_client_secret: !!s.client_secret,
    has_callback_secret: !!s.callback_secret,
    has_callback_basic_pass: !!s.callback_basic_pass,
    last_test_at: s.last_test_at,
    last_test_ok: s.last_test_ok,
    last_test_message: s.last_test_message,
  };
}

export type SettingsPatch = Partial<
  Pick<
    ShaSettings,
    | "enabled"
    | "environment"
    | "base_url"
    | "fhir_base_url"
    | "facility_code"
    | "facility_level"
    | "token_url"
    | "client_id"
    | "callback_basic_user"
  >
> & {
  client_secret?: string | null; // null = clear, undefined = leave alone
  callback_secret?: string | null;
  callback_basic_pass?: string | null;
};

export async function saveSettings(
  hospitalId: string,
  actorId: string,
  patch: SettingsPatch,
) {
  const existing = await getSettings(hospitalId);
  const row: Record<string, unknown> = {
    hospital_id: hospitalId,
    configured_at: new Date().toISOString(),
    configured_by: actorId,
    ...(existing ?? {}),
  };
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined) row[k] = v;
  }
  const { error } = await supabaseAdmin
    .from("sha_settings")
    .upsert(row as never, { onConflict: "hospital_id" });
  if (error) throw new Error(error.message);
}

// ------------------- OAuth2 token cache -------------------

async function fetchAccessToken(s: ShaSettings): Promise<{
  access_token: string;
  expires_in: number;
  token_type?: string;
}> {
  if (!s.token_url || !s.client_id || !s.client_secret) {
    throw new Error("SHA credentials are not fully configured for this hospital.");
  }
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: s.client_id,
    client_secret: s.client_secret,
  });
  const res = await fetch(s.token_url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`SHA token request failed [${res.status}]: ${text}`);
  }
  let json: { access_token?: string; expires_in?: number; token_type?: string };
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`SHA token endpoint returned non-JSON: ${text.slice(0, 200)}`);
  }
  if (!json.access_token) {
    throw new Error(`SHA token response missing access_token: ${text.slice(0, 200)}`);
  }
  return {
    access_token: json.access_token,
    expires_in: json.expires_in ?? 3600,
    token_type: json.token_type ?? "Bearer",
  };
}

export async function getAccessToken(hospitalId: string): Promise<string> {
  const { data: cached } = await supabaseAdmin
    .from("sha_token_cache")
    .select("*")
    .eq("hospital_id", hospitalId)
    .maybeSingle();
  const now = Date.now();
  if (cached && new Date(cached.expires_at).getTime() - 60_000 > now) {
    return cached.access_token as string;
  }
  const s = await getSettings(hospitalId);
  if (!s) throw new Error("SHA settings not configured for this hospital.");
  const tok = await fetchAccessToken(s);
  const expires_at = new Date(now + tok.expires_in * 1000).toISOString();
  const { error } = await supabaseAdmin.from("sha_token_cache").upsert(
    {
      hospital_id: hospitalId,
      access_token: tok.access_token,
      token_type: tok.token_type ?? "Bearer",
      expires_at,
      updated_at: new Date().toISOString(),
    } as never,
    { onConflict: "hospital_id" },
  );
  if (error) throw new Error(error.message);
  return tok.access_token;
}

// ------------------- Authenticated HTTP -------------------

export type ShaResponse<T = unknown> = {
  ok: boolean;
  status: number;
  data: T | null;
  raw: string;
  error?: string;
};

export async function shaFetch<T = unknown>(
  hospitalId: string,
  path: string,
  init: {
    method?: string;
    query?: Record<string, string | number | boolean | undefined>;
    body?: unknown;
    headers?: Record<string, string>;
    baseOverride?: string;
  } = {},
): Promise<ShaResponse<T>> {
  const s = await getSettings(hospitalId);
  if (!s) throw new Error("SHA settings not configured for this hospital.");
  const token = await getAccessToken(hospitalId);
  const base = init.baseOverride ?? s.base_url;
  const url = new URL(path.startsWith("/") ? base + path : `${base}/${path}`);
  if (init.query) {
    for (const [k, v] of Object.entries(init.query)) {
      if (v !== undefined && v !== null && v !== "") {
        url.searchParams.set(k, String(v));
      }
    }
  }
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    ...(s.facility_code
      ? { "X-Facility-Id": s.facility_code, "X-Facility-Id-Type": "fr-code" }
      : {}),
    ...(init.headers ?? {}),
  };
  let body: BodyInit | undefined;
  if (init.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(init.body);
  }
  const res = await fetch(url, { method: init.method ?? "GET", headers, body });
  const raw = await res.text();
  let data: T | null = null;
  try {
    data = raw ? (JSON.parse(raw) as T) : null;
  } catch {
    /* leave as null; raw available */
  }
  return {
    ok: res.ok,
    status: res.status,
    data,
    raw,
    error: res.ok ? undefined : `SHA API [${res.status}]: ${raw.slice(0, 400)}`,
  };
}

// ------------------- FHIR bundle builder -------------------

export type ClaimDraft = {
  bundle_id: string;
  claim_ref: string;
  claim_type: "claim" | "preauth";
  subtype: "op" | "ip" | "emg";
  cr_id: string;
  sha_number: string | null;
  patient: {
    first_name: string | null;
    middle_name: string | null;
    last_name: string | null;
    sex: string | null;
    date_of_birth: string | null;
  };
  practitioner_puid: string | null;
  practitioner_name: string | null;
  billable_start: string;
  billable_end: string;
  diagnoses: Array<{ code: string; display: string }>;
  items: Array<{
    code: string;
    display?: string;
    quantity: number;
    unitPrice: number;
    servicedStart?: string;
    servicedEnd?: string;
  }>;
  total_amount: number;
  currency: string;
};

export function buildClaimBundle(
  draft: ClaimDraft,
  s: ShaSettings,
  hospitalName: string,
): Record<string, unknown> {
  const fhir = s.fhir_base_url.replace(/\/$/, "");
  const now = new Date().toISOString();
  const patientFullUrl = `${fhir}/Patient/${draft.cr_id}`;
  const coverageFullUrl = `${fhir}/Coverage/${draft.cr_id}-sha-coverage`;
  const orgFullUrl = `${fhir}/Organization/${s.facility_code}`;
  const claimFullUrl = `${fhir}/Claim/${draft.claim_ref}`;
  const practitionerFullUrl = draft.practitioner_puid
    ? `${fhir}/Practitioner/${draft.practitioner_puid}`
    : null;

  const entries: Array<{ fullUrl: string; resource: Record<string, unknown> }> = [];

  entries.push({
    fullUrl: orgFullUrl,
    resource: {
      id: s.facility_code,
      meta: { profile: [`${fhir}/StructureDefinition/provider-organization|1.0.0`] },
      name: hospitalName,
      active: "True",
      extension: s.facility_level
        ? [
            {
              url: `${fhir}/StructureDefinition/facility-level`,
              valueCodeableConcept: {
                coding: [
                  {
                    system: `${fhir}/StructureDefinition/facility-level`,
                    code: s.facility_level,
                    display: s.facility_level,
                  },
                ],
              },
            },
          ]
        : [],
      identifier: [
        {
          use: "official",
          type: {
            coding: [
              {
                display: "Code",
                system: `${fhir}/terminology/CodeSystem/facility-identifier-types`,
                code: "fr-code",
              },
            ],
          },
          value: s.facility_code,
        },
      ],
      type: [
        {
          coding: [
            {
              system: `${fhir}/terminology/CodeSystem/organization-type`,
              code: "prov",
            },
          ],
        },
      ],
      resourceType: "Organization",
    },
  });

  entries.push({
    fullUrl: coverageFullUrl,
    resource: {
      identifier: [{ use: "official", value: `${draft.cr_id}-sha-coverage` }],
      status: "active",
      beneficiary: { reference: patientFullUrl, type: "Patient" },
      resourceType: "Coverage",
      extension: [
        {
          url: `${fhir}/StructureDefinition/schemeCategoryCode`,
          valueString: "CAT-SHA-001",
        },
        {
          url: `${fhir}/StructureDefinition/schemeCategoryName`,
          valueString: "SOCIAL HEALTH AUTHORITY",
        },
      ],
    },
  });

  entries.push({
    fullUrl: patientFullUrl,
    resource: {
      id: draft.cr_id,
      meta: { profile: [`${fhir}/StructureDefinition/patient|1.0.0`] },
      identifier: draft.sha_number
        ? [
            {
              use: "official",
              system: `${fhir}/identifier/shanumber`,
              value: draft.sha_number,
            },
          ]
        : [
            {
              use: "official",
              system: `${fhir}/identifier/shanumber`,
              value: draft.cr_id,
            },
          ],
      name: [
        {
          family: draft.patient.last_name ?? "",
          given: [draft.patient.first_name, draft.patient.middle_name].filter(
            Boolean,
          ) as string[],
          text: [
            draft.patient.first_name,
            draft.patient.middle_name,
            draft.patient.last_name,
          ]
            .filter(Boolean)
            .join(" "),
        },
      ],
      gender: draft.patient.sex ?? "unknown",
      birthDate: draft.patient.date_of_birth ?? undefined,
      resourceType: "Patient",
    },
  });

  if (practitionerFullUrl && draft.practitioner_puid) {
    entries.push({
      fullUrl: practitionerFullUrl,
      resource: {
        id: draft.practitioner_puid,
        meta: { profile: [`${fhir}/StructureDefinition/practitioner|1.0.0`] },
        name: [{ text: draft.practitioner_name ?? draft.practitioner_puid }],
        resourceType: "Practitioner",
        identifier: [
          {
            use: "official",
            system: `${fhir}/Practitioner/PractitionerRegistryID`,
            value: draft.practitioner_puid,
          },
        ],
        active: true,
      },
    });
  }

  entries.push({
    fullUrl: claimFullUrl,
    resource: {
      id: draft.claim_ref,
      identifier: [{ system: `${fhir}/claim`, value: draft.claim_ref }],
      status: "active",
      type: {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/claim-type",
            code: "institutional",
          },
        ],
      },
      subType: {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/ex-claimsubtype",
            code: draft.subtype,
          },
        ],
      },
      use: draft.claim_type === "preauth" ? "preauthorization" : "claim",
      patient: {
        reference: patientFullUrl,
        identifier: {
          value: draft.cr_id,
          use: "official",
          system: `${fhir}/identifier/shanumber`,
        },
        type: "Patient",
      },
      billablePeriod: {
        start: `${draft.billable_start}T00:00:00`,
        end: `${draft.billable_end}T00:00:00`,
      },
      insurance: [
        {
          sequence: 1,
          focal: "True",
          coverage: { reference: coverageFullUrl },
        },
      ],
      created: now,
      provider: { reference: orgFullUrl, type: "Organization", id: s.facility_code },
      priority: {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/processpriority",
            code: "normal",
          },
        ],
      },
      diagnosis: draft.diagnoses.map((d, i) => ({
        sequence: i + 1,
        diagnosisCodeableConcept: {
          coding: [
            {
              system: `${fhir}/terminology/CodeSystem/icd-11`,
              code: d.code,
              display: d.display,
            },
          ],
        },
      })),
      careTeam: practitionerFullUrl
        ? [
            {
              sequence: 1,
              provider: {
                reference: practitionerFullUrl,
                type: "Practitioner",
                display: draft.practitioner_name ?? draft.practitioner_puid,
              },
            },
          ]
        : [],
      item: draft.items.map((it, i) => ({
        sequence: i + 1,
        productOrService: {
          coding: [
            {
              system: `${fhir}/CodeSystem/intervention-codes`,
              code: it.code,
              display: it.display ?? it.code,
            },
          ],
        },
        ...(it.servicedStart && it.servicedEnd
          ? {
              servicedPeriod: { start: it.servicedStart, end: it.servicedEnd },
            }
          : {}),
        quantity: { value: it.quantity },
        unitPrice: { value: it.unitPrice, currency: draft.currency },
        net: { value: it.quantity * it.unitPrice, currency: draft.currency },
      })),
      total: { value: draft.total_amount, currency: draft.currency },
      resourceType: "Claim",
    },
  });

  return {
    id: draft.bundle_id,
    meta: { profile: [`${fhir}/StructureDefinition/bundle|1.0.0`] },
    timestamp: now,
    type: "message",
    entry: entries,
    resourceType: "Bundle",
  };
}
