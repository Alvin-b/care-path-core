REVOKE EXECUTE ON FUNCTION public.find_patient_duplicates(uuid,text,text,date,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_patient_duplicates(uuid,text,text,date,text,text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.generate_patient_mrn() FROM PUBLIC, anon;