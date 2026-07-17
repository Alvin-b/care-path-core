
-- 1. app_versions: restrict to authenticated
DROP POLICY IF EXISTS app_versions_public_read ON public.app_versions;
CREATE POLICY app_versions_authenticated_read ON public.app_versions
  FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.app_versions FROM anon;

-- 2. hospital_invites: allow invitee to read their own pending invite
CREATE POLICY "Invitees view own invite" ON public.hospital_invites
  FOR SELECT TO authenticated
  USING (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

-- 3. Revoke public/anon EXECUTE on SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_patient_mrn() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_hospital_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_hospital_member(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_hospital_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.match_patients_by_embedding(uuid, vector, integer, double precision) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.find_patient_duplicates(uuid, text, text, date, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.dispense_prescription(uuid, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.public_hospital_config(text) FROM PUBLIC;
-- public_hospital_config is intentionally callable by anon (public bootstrap API)
GRANT EXECUTE ON FUNCTION public.public_hospital_config(text) TO anon, authenticated;
