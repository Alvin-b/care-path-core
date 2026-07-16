import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const EMBED_MODEL = "openai/text-embedding-3-small";
const EMBED_URL = "https://ai.gateway.lovable.dev/v1/embeddings";

async function embed(input: string): Promise<number[]> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY is not configured");
  const res = await fetch(EMBED_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": key,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
    body: JSON.stringify({ model: EMBED_MODEL, input }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Embedding failed [${res.status}]: ${body}`);
  }
  const json = (await res.json()) as { data: Array<{ embedding: number[] }> };
  return json.data[0].embedding;
}

function patientText(p: {
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
  date_of_birth?: string | null;
  phone?: string | null;
  national_id?: string | null;
  sha_number?: string | null;
  sex?: string | null;
}) {
  return [
    p.first_name, p.middle_name, p.last_name,
    p.date_of_birth ? `DOB ${p.date_of_birth}` : null,
    p.sex,
    p.phone,
    p.national_id ? `NID ${p.national_id}` : null,
    p.sha_number ? `SHA ${p.sha_number}` : null,
  ].filter(Boolean).join(" ");
}

const FindInput = z.object({
  hospitalId: z.string().uuid(),
  firstName: z.string().optional().nullable(),
  middleName: z.string().optional().nullable(),
  lastName: z.string().optional().nullable(),
  dateOfBirth: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  nationalId: z.string().optional().nullable(),
  shaNumber: z.string().optional().nullable(),
  sex: z.string().optional().nullable(),
  minSimilarity: z.number().min(0).max(1).default(0.78),
  limit: z.number().int().min(1).max(20).default(5),
});

export const aiFindSimilarPatients = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => FindInput.parse(raw))
  .handler(async ({ data, context }) => {
    const text = patientText({
      first_name: data.firstName,
      middle_name: data.middleName,
      last_name: data.lastName,
      date_of_birth: data.dateOfBirth,
      phone: data.phone,
      national_id: data.nationalId,
      sha_number: data.shaNumber,
      sex: data.sex,
    }).trim();
    if (text.length < 3) return { matches: [] as Array<Record<string, unknown>> };

    const vec = await embed(text);
    const { data: rows, error } = await context.supabase.rpc(
      "match_patients_by_embedding",
      {
        _hospital_id: data.hospitalId,
        _query: vec as unknown as string,
        _limit: data.limit,
        _min_similarity: data.minSimilarity,
      } as never,
    );
    if (error) throw new Error(error.message);
    return { matches: (rows ?? []) as Array<{
      patient_id: string; mrn: string; first_name: string; last_name: string;
      phone: string | null; date_of_birth: string | null; similarity: number;
    }> };
  });

const IndexInput = z.object({ patientId: z.string().uuid() });

export const aiIndexPatient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => IndexInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { data: p, error } = await context.supabase
      .from("patients")
      .select("id,hospital_id,first_name,middle_name,last_name,date_of_birth,phone,national_id,sha_number,sex")
      .eq("id", data.patientId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!p) throw new Error("Patient not found");

    const text = patientText(p).trim();
    if (!text) return { indexed: false };
    const vec = await embed(text);

    const { error: upErr } = await context.supabase
      .from("patient_embeddings")
      .upsert({
        patient_id: p.id,
        hospital_id: p.hospital_id,
        embedding: vec as unknown as string,
        source_text: text,
        model_version: EMBED_MODEL,
        updated_at: new Date().toISOString(),
      } as never);
    if (upErr) throw new Error(upErr.message);
    return { indexed: true };
  });
