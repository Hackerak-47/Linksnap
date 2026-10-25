CREATE TABLE IF NOT EXISTS links (
  short_code varchar(32) PRIMARY KEY,
  original_url text NOT NULL CHECK (length(original_url) <= 4096),
  title varchar(200) NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT NOW(),
  clicks bigint NOT NULL DEFAULT 0 CHECK (clicks >= 0)
);
CREATE INDEX IF NOT EXISTS links_created_at_idx ON links (created_at DESC, short_code);
