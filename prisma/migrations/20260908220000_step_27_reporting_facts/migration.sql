CREATE TABLE service_desk.ticket_reporting_facts (
  ticket_id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  property_id uuid NOT NULL,
  property_name text NOT NULL,
  reporting_timezone text NOT NULL,
  department_id uuid,
  department_name text,
  category_id uuid NOT NULL,
  category_name text NOT NULL,
  primary_asset_id uuid,
  asset_tag text,
  asset_name text,
  asset_location_name text,
  assignee_user_id uuid,
  assignee_display_name text,
  source text NOT NULL,
  priority text NOT NULL,
  status text NOT NULL,
  ticket_created_at timestamptz(6) NOT NULL,
  first_responded_at timestamptz(6),
  resolved_at timestamptz(6),
  closed_at timestamptz(6),
  cancelled_at timestamptz(6),
  requester_waiting_seconds integer NOT NULL DEFAULT 0,
  requester_waiting_since timestamptz(6),
  reopen_count integer NOT NULL DEFAULT 0,
  sla_policy_snapshot jsonb,
  sla_response_due_at timestamptz(6),
  sla_resolution_due_at timestamptz(6),
  is_alert_generated boolean NOT NULL DEFAULT false,
  captured_at timestamptz(6) NOT NULL DEFAULT current_timestamp,
  updated_at timestamptz(6) NOT NULL DEFAULT current_timestamp,
  CONSTRAINT ticket_reporting_facts_ticket_identity UNIQUE (ticket_id, organization_id),
  CONSTRAINT ticket_reporting_facts_ticket_fk FOREIGN KEY (ticket_id, organization_id)
    REFERENCES service_desk.tickets(id, organization_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT ticket_reporting_facts_organization_fk FOREIGN KEY (organization_id)
    REFERENCES service_desk.organizations(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT ticket_reporting_facts_waiting_nonnegative CHECK (requester_waiting_seconds >= 0),
  CONSTRAINT ticket_reporting_facts_reopen_nonnegative CHECK (reopen_count >= 0),
  CONSTRAINT ticket_reporting_facts_priority_allowed CHECK (priority IN ('P1', 'P2', 'P3', 'P4')),
  CONSTRAINT ticket_reporting_facts_snapshot_shape CHECK (
    sla_policy_snapshot IS NULL OR jsonb_typeof(sla_policy_snapshot) = 'object'
  )
);

CREATE INDEX ticket_reporting_facts_period_idx
  ON service_desk.ticket_reporting_facts (organization_id, ticket_created_at DESC);
CREATE INDEX ticket_reporting_facts_property_period_idx
  ON service_desk.ticket_reporting_facts (organization_id, property_id, ticket_created_at DESC);
CREATE INDEX ticket_reporting_facts_status_period_idx
  ON service_desk.ticket_reporting_facts (organization_id, status, ticket_created_at DESC);
CREATE INDEX ticket_reporting_facts_category_period_idx
  ON service_desk.ticket_reporting_facts (organization_id, category_id, ticket_created_at DESC);
CREATE INDEX ticket_reporting_facts_assignee_open_idx
  ON service_desk.ticket_reporting_facts (organization_id, assignee_user_id, status)
  WHERE assignee_user_id IS NOT NULL AND status NOT IN ('resolved', 'closed', 'cancelled');
CREATE INDEX ticket_reporting_facts_asset_period_idx
  ON service_desk.ticket_reporting_facts (organization_id, primary_asset_id, ticket_created_at DESC)
  WHERE primary_asset_id IS NOT NULL;

CREATE FUNCTION service_desk.capture_ticket_reporting_fact()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, service_desk
AS $$
DECLARE
  property_row record;
  department_label text;
  category_label text;
  asset_row record;
  assignee_label text;
  asset_location text;
BEGIN
  SELECT name, timezone INTO STRICT property_row
  FROM service_desk.properties WHERE id = NEW.property_id AND organization_id = NEW.organization_id;

  SELECT name INTO department_label FROM service_desk.departments
  WHERE id = NEW.department_id AND organization_id = NEW.organization_id;
  SELECT name INTO STRICT category_label FROM service_desk.ticket_categories
  WHERE id = NEW.category_id AND organization_id = NEW.organization_id;
  SELECT a.asset_tag, a.name, concat_ws(' · ', p.name, b.name, l.name)
    INTO asset_row
  FROM service_desk.assets a
  JOIN service_desk.properties p ON p.id = a.property_id AND p.organization_id = a.organization_id
  LEFT JOIN service_desk.building_areas b ON b.id = a.building_area_id AND b.organization_id = a.organization_id
  LEFT JOIN service_desk.service_locations l ON l.id = a.service_location_id AND l.organization_id = a.organization_id
  WHERE a.id = NEW.primary_asset_id AND a.organization_id = NEW.organization_id;
  asset_location := NULLIF(asset_row.concat_ws, '');
  SELECT display_name INTO assignee_label FROM service_desk.users
  WHERE id = NEW.assignee_user_id AND organization_id = NEW.organization_id;

  INSERT INTO service_desk.ticket_reporting_facts (
    ticket_id, organization_id, property_id, property_name, reporting_timezone,
    department_id, department_name, category_id, category_name,
    primary_asset_id, asset_tag, asset_name, asset_location_name,
    assignee_user_id, assignee_display_name, source, priority, status,
    ticket_created_at, first_responded_at, resolved_at, closed_at, cancelled_at,
    requester_waiting_seconds, requester_waiting_since, reopen_count,
    sla_policy_snapshot, sla_response_due_at, sla_resolution_due_at, is_alert_generated,
    captured_at, updated_at
  ) VALUES (
    NEW.id, NEW.organization_id, NEW.property_id, property_row.name, property_row.timezone,
    NEW.department_id, department_label, NEW.category_id, category_label,
    NEW.primary_asset_id, asset_row.asset_tag, asset_row.name, asset_location,
    NEW.assignee_user_id, assignee_label, NEW.source, NEW.priority, NEW.status,
    NEW.created_at, NEW.sla_responded_at, NEW.resolved_at, NEW.closed_at, NEW.cancelled_at,
    NEW.sla_paused_seconds, NEW.sla_waiting_at, 0,
    NEW.sla_policy_snapshot, NEW.sla_response_due_at, NEW.sla_resolution_due_at,
    EXISTS (SELECT 1 FROM service_desk.level_alert_correlations c
            WHERE c.ticket_id = NEW.id AND c.organization_id = NEW.organization_id),
    current_timestamp, current_timestamp
  )
  ON CONFLICT (ticket_id) DO UPDATE SET
    property_id = EXCLUDED.property_id,
    property_name = CASE WHEN OLD.property_id IS DISTINCT FROM NEW.property_id THEN EXCLUDED.property_name ELSE ticket_reporting_facts.property_name END,
    reporting_timezone = CASE WHEN OLD.property_id IS DISTINCT FROM NEW.property_id THEN EXCLUDED.reporting_timezone ELSE ticket_reporting_facts.reporting_timezone END,
    department_id = EXCLUDED.department_id,
    department_name = CASE WHEN OLD.department_id IS DISTINCT FROM NEW.department_id THEN EXCLUDED.department_name ELSE ticket_reporting_facts.department_name END,
    category_id = EXCLUDED.category_id,
    category_name = CASE WHEN OLD.category_id IS DISTINCT FROM NEW.category_id THEN EXCLUDED.category_name ELSE ticket_reporting_facts.category_name END,
    primary_asset_id = EXCLUDED.primary_asset_id,
    asset_tag = CASE WHEN OLD.primary_asset_id IS DISTINCT FROM NEW.primary_asset_id THEN EXCLUDED.asset_tag ELSE ticket_reporting_facts.asset_tag END,
    asset_name = CASE WHEN OLD.primary_asset_id IS DISTINCT FROM NEW.primary_asset_id THEN EXCLUDED.asset_name ELSE ticket_reporting_facts.asset_name END,
    asset_location_name = CASE WHEN OLD.primary_asset_id IS DISTINCT FROM NEW.primary_asset_id THEN EXCLUDED.asset_location_name ELSE ticket_reporting_facts.asset_location_name END,
    assignee_user_id = EXCLUDED.assignee_user_id,
    assignee_display_name = CASE WHEN OLD.assignee_user_id IS DISTINCT FROM NEW.assignee_user_id THEN EXCLUDED.assignee_display_name ELSE ticket_reporting_facts.assignee_display_name END,
    source = EXCLUDED.source,
    priority = EXCLUDED.priority,
    status = EXCLUDED.status,
    first_responded_at = EXCLUDED.first_responded_at,
    resolved_at = EXCLUDED.resolved_at,
    closed_at = EXCLUDED.closed_at,
    cancelled_at = EXCLUDED.cancelled_at,
    requester_waiting_seconds = EXCLUDED.requester_waiting_seconds,
    requester_waiting_since = EXCLUDED.requester_waiting_since,
    reopen_count = ticket_reporting_facts.reopen_count + CASE
      WHEN OLD.status IN ('resolved', 'closed', 'cancelled') AND NEW.status NOT IN ('resolved', 'closed', 'cancelled') THEN 1 ELSE 0 END,
    sla_policy_snapshot = EXCLUDED.sla_policy_snapshot,
    sla_response_due_at = EXCLUDED.sla_response_due_at,
    sla_resolution_due_at = EXCLUDED.sla_resolution_due_at,
    updated_at = current_timestamp;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tickets_capture_reporting_fact
AFTER INSERT OR UPDATE ON service_desk.tickets
FOR EACH ROW EXECUTE FUNCTION service_desk.capture_ticket_reporting_fact();

INSERT INTO service_desk.ticket_reporting_facts (
  ticket_id, organization_id, property_id, property_name, reporting_timezone,
  department_id, department_name, category_id, category_name,
  primary_asset_id, asset_tag, asset_name, asset_location_name,
  assignee_user_id, assignee_display_name, source, priority, status,
  ticket_created_at, first_responded_at, resolved_at, closed_at, cancelled_at,
  requester_waiting_seconds, requester_waiting_since, reopen_count,
  sla_policy_snapshot, sla_response_due_at, sla_resolution_due_at, is_alert_generated
)
SELECT
  t.id, t.organization_id, t.property_id, p.name, p.timezone,
  t.department_id, d.name, t.category_id, c.name,
  t.primary_asset_id, a.asset_tag, a.name,
  NULLIF(concat_ws(' · ', ap.name, b.name, l.name), ''),
  t.assignee_user_id, u.display_name, t.source, t.priority, t.status,
  t.created_at, t.sla_responded_at, t.resolved_at, t.closed_at, t.cancelled_at,
  t.sla_paused_seconds, t.sla_waiting_at,
  (SELECT count(*)::integer FROM service_desk.ticket_activities ta
   WHERE ta.ticket_id = t.id AND ta.organization_id = t.organization_id
     AND ta.activity_type = 'status_changed'
     AND ta.from_status IN ('resolved', 'closed', 'cancelled')
     AND ta.to_status NOT IN ('resolved', 'closed', 'cancelled')),
  t.sla_policy_snapshot, t.sla_response_due_at, t.sla_resolution_due_at,
  EXISTS (SELECT 1 FROM service_desk.level_alert_correlations lac
          WHERE lac.ticket_id = t.id AND lac.organization_id = t.organization_id)
FROM service_desk.tickets t
JOIN service_desk.properties p ON p.id = t.property_id AND p.organization_id = t.organization_id
JOIN service_desk.ticket_categories c ON c.id = t.category_id AND c.organization_id = t.organization_id
LEFT JOIN service_desk.departments d ON d.id = t.department_id AND d.organization_id = t.organization_id
LEFT JOIN service_desk.assets a ON a.id = t.primary_asset_id AND a.organization_id = t.organization_id
LEFT JOIN service_desk.properties ap ON ap.id = a.property_id AND ap.organization_id = a.organization_id
LEFT JOIN service_desk.building_areas b ON b.id = a.building_area_id AND b.organization_id = a.organization_id
LEFT JOIN service_desk.service_locations l ON l.id = a.service_location_id AND l.organization_id = a.organization_id
LEFT JOIN service_desk.users u ON u.id = t.assignee_user_id AND u.organization_id = t.organization_id;

CREATE FUNCTION service_desk.mark_alert_generated_reporting_fact()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, service_desk
AS $$
BEGIN
  UPDATE service_desk.ticket_reporting_facts
  SET is_alert_generated = true, updated_at = current_timestamp
  WHERE ticket_id = NEW.ticket_id AND organization_id = NEW.organization_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER level_alert_correlations_mark_reporting_fact
AFTER INSERT ON service_desk.level_alert_correlations
FOR EACH ROW EXECUTE FUNCTION service_desk.mark_alert_generated_reporting_fact();

REVOKE ALL ON TABLE service_desk.ticket_reporting_facts FROM anon, authenticated;
REVOKE ALL ON FUNCTION service_desk.capture_ticket_reporting_fact() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION service_desk.mark_alert_generated_reporting_fact() FROM PUBLIC, anon, authenticated;
