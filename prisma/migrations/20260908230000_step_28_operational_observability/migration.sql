CREATE TABLE service_desk.operational_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  severity text NOT NULL,
  component text NOT NULL,
  event_type text NOT NULL,
  error_code text,
  correlation_id uuid NOT NULL,
  entity_type text,
  entity_id text,
  safe_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz(6) NOT NULL,
  resolved_at timestamptz(6),
  resolution_note text,
  created_at timestamptz(6) NOT NULL DEFAULT current_timestamp,
  updated_at timestamptz(6) NOT NULL DEFAULT current_timestamp,
  CONSTRAINT operational_events_identity_key UNIQUE (id, organization_id),
  CONSTRAINT operational_events_organization_fk FOREIGN KEY (organization_id)
    REFERENCES service_desk.organizations(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT operational_events_severity_check CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  CONSTRAINT operational_events_component_format CHECK (component ~ '^[a-z][a-z0-9_.-]{1,79}$'),
  CONSTRAINT operational_events_type_format CHECK (event_type ~ '^[a-z][a-z0-9_.-]{2,99}$'),
  CONSTRAINT operational_events_error_format CHECK (error_code IS NULL OR error_code ~ '^[a-z][a-z0-9_.-]{1,79}$'),
  CONSTRAINT operational_events_entity_size CHECK (
    (entity_type IS NULL OR length(entity_type) <= 80) AND
    (entity_id IS NULL OR length(entity_id) <= 200)
  ),
  CONSTRAINT operational_events_context_object CHECK (jsonb_typeof(safe_context) = 'object'),
  CONSTRAINT operational_events_context_size CHECK (pg_column_size(safe_context) <= 4096),
  CONSTRAINT operational_events_context_safe CHECK (service_desk.audit_context_is_safe(safe_context)),
  CONSTRAINT operational_events_resolution_check CHECK (
    (resolved_at IS NULL AND resolution_note IS NULL) OR
    (resolved_at IS NOT NULL AND resolution_note IS NOT NULL AND length(btrim(resolution_note)) BETWEEN 3 AND 500)
  )
);

CREATE INDEX operational_events_unresolved_idx
  ON service_desk.operational_events (organization_id, severity, occurred_at DESC)
  WHERE resolved_at IS NULL;
CREATE INDEX operational_events_component_type_idx
  ON service_desk.operational_events (organization_id, component, event_type, occurred_at DESC);
CREATE INDEX operational_events_correlation_idx
  ON service_desk.operational_events (correlation_id);

CREATE TABLE service_desk.worker_heartbeats (
  instance_id text PRIMARY KEY,
  component text NOT NULL DEFAULT 'background-worker',
  status text NOT NULL DEFAULT 'healthy',
  safe_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz(6) NOT NULL,
  last_seen_at timestamptz(6) NOT NULL,
  updated_at timestamptz(6) NOT NULL DEFAULT current_timestamp,
  CONSTRAINT worker_heartbeats_instance_size CHECK (length(instance_id) BETWEEN 3 AND 200),
  CONSTRAINT worker_heartbeats_component_format CHECK (component ~ '^[a-z][a-z0-9_.-]{1,79}$'),
  CONSTRAINT worker_heartbeats_status_check CHECK (status IN ('healthy', 'degraded', 'stopping')),
  CONSTRAINT worker_heartbeats_context_object CHECK (jsonb_typeof(safe_context) = 'object'),
  CONSTRAINT worker_heartbeats_context_size CHECK (pg_column_size(safe_context) <= 2048),
  CONSTRAINT worker_heartbeats_context_safe CHECK (service_desk.audit_context_is_safe(safe_context))
);

CREATE INDEX worker_heartbeats_component_seen_idx
  ON service_desk.worker_heartbeats (component, last_seen_at DESC);

CREATE TRIGGER operational_events_set_updated_at
BEFORE UPDATE ON service_desk.operational_events
FOR EACH ROW EXECUTE FUNCTION service_desk.set_updated_at();
CREATE TRIGGER worker_heartbeats_set_updated_at
BEFORE UPDATE ON service_desk.worker_heartbeats
FOR EACH ROW EXECUTE FUNCTION service_desk.set_updated_at();

CREATE FUNCTION service_desk.protect_operational_event()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'operational events are retained';
  END IF;
  IF ROW(NEW.id, NEW.organization_id, NEW.severity, NEW.component, NEW.event_type,
         NEW.error_code, NEW.correlation_id, NEW.entity_type, NEW.entity_id,
         NEW.safe_context, NEW.occurred_at, NEW.created_at)
     IS DISTINCT FROM
     ROW(OLD.id, OLD.organization_id, OLD.severity, OLD.component, OLD.event_type,
         OLD.error_code, OLD.correlation_id, OLD.entity_type, OLD.entity_id,
         OLD.safe_context, OLD.occurred_at, OLD.created_at) THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'operational event evidence is immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER operational_events_protect
BEFORE UPDATE OR DELETE ON service_desk.operational_events
FOR EACH ROW EXECUTE FUNCTION service_desk.protect_operational_event();

REVOKE ALL ON TABLE service_desk.operational_events FROM anon, authenticated;
REVOKE ALL ON TABLE service_desk.worker_heartbeats FROM anon, authenticated;
REVOKE ALL ON FUNCTION service_desk.protect_operational_event() FROM PUBLIC, anon, authenticated;
