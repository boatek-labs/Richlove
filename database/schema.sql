CREATE TABLE IF NOT EXISTS proposal_responses (
  id BIGSERIAL PRIMARY KEY,
  choice TEXT NOT NULL CHECK (choice IN ('yes', 'time', 'no')),
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chosen_nicknames (
  id BIGSERIAL PRIMARY KEY,
  nickname TEXT NOT NULL CHECK (char_length(nickname) BETWEEN 1 AND 48),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS questions (
  id BIGSERIAL PRIMARY KEY,
  question TEXT NOT NULL CHECK (char_length(question) BETWEEN 1 AND 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS proposal_responses_created_at_idx
  ON proposal_responses (created_at DESC);

CREATE INDEX IF NOT EXISTS questions_created_at_idx
  ON questions (created_at DESC);
