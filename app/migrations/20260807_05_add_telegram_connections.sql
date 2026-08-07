-- Secure Telegram account linking for Ministry notification delivery.

CREATE TABLE IF NOT EXISTS telegram_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  telegram_user_id STRING NOT NULL,
  chat_id STRING NOT NULL UNIQUE,
  username STRING NULL,
  first_name STRING NULL,
  last_name STRING NULL,
  status STRING NOT NULL DEFAULT 'active',
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  disconnected_at TIMESTAMPTZ NULL,
  last_success_at TIMESTAMPTZ NULL,
  last_error STRING NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT telegram_connections_status_check
    CHECK (status IN ('active', 'disconnected', 'blocked'))
);

CREATE INDEX IF NOT EXISTS telegram_connections_account_status_idx
  ON telegram_connections (account_user_id, status);

CREATE TABLE IF NOT EXISTS telegram_connection_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash STRING NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS telegram_connection_tokens_account_idx
  ON telegram_connection_tokens (account_user_id, expires_at DESC);

CREATE INDEX IF NOT EXISTS telegram_connection_tokens_expiry_idx
  ON telegram_connection_tokens (expires_at, used_at);
