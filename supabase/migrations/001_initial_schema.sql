-- =============================================================================
-- Claude Voice Commander - Initial Database Schema
-- =============================================================================
-- Run this in your Supabase SQL Editor to set up the database
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Sessions Table
-- -----------------------------------------------------------------------------
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  tmux_session VARCHAR(100) NOT NULL,
  project_path TEXT,
  description TEXT,
  initial_prompt TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'created',
  -- Status values: created, running, idle, waiting_input, error, stopped, killed, preserved
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ,
  last_output_preview TEXT, -- Last 500 chars of output for quick preview
  error_count INTEGER DEFAULT 0,
  is_preserved BOOLEAN DEFAULT FALSE, -- Survived a Pi reboot
  metadata JSONB DEFAULT '{}',

  CONSTRAINT sessions_name_unique UNIQUE (name)
);

-- -----------------------------------------------------------------------------
-- Calls Table
-- -----------------------------------------------------------------------------
CREATE TABLE calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  direction VARCHAR(10) NOT NULL, -- 'inbound', 'outbound'
  telnyx_call_control_id VARCHAR(100),
  telnyx_call_leg_id VARCHAR(100),
  status VARCHAR(20) NOT NULL,
  -- Status values: initiated, ringing, in-progress, completed, voicemail, failed, no-answer
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  recording_url TEXT,
  recording_duration_seconds INTEGER,
  transcript TEXT,
  related_session_ids UUID[], -- Sessions discussed in this call
  attention_items_resolved INTEGER DEFAULT 0,
  caller_number VARCHAR(20),
  metadata JSONB DEFAULT '{}'
);

-- -----------------------------------------------------------------------------
-- Attention Items Table
-- -----------------------------------------------------------------------------
CREATE TABLE attention_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL, -- 'question', 'error', 'completion', 'blocking'
  priority INTEGER DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  -- Priority: 5=error(30s), 4=blocking(60s), 3=question(2m), 2=minor(3m), 1=completion(5m)
  content TEXT NOT NULL, -- The question or error message
  context TEXT, -- Surrounding output for context (20-50 lines)
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by VARCHAR(20), -- 'call', 'sms', 'dashboard', 'auto'
  resolution_content TEXT, -- User's response
  call_id UUID REFERENCES calls(id),
  batch_id UUID, -- Groups items sent in same call
  metadata JSONB DEFAULT '{}'
);

-- -----------------------------------------------------------------------------
-- Session Output Table (rotating history)
-- -----------------------------------------------------------------------------
CREATE TABLE session_output (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL,
  content TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- Audit Logs Table
-- -----------------------------------------------------------------------------
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(50) NOT NULL,
  -- Event types: session.*, call.*, attention.*, message.*, notification.*, system.*
  session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  call_id UUID REFERENCES calls(id) ON DELETE SET NULL,
  actor VARCHAR(50) NOT NULL, -- 'user', 'system', 'claude'
  description TEXT,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- Decisions Table (for Claude context)
-- -----------------------------------------------------------------------------
CREATE TABLE decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  context TEXT, -- Additional context about why this decision was made
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- Notifications Table
-- -----------------------------------------------------------------------------
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel VARCHAR(20) NOT NULL, -- 'sms', 'slack', 'email', 'voicemail'
  status VARCHAR(20) NOT NULL, -- 'pending', 'sent', 'delivered', 'failed'
  recipient TEXT,
  content TEXT,
  related_attention_items UUID[],
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  resend_email_id VARCHAR(100), -- For Resend tracking
  metadata JSONB DEFAULT '{}'
);

-- -----------------------------------------------------------------------------
-- Escalations Table (notification cascade state)
-- -----------------------------------------------------------------------------
CREATE TABLE escalations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL, -- Links to attention_items.batch_id
  status VARCHAR(20) NOT NULL,
  -- Status: pending, calling, voicemail_sent, sms_sent, slack_sent, email_sent, resolved, expired
  attention_item_ids UUID[] NOT NULL,
  call_attempts INTEGER DEFAULT 0,
  last_call_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,
  voicemail_at TIMESTAMPTZ,
  sms_at TIMESTAMPTZ,
  slack_at TIMESTAMPTZ,
  email_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  resolved_via VARCHAR(20), -- 'call', 'sms', 'dashboard'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- System Config Table
-- -----------------------------------------------------------------------------
CREATE TABLE system_config (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default config
INSERT INTO system_config (key, value) VALUES
  ('dnd_enabled', 'false'),
  ('dnd_schedule', 'null'),
  ('notification_channels', '["sms", "slack", "email"]'),
  ('max_sessions', '5'),
  ('poll_interval_ms', '1500');

-- -----------------------------------------------------------------------------
-- Indexes
-- -----------------------------------------------------------------------------
CREATE INDEX idx_sessions_status ON sessions(status);
CREATE INDEX idx_sessions_updated ON sessions(updated_at DESC);
CREATE INDEX idx_sessions_name ON sessions(name);

CREATE INDEX idx_calls_direction ON calls(direction);
CREATE INDEX idx_calls_started ON calls(started_at DESC);
CREATE INDEX idx_calls_telnyx_id ON calls(telnyx_call_control_id);
CREATE INDEX idx_calls_status ON calls(status);

CREATE INDEX idx_attention_unresolved ON attention_items(resolved_at) WHERE resolved_at IS NULL;
CREATE INDEX idx_attention_session ON attention_items(session_id);
CREATE INDEX idx_attention_batch ON attention_items(batch_id);
CREATE INDEX idx_attention_detected ON attention_items(detected_at DESC);

CREATE INDEX idx_output_session_line ON session_output(session_id, line_number DESC);
CREATE INDEX idx_output_timestamp ON session_output(timestamp DESC);

CREATE INDEX idx_audit_event ON audit_logs(event_type);
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_session ON audit_logs(session_id);

CREATE INDEX idx_decisions_session ON decisions(session_id, created_at DESC);

CREATE INDEX idx_notifications_status ON notifications(status);
CREATE INDEX idx_notifications_channel ON notifications(channel);

CREATE INDEX idx_escalations_status ON escalations(status);
CREATE INDEX idx_escalations_batch ON escalations(batch_id);

-- -----------------------------------------------------------------------------
-- Functions
-- -----------------------------------------------------------------------------

-- Function to rotate session output (keep last N lines)
CREATE OR REPLACE FUNCTION rotate_session_output(p_session_id UUID, p_max_lines INTEGER DEFAULT 1000)
RETURNS void AS $$
BEGIN
  DELETE FROM session_output
  WHERE session_id = p_session_id
    AND line_number < (
      SELECT COALESCE(MAX(line_number), 0) - p_max_lines
      FROM session_output
      WHERE session_id = p_session_id
    );
END;
$$ LANGUAGE plpgsql;

-- Function to update session's updated_at timestamp
CREATE OR REPLACE FUNCTION update_session_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sessions_updated_at
  BEFORE UPDATE ON sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_session_timestamp();

-- Function to update escalation's updated_at timestamp
CREATE OR REPLACE FUNCTION update_escalation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER escalations_updated_at
  BEFORE UPDATE ON escalations
  FOR EACH ROW
  EXECUTE FUNCTION update_escalation_timestamp();

-- -----------------------------------------------------------------------------
-- Enable Realtime for Dashboard
-- -----------------------------------------------------------------------------
-- Note: Run these after the tables are created
ALTER PUBLICATION supabase_realtime ADD TABLE sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE attention_items;
ALTER PUBLICATION supabase_realtime ADD TABLE audit_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE calls;

-- -----------------------------------------------------------------------------
-- Row Level Security (single user for now, can expand later)
-- -----------------------------------------------------------------------------
-- For now, using service role key, so RLS is bypassed
-- When multi-user is implemented, add appropriate policies

-- ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE attention_items ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE decisions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE escalations ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE session_output ENABLE ROW LEVEL SECURITY;
