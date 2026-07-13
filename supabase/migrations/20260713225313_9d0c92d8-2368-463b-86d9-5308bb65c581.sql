
-- ============================================================================
-- HMIS PLATFORM — PHASE 1: MULTI-TENANT FOUNDATION
-- ============================================================================

-- Helper: updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- =========================
-- ENUMS
-- =========================
CREATE TYPE public.app_role AS ENUM (
  'super_admin','hospital_admin','doctor','nurse','receptionist',
  'pharmacist','lab_tech','radiographer','accountant','storekeeper',
  'hr','cashier','triage_nurse','manager'
);

CREATE TYPE public.facility_level AS ENUM (
  'dispensary','clinic','health_centre','sub_county_hospital',
  'county_hospital','referral_hospital','private_hospital','diagnostic_centre'
);

CREATE TYPE public.subscription_plan AS ENUM ('starter','professional','enterprise','government');
CREATE TYPE public.license_status  AS ENUM ('trial','active','expired','suspended','cancelled');
CREATE TYPE public.module_status    AS ENUM ('available','installed','disabled','deprecated');
CREATE TYPE public.platform_kind    AS ENUM ('android','ios','windows','macos','linux','web');

-- =========================
-- HOSPITALS (tenants)
-- =========================
CREATE TABLE public.hospitals (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code          text NOT NULL UNIQUE,          -- short login code, e.g. NRB001
  name          text NOT NULL,
  facility_level public.facility_level NOT NULL DEFAULT 'clinic',
  country       text NOT NULL DEFAULT 'KE',
  timezone      text NOT NULL DEFAULT 'Africa/Nairobi',
  currency      text NOT NULL DEFAULT 'KES',
  email         text,
  phone         text,
  address       text,
  sha_reg_no    text,
  dha_reg_no    text,
  tax_pin       text,
  status        text NOT NULL DEFAULT 'active',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hospitals TO authenticated;
GRANT ALL ON public.hospitals TO service_role;
ALTER TABLE public.hospitals ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_hospitals_updated BEFORE UPDATE ON public.hospitals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================
-- BRANCHES
-- =========================
CREATE TABLE public.branches (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id  uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  name         text NOT NULL,
  code         text NOT NULL,
  address      text,
  phone        text,
  gps_lat      numeric,
  gps_lng      numeric,
  is_primary   boolean NOT NULL DEFAULT false,
  active       boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hospital_id, code)
);
CREATE INDEX idx_branches_hospital ON public.branches(hospital_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.branches TO authenticated;
GRANT ALL ON public.branches TO service_role;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_branches_updated BEFORE UPDATE ON public.branches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================
-- DEPARTMENTS (per hospital)
-- =========================
CREATE TABLE public.departments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id  uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  branch_id    uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  name         text NOT NULL,
  code         text NOT NULL,
  active       boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hospital_id, code)
);
CREATE INDEX idx_departments_hospital ON public.departments(hospital_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.departments TO authenticated;
GRANT ALL ON public.departments TO service_role;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_departments_updated BEFORE UPDATE ON public.departments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================
-- PROFILES (extends auth.users, scoped to a hospital)
-- =========================
CREATE TABLE public.profiles (
  id            uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  hospital_id   uuid REFERENCES public.hospitals(id) ON DELETE SET NULL,
  branch_id     uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  full_name     text,
  email         text,
  phone         text,
  staff_number  text,
  title         text,
  avatar_url    text,
  active        boolean NOT NULL DEFAULT true,
  last_login_at timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_profiles_hospital ON public.profiles(hospital_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================
-- USER ROLES (scoped per hospital)
-- =========================
CREATE TABLE public.user_roles (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hospital_id  uuid REFERENCES public.hospitals(id) ON DELETE CASCADE,  -- NULL only for super_admin
  role         public.app_role NOT NULL,
  granted_by   uuid REFERENCES auth.users(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, hospital_id, role)
);
CREATE INDEX idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_hospital ON public.user_roles(hospital_id);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security-definer role checks (avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role, _hospital_id uuid DEFAULT NULL)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
      AND (_hospital_id IS NULL OR hospital_id = _hospital_id OR hospital_id IS NULL)
  );
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'super_admin');
$$;

CREATE OR REPLACE FUNCTION public.current_hospital_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT hospital_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_hospital_member(_hospital_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_super_admin(auth.uid())
      OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND hospital_id = _hospital_id);
$$;

CREATE OR REPLACE FUNCTION public.is_hospital_admin(_hospital_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_super_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid() AND role = 'hospital_admin' AND hospital_id = _hospital_id
      );
$$;

-- =========================
-- PERMISSIONS (granular)
-- =========================
CREATE TABLE public.permissions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text NOT NULL UNIQUE,   -- e.g. Patient.View, Billing.Cancel
  module_code text NOT NULL,
  description text
);
GRANT SELECT ON public.permissions TO authenticated;
GRANT ALL ON public.permissions TO service_role;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "permissions_readable_by_all_auth" ON public.permissions FOR SELECT TO authenticated USING (true);

CREATE TABLE public.role_permissions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id    uuid REFERENCES public.hospitals(id) ON DELETE CASCADE, -- NULL = platform default
  role           public.app_role NOT NULL,
  permission_id  uuid NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  UNIQUE (hospital_id, role, permission_id)
);
GRANT SELECT ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "role_perms_read" ON public.role_permissions FOR SELECT TO authenticated
  USING (hospital_id IS NULL OR public.is_hospital_member(hospital_id));

-- =========================
-- MODULES (platform catalog)
-- =========================
CREATE TABLE public.modules (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code         text NOT NULL UNIQUE,      -- 'reception','opd','pharmacy',...
  name         text NOT NULL,
  category     text NOT NULL DEFAULT 'clinical',
  description  text,
  version      text NOT NULL DEFAULT '1.0.0',
  is_core      boolean NOT NULL DEFAULT false, -- always installed
  min_plan     public.subscription_plan NOT NULL DEFAULT 'starter',
  icon         text,
  sort_order   int NOT NULL DEFAULT 0,
  status       public.module_status NOT NULL DEFAULT 'available',
  created_at   timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.modules TO authenticated;
GRANT ALL ON public.modules TO service_role;
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "modules_readable" ON public.modules FOR SELECT TO authenticated USING (true);

-- Module dependencies (module -> required module)
CREATE TABLE public.module_dependencies (
  module_id           uuid NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  depends_on_module_id uuid NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  PRIMARY KEY (module_id, depends_on_module_id)
);
GRANT SELECT ON public.module_dependencies TO authenticated;
GRANT ALL ON public.module_dependencies TO service_role;
ALTER TABLE public.module_dependencies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "moduledeps_readable" ON public.module_dependencies FOR SELECT TO authenticated USING (true);

-- Per-hospital installed modules
CREATE TABLE public.hospital_modules (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id  uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  module_id    uuid NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  enabled      boolean NOT NULL DEFAULT true,
  installed_at timestamptz NOT NULL DEFAULT now(),
  licensed_until date,
  settings     jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (hospital_id, module_id)
);
CREATE INDEX idx_hmods_hospital ON public.hospital_modules(hospital_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hospital_modules TO authenticated;
GRANT ALL ON public.hospital_modules TO service_role;
ALTER TABLE public.hospital_modules ENABLE ROW LEVEL SECURITY;

-- =========================
-- LICENSES
-- =========================
CREATE TABLE public.licenses (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id   uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  plan          public.subscription_plan NOT NULL DEFAULT 'starter',
  status        public.license_status NOT NULL DEFAULT 'trial',
  starts_at     timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz,
  max_users     int,
  max_branches  int,
  support_plan  text,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_licenses_hospital ON public.licenses(hospital_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.licenses TO authenticated;
GRANT ALL ON public.licenses TO service_role;
ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_licenses_updated BEFORE UPDATE ON public.licenses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================
-- HOSPITAL BRANDING
-- =========================
CREATE TABLE public.hospital_branding (
  hospital_id     uuid PRIMARY KEY REFERENCES public.hospitals(id) ON DELETE CASCADE,
  app_name        text,
  logo_url        text,
  splash_url      text,
  primary_color   text DEFAULT '#0f766e',
  secondary_color text DEFAULT '#0369a1',
  accent_color    text DEFAULT '#f59e0b',
  receipt_header  text,
  receipt_footer  text,
  report_header   text,
  prescription_header text,
  updated_at      timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hospital_branding TO authenticated;
GRANT ALL ON public.hospital_branding TO service_role;
ALTER TABLE public.hospital_branding ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_branding_updated BEFORE UPDATE ON public.hospital_branding
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================
-- HOSPITAL SETTINGS (key/value jsonb bags)
-- =========================
CREATE TABLE public.hospital_settings (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id  uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  category     text NOT NULL, -- 'general','pharmacy','billing','sha','sms','email','localization',...
  key          text NOT NULL,
  value        jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hospital_id, category, key)
);
CREATE INDEX idx_settings_hospital ON public.hospital_settings(hospital_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hospital_settings TO authenticated;
GRANT ALL ON public.hospital_settings TO service_role;
ALTER TABLE public.hospital_settings ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_settings_updated BEFORE UPDATE ON public.hospital_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================
-- AUDIT LOGS
-- =========================
CREATE TABLE public.audit_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id  uuid REFERENCES public.hospitals(id) ON DELETE SET NULL,
  branch_id    uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  user_id      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action       text NOT NULL,        -- CREATE / UPDATE / DELETE / LOGIN / EXPORT / ...
  entity_type  text NOT NULL,        -- 'patient','bill','claim',...
  entity_id    text,
  before_data  jsonb,
  after_data   jsonb,
  ip_address   inet,
  user_agent   text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_hospital_time ON public.audit_logs(hospital_id, created_at DESC);
CREATE INDEX idx_audit_entity ON public.audit_logs(entity_type, entity_id);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- =========================
-- NOTIFICATIONS (in-app)
-- =========================
CREATE TABLE public.notifications (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id  uuid REFERENCES public.hospitals(id) ON DELETE CASCADE,
  user_id      uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  channel      text NOT NULL DEFAULT 'in_app', -- in_app | sms | email | push | whatsapp
  title        text NOT NULL,
  body         text,
  data         jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at      timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notif_user ON public.notifications(user_id, read_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- =========================
-- APP VERSIONS (self-hosted updater)
-- =========================
CREATE TABLE public.app_versions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform      public.platform_kind NOT NULL,
  version       text NOT NULL,                   -- semver
  build_number  int NOT NULL,
  mandatory     boolean NOT NULL DEFAULT false,
  release_notes text,
  download_url  text NOT NULL,
  sha256        text NOT NULL,
  size_bytes    bigint,
  published_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (platform, version)
);
GRANT SELECT ON public.app_versions TO authenticated;
GRANT SELECT ON public.app_versions TO anon;  -- public update check
GRANT ALL ON public.app_versions TO service_role;
ALTER TABLE public.app_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "app_versions_public_read" ON public.app_versions FOR SELECT TO anon, authenticated USING (true);

-- =========================
-- RLS POLICIES
-- =========================

-- hospitals: super_admin sees all; members see their own; hospital_admin can update their own
CREATE POLICY "hospitals_select" ON public.hospitals FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_hospital_member(id));
CREATE POLICY "hospitals_insert" ON public.hospitals FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "hospitals_update" ON public.hospitals FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_hospital_admin(id))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_hospital_admin(id));
CREATE POLICY "hospitals_delete" ON public.hospitals FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- branches
CREATE POLICY "branches_select" ON public.branches FOR SELECT TO authenticated
  USING (public.is_hospital_member(hospital_id));
CREATE POLICY "branches_write" ON public.branches FOR ALL TO authenticated
  USING (public.is_hospital_admin(hospital_id))
  WITH CHECK (public.is_hospital_admin(hospital_id));

-- departments
CREATE POLICY "departments_select" ON public.departments FOR SELECT TO authenticated
  USING (public.is_hospital_member(hospital_id));
CREATE POLICY "departments_write" ON public.departments FOR ALL TO authenticated
  USING (public.is_hospital_admin(hospital_id))
  WITH CHECK (public.is_hospital_admin(hospital_id));

-- profiles
CREATE POLICY "profiles_self_or_hospital" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid()
      OR public.is_super_admin(auth.uid())
      OR (hospital_id IS NOT NULL AND public.is_hospital_member(hospital_id)));
CREATE POLICY "profiles_update_self" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_hospital_admin(hospital_id))
  WITH CHECK (id = auth.uid() OR public.is_hospital_admin(hospital_id));
CREATE POLICY "profiles_admin_insert" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid() OR public.is_super_admin(auth.uid()));

-- user_roles: viewable by super_admin or same hospital admin; writeable by hospital_admin/super_admin
CREATE POLICY "user_roles_select" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid()
      OR public.is_super_admin(auth.uid())
      OR (hospital_id IS NOT NULL AND public.is_hospital_admin(hospital_id)));
CREATE POLICY "user_roles_write" ON public.user_roles FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())
      OR (hospital_id IS NOT NULL AND public.is_hospital_admin(hospital_id)))
  WITH CHECK (public.is_super_admin(auth.uid())
      OR (hospital_id IS NOT NULL AND public.is_hospital_admin(hospital_id)));

-- hospital_modules
CREATE POLICY "hmods_select" ON public.hospital_modules FOR SELECT TO authenticated
  USING (public.is_hospital_member(hospital_id));
CREATE POLICY "hmods_write" ON public.hospital_modules FOR ALL TO authenticated
  USING (public.is_hospital_admin(hospital_id))
  WITH CHECK (public.is_hospital_admin(hospital_id));

-- licenses
CREATE POLICY "licenses_select" ON public.licenses FOR SELECT TO authenticated
  USING (public.is_hospital_member(hospital_id));
CREATE POLICY "licenses_write" ON public.licenses FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- branding
CREATE POLICY "branding_select" ON public.hospital_branding FOR SELECT TO authenticated
  USING (public.is_hospital_member(hospital_id));
CREATE POLICY "branding_write" ON public.hospital_branding FOR ALL TO authenticated
  USING (public.is_hospital_admin(hospital_id))
  WITH CHECK (public.is_hospital_admin(hospital_id));

-- settings
CREATE POLICY "settings_select" ON public.hospital_settings FOR SELECT TO authenticated
  USING (public.is_hospital_member(hospital_id));
CREATE POLICY "settings_write" ON public.hospital_settings FOR ALL TO authenticated
  USING (public.is_hospital_admin(hospital_id))
  WITH CHECK (public.is_hospital_admin(hospital_id));

-- audit logs: read by hospital members; insert by any authenticated (server-side normally)
CREATE POLICY "audit_select" ON public.audit_logs FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid())
      OR (hospital_id IS NOT NULL AND public.is_hospital_admin(hospital_id)));
CREATE POLICY "audit_insert" ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- notifications
CREATE POLICY "notif_select_own" ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "notif_update_own" ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "notif_insert_admin" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid())
        OR (hospital_id IS NOT NULL AND public.is_hospital_admin(hospital_id))
        OR user_id = auth.uid());
