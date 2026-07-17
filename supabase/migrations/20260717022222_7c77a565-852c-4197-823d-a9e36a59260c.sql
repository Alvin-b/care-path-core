-- Per-hospital SHA / Afyalink credentials and settings
CREATE TABLE public.sha_settings (
  hospital_id uuid PRIMARY KEY REFERENCES public.hospitals(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  environment text NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox','production')),
  base_url text NOT NULL DEFAULT 'https://ilm-dev.dha.go.ke/uat-middleware/api/v1',
  fhir_base_url text NOT NULL DEFAULT 'https://qa-mis.apeiro-digital.com',
  facility_code text,
  facility_level text,
  token_url text,
  client_id text,
  client_secret text,
  callback_secret text,
  callback_basic_user text,
  callback_basic_pass text,
  last_test_at timestamptz,
  last_test_ok boolean,
  last_test_message text,
  configured_at timestamptz,
  configured_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.sha_settings TO service_role;
ALTER TABLE public.sha_settings ENABLE ROW LEVEL SECURITY;
-- No policies for authenticated/anon: all access is mediated by server functions.

CREATE TRIGGER sha_settings_touch BEFORE UPDATE ON public.sha_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- OAuth2 token cache
CREATE TABLE public.sha_token_cache (
  hospital_id uuid PRIMARY KEY REFERENCES public.hospitals(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  token_type text NOT NULL DEFAULT 'Bearer',
  expires_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.sha_token_cache TO service_role;
ALTER TABLE public.sha_token_cache ENABLE ROW LEVEL SECURITY;
-- Server-only.

-- Eligibility check audit trail
CREATE TABLE public.sha_eligibility_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  identification_type text NOT NULL,
  identification_number text NOT NULL,
  check_kind text NOT NULL DEFAULT 'eligibility' CHECK (check_kind IN ('eligibility','benefits','interventions','utilization')),
  eligible boolean,
  cr_id text,
  sha_number text,
  full_name text,
  coverage_end_date timestamptz,
  message text,
  reason text,
  possible_solution text,
  request_payload jsonb,
  response_payload jsonb,
  http_status int,
  error_message text,
  checked_by uuid,
  checked_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.sha_eligibility_checks TO authenticated;
GRANT ALL ON public.sha_eligibility_checks TO service_role;
ALTER TABLE public.sha_eligibility_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hospital members view eligibility checks"
  ON public.sha_eligibility_checks FOR SELECT TO authenticated
  USING (public.is_hospital_member(hospital_id));
CREATE POLICY "Hospital members insert eligibility checks"
  ON public.sha_eligibility_checks FOR INSERT TO authenticated
  WITH CHECK (public.is_hospital_member(hospital_id) AND checked_by = auth.uid());

CREATE INDEX sha_eligibility_checks_hospital_patient_idx
  ON public.sha_eligibility_checks (hospital_id, patient_id, checked_at DESC);

-- Claim lifecycle enum (mirrors SHA claim-state extension)
CREATE TYPE public.sha_claim_state AS ENUM (
  'draft',
  'validating',
  'submitted',
  'queued',
  'in-review',
  'clinical-review',
  'approved',
  'rejected',
  'sent-for-payment-processing',
  'sent-to-surveillance',
  'payment-completed',
  'payment-declined',
  'error'
);

-- Claims
CREATE TABLE public.sha_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE RESTRICT,
  claim_type text NOT NULL DEFAULT 'claim' CHECK (claim_type IN ('claim','preauth')),
  subtype text NOT NULL DEFAULT 'op' CHECK (subtype IN ('op','ip','emg')),
  cr_id text,
  sha_number text,
  practitioner_puid text,
  practitioner_name text,
  billable_start date,
  billable_end date,
  diagnoses jsonb NOT NULL DEFAULT '[]'::jsonb,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_amount numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'KES',
  bundle_id uuid NOT NULL DEFAULT gen_random_uuid(),
  claim_ref text NOT NULL DEFAULT gen_random_uuid()::text,
  state public.sha_claim_state NOT NULL DEFAULT 'draft',
  last_state_at timestamptz NOT NULL DEFAULT now(),
  request_bundle jsonb,
  submitted_at timestamptz,
  submitted_by uuid,
  provider_auth_token text,
  preauth_token text,
  response_payload jsonb,
  http_status int,
  error_message text,
  paid_amount numeric(14,2),
  paid_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sha_claims TO authenticated;
GRANT ALL ON public.sha_claims TO service_role;
ALTER TABLE public.sha_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hospital members view claims"
  ON public.sha_claims FOR SELECT TO authenticated
  USING (public.is_hospital_member(hospital_id));
CREATE POLICY "Hospital members create claims"
  ON public.sha_claims FOR INSERT TO authenticated
  WITH CHECK (public.is_hospital_member(hospital_id) AND created_by = auth.uid());
CREATE POLICY "Hospital members edit claims"
  ON public.sha_claims FOR UPDATE TO authenticated
  USING (public.is_hospital_member(hospital_id))
  WITH CHECK (public.is_hospital_member(hospital_id));
CREATE POLICY "Hospital admins delete claims"
  ON public.sha_claims FOR DELETE TO authenticated
  USING (public.is_hospital_admin(hospital_id));

CREATE INDEX sha_claims_hospital_state_idx ON public.sha_claims (hospital_id, state, created_at DESC);
CREATE INDEX sha_claims_hospital_patient_idx ON public.sha_claims (hospital_id, patient_id, created_at DESC);
CREATE UNIQUE INDEX sha_claims_bundle_id_key ON public.sha_claims (bundle_id);
CREATE UNIQUE INDEX sha_claims_claim_ref_key ON public.sha_claims (hospital_id, claim_ref);

CREATE TRIGGER sha_claims_touch BEFORE UPDATE ON public.sha_claims
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Claim state timeline
CREATE TABLE public.sha_claim_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES public.sha_claims(id) ON DELETE CASCADE,
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  from_state public.sha_claim_state,
  to_state public.sha_claim_state,
  http_status int,
  message text,
  payload jsonb,
  actor uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sha_claim_events TO authenticated;
GRANT ALL ON public.sha_claim_events TO service_role;
ALTER TABLE public.sha_claim_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hospital members view claim events"
  ON public.sha_claim_events FOR SELECT TO authenticated
  USING (public.is_hospital_member(hospital_id));

CREATE INDEX sha_claim_events_claim_idx ON public.sha_claim_events (claim_id, created_at DESC);

-- Retry / dispatch queue
CREATE TABLE public.sha_dispatch_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  claim_id uuid REFERENCES public.sha_claims(id) ON DELETE CASCADE,
  operation text NOT NULL CHECK (operation IN ('submit_claim','check_status','check_eligibility')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','done','failed')),
  attempts int NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sha_dispatch_queue TO authenticated;
GRANT ALL ON public.sha_dispatch_queue TO service_role;
ALTER TABLE public.sha_dispatch_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hospital admins view dispatch queue"
  ON public.sha_dispatch_queue FOR SELECT TO authenticated
  USING (public.is_hospital_admin(hospital_id));

CREATE INDEX sha_dispatch_queue_pending_idx
  ON public.sha_dispatch_queue (status, next_attempt_at)
  WHERE status IN ('pending','processing');

CREATE TRIGGER sha_dispatch_queue_touch BEFORE UPDATE ON public.sha_dispatch_queue
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Cache SHA Client Registry ID on patients
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS sha_cr_id text;
CREATE INDEX IF NOT EXISTS patients_hospital_sha_cr_id_idx
  ON public.patients (hospital_id, sha_cr_id)
  WHERE sha_cr_id IS NOT NULL;