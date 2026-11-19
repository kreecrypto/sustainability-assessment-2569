-- Schema: one vote per topic per browser session (not verified per natural person).
-- Intentionally no personal names, emails or individual-vote publication endpoint.
CREATE TABLE IF NOT EXISTS assessment_state (
 id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
 is_open BOOLEAN NOT NULL DEFAULT TRUE,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO assessment_state (id,is_open) VALUES (1,true) ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS assessment_participants (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 session_hash CHAR(64) NOT NULL UNIQUE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assessment_votes (
 participant_id UUID NOT NULL REFERENCES assessment_participants(id) ON DELETE CASCADE,
 topic_id SMALLINT NOT NULL CHECK(topic_id BETWEEN 1 AND 10),
 necessity SMALLINT NOT NULL CHECK(necessity BETWEEN 1 AND 5),
 complexity SMALLINT NOT NULL CHECK(complexity BETWEEN 1 AND 5),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(participant_id, topic_id)
);
CREATE INDEX IF NOT EXISTS assessment_votes_topic_idx ON assessment_votes(topic_id);
