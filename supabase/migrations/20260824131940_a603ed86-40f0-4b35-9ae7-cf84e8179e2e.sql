ALTER TABLE public.coach_interventions
  ADD COLUMN IF NOT EXISTS helpfulness_rating smallint;

CREATE OR REPLACE FUNCTION public.validate_helpfulness_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.helpfulness_rating IS NOT NULL AND (NEW.helpfulness_rating < 1 OR NEW.helpfulness_rating > 5) THEN
    RAISE EXCEPTION 'helpfulness_rating must be between 1 and 5';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS coach_interventions_validate_rating ON public.coach_interventions;
CREATE TRIGGER coach_interventions_validate_rating
BEFORE INSERT OR UPDATE ON public.coach_interventions
FOR EACH ROW EXECUTE FUNCTION public.validate_helpfulness_rating();