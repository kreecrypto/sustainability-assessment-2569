-- A monotonically increasing epoch to invalidate stale participant score states
-- after the authorized meeting administrator resets the assessment.
ALTER TABLE assessment_state
  ADD COLUMN IF NOT EXISTS reset_generation BIGINT NOT NULL DEFAULT 0;

COMMENT ON COLUMN assessment_state.reset_generation
  IS 'Increments for every administrator reset; clients resync when this value changes.';
