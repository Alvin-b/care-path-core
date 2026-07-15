
-- Enums
DO $$ BEGIN
  CREATE TYPE public.patient_sex AS ENUM ('male','female','intersex','unknown');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.marital_status AS ENUM ('single','married','divorced','widowed','separated','cohabiting','unknown');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.blood_group AS ENUM ('A+','A-','B+','B-','AB+','AB-','O+','O-','unknown');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Per-hospital MRN counters
CREATE TABLE IF NOT EXISTS public.patient_counters (
  hospital_id uuid PRIMARY KEY REFERENCES public.hospitals(id) ON DELETE CASCADE,
  last_value bigint NOT NULL DEFAULT 0
);
GRANT SELECT ON public.patient_counters TO authenticated;
GRANT ALL ON public.patient_counters TO service_role;
ALTER TABLE public.patient_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read counters" ON public.patient_counters
  FOR SELECT TO authenticated USING (public.is_hospital_member(hospital_id));

-- Patients
CREATE TABLE public.patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  mrn text NOT NULL,

  -- Names
  first_name text NOT NULL,
  middle_name text,
  last_name text NOT NULL,
  other_names text,
  preferred_name text,

  -- Core demographics
  date_of_birth date,
  dob_estimated boolean NOT NULL DEFAULT false,
  sex public.patient_sex NOT NULL DEFAULT 'unknown',
  gender_identity text,
  marital_status public.marital_status NOT NULL DEFAULT 'unknown',
  blood_group public.blood_group NOT NULL DEFAULT 'unknown',
  occupation text,
  employer text,
  preferred_language text,
  religion text,
  nationality text DEFAULT 'Kenyan',
  photo_url text,

  -- Identifiers
  national_id text,
  passport_no text,
  birth_cert_no text,
  sha_number text,
  nhif_number text,
  other_insurance jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Contact
  phone text,
  alt_phone text,
  email text,
  address_line text,
  county text,
  sub_county text,
  ward text,
  village text,
  postal_code text,

  -- Next of kin
  nok_name text,
  nok_relationship text,
  nok_phone text,
  nok_alt_phone text,
  nok_address text,

  -- Emergency contact (may differ from NoK)
  emergency_contact_name text,
  emergency_contact_phone text,
  emergency_contact_relationship text,

  -- Clinical flags
  allergies text[] NOT NULL DEFAULT '{}',
  chronic_conditions text[] NOT NULL DEFAULT '{}',
  disabilities text[] NOT NULL DEFAULT '{}',
  notes text,

  -- Consent
  consent_data_processing boolean NOT NULL DEFAULT false,
  consent_sms boolean NOT NULL DEFAULT false,
  consent_signed_at timestamptz,

  -- Flags
  is_vip boolean NOT NULL DEFAULT false,
  is_confidential boolean NOT NULL DEFAULT false,
  is_deceased boolean NOT NULL DEFAULT false,
  deceased_at timestamptz,

  -- Audit
  registered_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  merged_into uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (hospital_id, mrn),
  UNIQUE (hospital_id, national_id),
  UNIQUE (hospital_id, passport_no),
  UNIQUE (hospital_id, sha_number)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.patients TO authenticated;
GRANT ALL ON public.patients TO service_role;

ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hospital members view patients"
  ON public.patients FOR SELECT TO authenticated
  USING (public.is_hospital_member(hospital_id));

CREATE POLICY "hospital members register patients"
  ON public.patients FOR INSERT TO authenticated
  WITH CHECK (public.is_hospital_member(hospital_id));

CREATE POLICY "hospital members update patients"
  ON public.patients FOR UPDATE TO authenticated
  USING (public.is_hospital_member(hospital_id))
  WITH CHECK (public.is_hospital_member(hospital_id));

CREATE POLICY "hospital admins delete patients"
  ON public.patients FOR DELETE TO authenticated
  USING (public.is_hospital_admin(hospital_id));

-- Indexes for search
CREATE INDEX patients_hospital_names_idx ON public.patients (hospital_id, lower(last_name), lower(first_name));
CREATE INDEX patients_hospital_phone_idx ON public.patients (hospital_id, phone) WHERE phone IS NOT NULL;
CREATE INDEX patients_hospital_natid_idx ON public.patients (hospital_id, national_id) WHERE national_id IS NOT NULL;
CREATE INDEX patients_hospital_sha_idx ON public.patients (hospital_id, sha_number) WHERE sha_number IS NOT NULL;
CREATE INDEX patients_hospital_dob_idx ON public.patients (hospital_id, date_of_birth);

-- updated_at trigger
CREATE TRIGGER patients_set_updated_at
  BEFORE UPDATE ON public.patients
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- MRN generator
CREATE OR REPLACE FUNCTION public.generate_patient_mrn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next bigint;
  v_code text;
BEGIN
  IF NEW.mrn IS NOT NULL AND length(trim(NEW.mrn)) > 0 THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.patient_counters (hospital_id, last_value)
  VALUES (NEW.hospital_id, 1)
  ON CONFLICT (hospital_id) DO UPDATE
    SET last_value = public.patient_counters.last_value + 1
  RETURNING last_value INTO v_next;

  SELECT upper(code) INTO v_code FROM public.hospitals WHERE id = NEW.hospital_id;
  NEW.mrn := COALESCE(v_code, 'H') || '-' || lpad(v_next::text, 6, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER patients_generate_mrn
  BEFORE INSERT ON public.patients
  FOR EACH ROW EXECUTE FUNCTION public.generate_patient_mrn();

-- Duplicate-check helper (fuzzy) — same hospital only
CREATE OR REPLACE FUNCTION public.find_patient_duplicates(
  _hospital_id uuid,
  _first_name text,
  _last_name text,
  _dob date,
  _phone text,
  _national_id text
) RETURNS SETOF public.patients
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.* FROM public.patients p
  WHERE p.hospital_id = _hospital_id
    AND p.merged_into IS NULL
    AND (
      (_national_id IS NOT NULL AND p.national_id = _national_id)
      OR (_phone IS NOT NULL AND (p.phone = _phone OR p.alt_phone = _phone))
      OR (
        _first_name IS NOT NULL AND _last_name IS NOT NULL
        AND lower(p.first_name) = lower(_first_name)
        AND lower(p.last_name) = lower(_last_name)
        AND (_dob IS NULL OR p.date_of_birth = _dob)
      )
    )
  LIMIT 10;
$$;
