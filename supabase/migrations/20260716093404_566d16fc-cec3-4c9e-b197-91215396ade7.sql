
-- pgvector for AI patient dedup
CREATE EXTENSION IF NOT EXISTS vector;

-- Enums
DO $$ BEGIN
  CREATE TYPE public.item_category AS ENUM ('medication','supply','consumable','equipment','reagent','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.stock_movement_type AS ENUM ('receipt','dispense','adjustment','wastage','transfer_in','transfer_out','return','opening_balance');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.prescription_status AS ENUM ('pending','partial','dispensed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ inventory_items ============
CREATE TABLE public.inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  sku text,
  name text NOT NULL,
  generic_name text,
  category public.item_category NOT NULL DEFAULT 'supply',
  form text,
  strength text,
  unit text NOT NULL DEFAULT 'unit',
  manufacturer text,
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  reorder_level numeric(12,2) NOT NULL DEFAULT 0,
  is_controlled boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  description text,
  tags text[] NOT NULL DEFAULT '{}',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hospital_id, sku)
);
CREATE INDEX ON public.inventory_items(hospital_id, active);
CREATE INDEX ON public.inventory_items(hospital_id, category);
CREATE INDEX ON public.inventory_items USING gin (to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(generic_name,'') || ' ' || coalesce(sku,'')));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_items TO authenticated;
GRANT ALL ON public.inventory_items TO service_role;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hospital members view items" ON public.inventory_items FOR SELECT TO authenticated
  USING (public.is_hospital_member(hospital_id));
CREATE POLICY "hospital members write items" ON public.inventory_items FOR ALL TO authenticated
  USING (public.is_hospital_member(hospital_id))
  WITH CHECK (public.is_hospital_member(hospital_id));

CREATE TRIGGER inventory_items_updated BEFORE UPDATE ON public.inventory_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ inventory_batches ============
CREATE TABLE public.inventory_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  batch_no text,
  expiry_date date,
  quantity_on_hand numeric(14,3) NOT NULL DEFAULT 0,
  cost_price numeric(12,2) NOT NULL DEFAULT 0,
  supplier text,
  received_at timestamptz NOT NULL DEFAULT now(),
  received_by uuid REFERENCES auth.users(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (quantity_on_hand >= 0)
);
CREATE INDEX ON public.inventory_batches(item_id, expiry_date NULLS LAST);
CREATE INDEX ON public.inventory_batches(hospital_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_batches TO authenticated;
GRANT ALL ON public.inventory_batches TO service_role;
ALTER TABLE public.inventory_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hospital members view batches" ON public.inventory_batches FOR SELECT TO authenticated
  USING (public.is_hospital_member(hospital_id));
CREATE POLICY "hospital members write batches" ON public.inventory_batches FOR ALL TO authenticated
  USING (public.is_hospital_member(hospital_id))
  WITH CHECK (public.is_hospital_member(hospital_id));

CREATE TRIGGER inventory_batches_updated BEFORE UPDATE ON public.inventory_batches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ stock_movements ============
CREATE TABLE public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  batch_id uuid REFERENCES public.inventory_batches(id) ON DELETE SET NULL,
  movement_type public.stock_movement_type NOT NULL,
  quantity numeric(14,3) NOT NULL,
  unit_cost numeric(12,2),
  reason text,
  patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  prescription_id uuid,
  performed_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.stock_movements(hospital_id, created_at DESC);
CREATE INDEX ON public.stock_movements(item_id, created_at DESC);
CREATE INDEX ON public.stock_movements(patient_id);

GRANT SELECT, INSERT ON public.stock_movements TO authenticated;
GRANT ALL ON public.stock_movements TO service_role;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hospital members view movements" ON public.stock_movements FOR SELECT TO authenticated
  USING (public.is_hospital_member(hospital_id));
CREATE POLICY "hospital members insert movements" ON public.stock_movements FOR INSERT TO authenticated
  WITH CHECK (public.is_hospital_member(hospital_id));

-- ============ prescriptions ============
CREATE TABLE public.prescriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  prescribed_by uuid REFERENCES auth.users(id),
  status public.prescription_status NOT NULL DEFAULT 'pending',
  notes text,
  dispensed_at timestamptz,
  dispensed_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.prescriptions(hospital_id, status, created_at DESC);
CREATE INDEX ON public.prescriptions(patient_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prescriptions TO authenticated;
GRANT ALL ON public.prescriptions TO service_role;
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hospital members view prescriptions" ON public.prescriptions FOR SELECT TO authenticated
  USING (public.is_hospital_member(hospital_id));
CREATE POLICY "hospital members write prescriptions" ON public.prescriptions FOR ALL TO authenticated
  USING (public.is_hospital_member(hospital_id))
  WITH CHECK (public.is_hospital_member(hospital_id));

CREATE TRIGGER prescriptions_updated BEFORE UPDATE ON public.prescriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.stock_movements
  ADD CONSTRAINT stock_movements_prescription_fk FOREIGN KEY (prescription_id)
  REFERENCES public.prescriptions(id) ON DELETE SET NULL;

-- ============ prescription_items ============
CREATE TABLE public.prescription_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id uuid NOT NULL REFERENCES public.prescriptions(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  dosage text,
  frequency text,
  route text,
  duration_days integer,
  quantity_ordered numeric(14,3) NOT NULL,
  quantity_dispensed numeric(14,3) NOT NULL DEFAULT 0,
  instructions text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (quantity_ordered > 0),
  CHECK (quantity_dispensed >= 0 AND quantity_dispensed <= quantity_ordered)
);
CREATE INDEX ON public.prescription_items(prescription_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prescription_items TO authenticated;
GRANT ALL ON public.prescription_items TO service_role;
ALTER TABLE public.prescription_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "presc items follow parent" ON public.prescription_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.prescriptions p WHERE p.id = prescription_id AND public.is_hospital_member(p.hospital_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.prescriptions p WHERE p.id = prescription_id AND public.is_hospital_member(p.hospital_id)));

-- ============ patient_embeddings ============
CREATE TABLE public.patient_embeddings (
  patient_id uuid PRIMARY KEY REFERENCES public.patients(id) ON DELETE CASCADE,
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  embedding vector(1536) NOT NULL,
  source_text text NOT NULL,
  model_version text NOT NULL DEFAULT 'openai/text-embedding-3-small',
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX patient_embeddings_hnsw ON public.patient_embeddings
  USING hnsw (embedding vector_cosine_ops);
CREATE INDEX ON public.patient_embeddings(hospital_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_embeddings TO authenticated;
GRANT ALL ON public.patient_embeddings TO service_role;
ALTER TABLE public.patient_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hospital members read embeddings" ON public.patient_embeddings FOR SELECT TO authenticated
  USING (public.is_hospital_member(hospital_id));
CREATE POLICY "hospital members write embeddings" ON public.patient_embeddings FOR ALL TO authenticated
  USING (public.is_hospital_member(hospital_id))
  WITH CHECK (public.is_hospital_member(hospital_id));

-- ============ AI dedup RPC ============
CREATE OR REPLACE FUNCTION public.match_patients_by_embedding(
  _hospital_id uuid,
  _query vector(1536),
  _limit int DEFAULT 5,
  _min_similarity float DEFAULT 0.75
)
RETURNS TABLE (
  patient_id uuid,
  mrn text,
  first_name text,
  last_name text,
  phone text,
  date_of_birth date,
  similarity float
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.mrn, p.first_name, p.last_name, p.phone, p.date_of_birth,
         1 - (e.embedding <=> _query) AS similarity
  FROM public.patient_embeddings e
  JOIN public.patients p ON p.id = e.patient_id
  WHERE e.hospital_id = _hospital_id
    AND p.merged_into IS NULL
    AND public.is_hospital_member(_hospital_id)
    AND (1 - (e.embedding <=> _query)) >= _min_similarity
  ORDER BY e.embedding <=> _query
  LIMIT _limit;
$$;

REVOKE ALL ON FUNCTION public.match_patients_by_embedding(uuid, vector, int, float) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_patients_by_embedding(uuid, vector, int, float) TO authenticated, service_role;

-- ============ Dispense RPC (atomic FIFO batch consumption) ============
CREATE OR REPLACE FUNCTION public.dispense_prescription(
  _prescription_id uuid,
  _lines jsonb  -- [{"prescription_item_id":"...", "quantity": 10}, ...]
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_hospital_id uuid;
  v_patient_id uuid;
  v_line jsonb;
  v_pi record;
  v_remaining numeric;
  v_batch record;
  v_take numeric;
  v_total_ordered numeric;
  v_total_dispensed numeric;
  v_new_status public.prescription_status;
BEGIN
  SELECT hospital_id, patient_id INTO v_hospital_id, v_patient_id
    FROM public.prescriptions WHERE id = _prescription_id;
  IF v_hospital_id IS NULL THEN RAISE EXCEPTION 'Prescription not found'; END IF;
  IF NOT public.is_hospital_member(v_hospital_id) THEN RAISE EXCEPTION 'Forbidden'; END IF;

  FOR v_line IN SELECT * FROM jsonb_array_elements(_lines) LOOP
    SELECT * INTO v_pi FROM public.prescription_items
      WHERE id = (v_line->>'prescription_item_id')::uuid AND prescription_id = _prescription_id;
    IF v_pi.id IS NULL THEN RAISE EXCEPTION 'Line not found: %', v_line; END IF;

    v_remaining := (v_line->>'quantity')::numeric;
    IF v_remaining <= 0 THEN CONTINUE; END IF;
    IF v_pi.quantity_dispensed + v_remaining > v_pi.quantity_ordered THEN
      RAISE EXCEPTION 'Dispense exceeds ordered qty for item %', v_pi.item_id;
    END IF;

    -- FIFO: earliest expiry first, then oldest received
    FOR v_batch IN
      SELECT * FROM public.inventory_batches
      WHERE item_id = v_pi.item_id AND hospital_id = v_hospital_id AND quantity_on_hand > 0
        AND (expiry_date IS NULL OR expiry_date >= CURRENT_DATE)
      ORDER BY expiry_date NULLS LAST, received_at ASC
      FOR UPDATE
    LOOP
      EXIT WHEN v_remaining <= 0;
      v_take := LEAST(v_remaining, v_batch.quantity_on_hand);
      UPDATE public.inventory_batches
        SET quantity_on_hand = quantity_on_hand - v_take
        WHERE id = v_batch.id;
      INSERT INTO public.stock_movements
        (hospital_id, item_id, batch_id, movement_type, quantity, unit_cost, reason,
         patient_id, prescription_id, performed_by)
        VALUES (v_hospital_id, v_pi.item_id, v_batch.id, 'dispense', v_take,
                v_batch.cost_price, 'Prescription dispense',
                v_patient_id, _prescription_id, auth.uid());
      v_remaining := v_remaining - v_take;
    END LOOP;

    IF v_remaining > 0 THEN
      RAISE EXCEPTION 'Insufficient stock for item % (short by %)', v_pi.item_id, v_remaining;
    END IF;

    UPDATE public.prescription_items
      SET quantity_dispensed = quantity_dispensed + (v_line->>'quantity')::numeric
      WHERE id = v_pi.id;
  END LOOP;

  SELECT COALESCE(SUM(quantity_ordered),0), COALESCE(SUM(quantity_dispensed),0)
    INTO v_total_ordered, v_total_dispensed
    FROM public.prescription_items WHERE prescription_id = _prescription_id;

  v_new_status := CASE
    WHEN v_total_dispensed >= v_total_ordered THEN 'dispensed'::public.prescription_status
    WHEN v_total_dispensed > 0 THEN 'partial'::public.prescription_status
    ELSE 'pending'::public.prescription_status
  END;

  UPDATE public.prescriptions
    SET status = v_new_status,
        dispensed_at = CASE WHEN v_new_status = 'dispensed' THEN now() ELSE dispensed_at END,
        dispensed_by = CASE WHEN v_new_status = 'dispensed' THEN auth.uid() ELSE dispensed_by END
    WHERE id = _prescription_id;

  RETURN jsonb_build_object('status', v_new_status, 'ordered', v_total_ordered, 'dispensed', v_total_dispensed);
END;
$$;

REVOKE ALL ON FUNCTION public.dispense_prescription(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dispense_prescription(uuid, jsonb) TO authenticated, service_role;
