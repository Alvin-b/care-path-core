
CREATE TYPE public.referral_status AS ENUM ('queued','called','in_progress','completed','cancelled');
CREATE TYPE public.referral_priority AS ENUM ('routine','urgent','emergency');

CREATE TABLE public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  from_department_id uuid REFERENCES public.departments(id),
  to_department_id uuid NOT NULL REFERENCES public.departments(id),
  from_user_id uuid REFERENCES auth.users(id),
  to_user_id uuid REFERENCES auth.users(id),
  priority public.referral_priority NOT NULL DEFAULT 'routine',
  reason text NOT NULL,
  clinical_notes text,
  status public.referral_status NOT NULL DEFAULT 'queued',
  queue_number int,
  queue_date date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  called_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  completion_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX referrals_dept_date_idx ON public.referrals(to_department_id, queue_date, status);
CREATE INDEX referrals_patient_idx ON public.referrals(patient_id, created_at DESC);
CREATE INDEX referrals_hospital_idx ON public.referrals(hospital_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.referrals TO authenticated;
GRANT ALL ON public.referrals TO service_role;

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY referrals_select ON public.referrals FOR SELECT
  USING (public.is_hospital_member(hospital_id));
CREATE POLICY referrals_insert ON public.referrals FOR INSERT
  WITH CHECK (public.is_hospital_member(hospital_id));
CREATE POLICY referrals_update ON public.referrals FOR UPDATE
  USING (public.is_hospital_member(hospital_id));

CREATE TRIGGER trg_referrals_updated BEFORE UPDATE ON public.referrals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.referral_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_role public.app_role NOT NULL,
  to_dept_code text NOT NULL,
  UNIQUE (from_role, to_dept_code)
);
GRANT SELECT ON public.referral_rules TO authenticated, anon;
GRANT ALL ON public.referral_rules TO service_role;
ALTER TABLE public.referral_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY referral_rules_read ON public.referral_rules FOR SELECT USING (true);

INSERT INTO public.referral_rules (from_role, to_dept_code) VALUES
  ('doctor','radiology'),('doctor','laboratory'),('doctor','lab'),('doctor','pharmacy'),
  ('doctor','opd'),('doctor','ipd'),('doctor','theatre'),('doctor','maternity'),
  ('doctor','pediatrics'),('doctor','icu'),('doctor','emergency'),
  ('nurse','laboratory'),('nurse','lab'),('nurse','pharmacy'),('nurse','opd'),('nurse','triage'),
  ('triage_nurse','opd'),('triage_nurse','laboratory'),('triage_nurse','lab'),
  ('triage_nurse','emergency'),('triage_nurse','pharmacy'),
  ('receptionist','triage'),('receptionist','opd'),
  ('pharmacist','opd'),('pharmacist','doctor'),
  ('lab_tech','opd'),
  ('radiographer','opd'),
  ('manager','opd');

CREATE OR REPLACE FUNCTION public.can_refer(_user_id uuid, _to_dept_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_super_admin(_user_id) OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.departments d ON d.id = _to_dept_id
    WHERE ur.user_id = _user_id
      AND (ur.hospital_id = d.hospital_id OR ur.hospital_id IS NULL)
      AND (
        ur.role = 'hospital_admin'
        OR EXISTS (
          SELECT 1 FROM public.referral_rules rr
          WHERE rr.from_role = ur.role AND lower(rr.to_dept_code) = lower(d.code)
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.create_referral(
  _patient_id uuid, _to_department_id uuid, _priority public.referral_priority,
  _reason text, _clinical_notes text
) RETURNS public.referrals
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_hospital uuid;
  v_from_dept uuid;
  v_qnum int;
  v_ref public.referrals;
  v_dept_name text;
  v_patient_name text;
BEGIN
  SELECT hospital_id INTO v_hospital FROM public.patients WHERE id = _patient_id;
  IF v_hospital IS NULL THEN RAISE EXCEPTION 'Patient not found'; END IF;
  IF NOT public.is_hospital_member(v_hospital) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF NOT public.can_refer(auth.uid(), _to_department_id) THEN
    RAISE EXCEPTION 'Your role is not permitted to refer patients to this department';
  END IF;

  SELECT department_id INTO v_from_dept FROM public.profiles WHERE id = auth.uid();

  SELECT COALESCE(MAX(queue_number),0) + 1 INTO v_qnum
    FROM public.referrals
    WHERE to_department_id = _to_department_id
      AND queue_date = (now() AT TIME ZONE 'UTC')::date;

  INSERT INTO public.referrals
    (hospital_id, patient_id, from_department_id, to_department_id, from_user_id,
     priority, reason, clinical_notes, queue_number)
  VALUES
    (v_hospital, _patient_id, v_from_dept, _to_department_id, auth.uid(),
     _priority, _reason, _clinical_notes, v_qnum)
  RETURNING * INTO v_ref;

  SELECT name INTO v_dept_name FROM public.departments WHERE id = _to_department_id;
  SELECT trim(coalesce(first_name,'') || ' ' || coalesce(last_name,'')) INTO v_patient_name FROM public.patients WHERE id = _patient_id;

  INSERT INTO public.notifications (hospital_id, user_id, channel, title, body, data)
  SELECT v_hospital, p.id, 'in_app',
    'Incoming patient: ' || v_patient_name,
    'Queue #' || v_qnum || ' • Priority: ' || _priority::text || ' • ' || COALESCE(_reason,''),
    jsonb_build_object('referral_id', v_ref.id, 'patient_id', _patient_id, 'department_id', _to_department_id)
  FROM public.profiles p
  WHERE p.hospital_id = v_hospital AND p.department_id = _to_department_id AND p.active = true;

  RETURN v_ref;
END;
$$;

CREATE OR REPLACE FUNCTION public.advance_referral(_referral_id uuid, _to_status public.referral_status, _notes text DEFAULT NULL)
RETURNS public.referrals LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ref public.referrals;
BEGIN
  SELECT * INTO v_ref FROM public.referrals WHERE id = _referral_id;
  IF v_ref.id IS NULL THEN RAISE EXCEPTION 'Referral not found'; END IF;
  IF NOT public.is_hospital_member(v_ref.hospital_id) THEN RAISE EXCEPTION 'Forbidden'; END IF;

  UPDATE public.referrals SET
    status = _to_status,
    to_user_id = COALESCE(to_user_id, auth.uid()),
    called_at = CASE WHEN _to_status = 'called' AND called_at IS NULL THEN now() ELSE called_at END,
    started_at = CASE WHEN _to_status = 'in_progress' AND started_at IS NULL THEN now() ELSE started_at END,
    completed_at = CASE WHEN _to_status IN ('completed','cancelled') THEN now() ELSE completed_at END,
    completion_notes = COALESCE(_notes, completion_notes)
  WHERE id = _referral_id
  RETURNING * INTO v_ref;
  RETURN v_ref;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_referral(uuid,uuid,public.referral_priority,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.advance_referral(uuid,public.referral_status,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_refer(uuid,uuid) TO authenticated;
