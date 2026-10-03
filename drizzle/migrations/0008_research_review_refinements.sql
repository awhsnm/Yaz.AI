ALTER TABLE public.research_message_reviews ADD COLUMN IF NOT EXISTS ai_provided_wording boolean;
-- Re-run auto-labelling under the refined definitions, but only for rows a researcher has not verified.
UPDATE public.research_message_reviews SET auto_classified_at = NULL WHERE review_status = 'unreviewed';