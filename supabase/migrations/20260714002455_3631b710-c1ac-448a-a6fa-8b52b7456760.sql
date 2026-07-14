
-- Invites table
CREATE TABLE IF NOT EXISTS public.hospital_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  email text NOT NULL,
  role app_role NOT NULL,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  status text NOT NULL DEFAULT 'pending', -- pending | accepted | revoked | expired
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  accepted_at timestamptz,
  accepted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hospital_invites_hospital ON public.hospital_invites(hospital_id);
CREATE INDEX IF NOT EXISTS idx_hospital_invites_email ON public.hospital_invites(lower(email));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hospital_invites TO authenticated;
GRANT ALL ON public.hospital_invites TO service_role;

ALTER TABLE public.hospital_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hospital admins view invites"
  ON public.hospital_invites FOR SELECT TO authenticated
  USING (public.is_hospital_admin(hospital_id));

CREATE POLICY "Hospital admins create invites"
  ON public.hospital_invites FOR INSERT TO authenticated
  WITH CHECK (public.is_hospital_admin(hospital_id));

CREATE POLICY "Hospital admins update invites"
  ON public.hospital_invites FOR UPDATE TO authenticated
  USING (public.is_hospital_admin(hospital_id))
  WITH CHECK (public.is_hospital_admin(hospital_id));

CREATE POLICY "Hospital admins delete invites"
  ON public.hospital_invites FOR DELETE TO authenticated
  USING (public.is_hospital_admin(hospital_id));

CREATE TRIGGER trg_hospital_invites_updated
  BEFORE UPDATE ON public.hospital_invites
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Recommended modules per facility level
CREATE OR REPLACE FUNCTION public.recommend_modules_for_level(_level facility_level)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE _level
    WHEN 'dispensary' THEN ARRAY['reception','opd','pharmacy','inventory','billing']
    WHEN 'clinic' THEN ARRAY['reception','triage','opd','laboratory','pharmacy','inventory','billing','sha']
    WHEN 'diagnostic_centre' THEN ARRAY['reception','laboratory','radiology','billing','sha']
    WHEN 'health_centre' THEN ARRAY['reception','triage','opd','laboratory','pharmacy','inventory','billing','sha','maternity']
    WHEN 'sub_county_hospital' THEN ARRAY['reception','triage','opd','ipd','laboratory','radiology','pharmacy','inventory','billing','sha','maternity','pediatrics','hr']
    WHEN 'county_hospital' THEN ARRAY['reception','triage','opd','ipd','laboratory','radiology','pharmacy','inventory','procurement','billing','finance','sha','maternity','pediatrics','theatre','hr','asset_management']
    WHEN 'referral_hospital' THEN ARRAY['reception','triage','opd','ipd','laboratory','radiology','pharmacy','inventory','procurement','billing','finance','sha','maternity','pediatrics','theatre','icu','nicu','blood_bank','mortuary','kitchen','hr','asset_management','telemedicine']
    WHEN 'private_hospital' THEN ARRAY['reception','triage','opd','ipd','laboratory','radiology','pharmacy','inventory','billing','finance','sha','maternity','pediatrics','theatre','hr','patient_portal','doctor_portal']
    ELSE ARRAY['reception','opd','pharmacy','billing']
  END;
$$;

-- Public boot config (called unauthenticated by mobile/desktop apps)
CREATE OR REPLACE FUNCTION public.public_hospital_config(_code text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'hospital', jsonb_build_object(
      'id', h.id,
      'code', h.code,
      'name', h.name,
      'facility_level', h.facility_level,
      'country', h.country,
      'timezone', h.timezone,
      'currency', h.currency,
      'status', h.status
    ),
    'branding', to_jsonb(b.*) - 'hospital_id' - 'updated_at',
    'modules', COALESCE((
      SELECT jsonb_agg(m.code ORDER BY m.sort_order)
      FROM public.hospital_modules hm
      JOIN public.modules m ON m.id = hm.module_id
      WHERE hm.hospital_id = h.id AND hm.enabled = true
    ), '[]'::jsonb)
  )
  FROM public.hospitals h
  LEFT JOIN public.hospital_branding b ON b.hospital_id = h.id
  WHERE upper(h.code) = upper(_code) AND h.status = 'active';
$$;

GRANT EXECUTE ON FUNCTION public.public_hospital_config(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recommend_modules_for_level(facility_level) TO anon, authenticated;
