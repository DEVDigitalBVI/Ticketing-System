CREATE TABLE service_desk.knowledge_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  title text NOT NULL,
  summary text NOT NULL,
  body text NOT NULL,
  audience text NOT NULL DEFAULT 'staff',
  state text NOT NULL DEFAULT 'draft',
  category_id uuid,
  owner_user_id uuid NOT NULL,
  reviewer_user_id uuid,
  source_ticket_id uuid,
  current_version integer NOT NULL DEFAULT 1,
  review_date date,
  published_at timestamptz,
  retired_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT knowledge_articles_identity_key UNIQUE (id, organization_id),
  CONSTRAINT knowledge_articles_title_length CHECK (char_length(title) BETWEEN 3 AND 180),
  CONSTRAINT knowledge_articles_summary_length CHECK (char_length(summary) BETWEEN 10 AND 500),
  CONSTRAINT knowledge_articles_body_length CHECK (char_length(body) BETWEEN 10 AND 50000),
  CONSTRAINT knowledge_articles_audience_check CHECK (audience IN ('staff', 'technician')),
  CONSTRAINT knowledge_articles_state_check CHECK (state IN ('draft', 'in_review', 'published', 'retired')),
  CONSTRAINT knowledge_articles_version_check CHECK (current_version > 0),
  CONSTRAINT knowledge_articles_publication_check CHECK (
    (state = 'published' AND reviewer_user_id IS NOT NULL AND review_date IS NOT NULL AND published_at IS NOT NULL AND retired_at IS NULL)
    OR (state = 'retired' AND retired_at IS NOT NULL)
    OR state IN ('draft', 'in_review')
  ),
  CONSTRAINT knowledge_articles_organization_fk FOREIGN KEY (organization_id)
    REFERENCES service_desk.organizations(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT knowledge_articles_category_fk FOREIGN KEY (category_id, organization_id)
    REFERENCES service_desk.ticket_categories(id, organization_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT knowledge_articles_owner_fk FOREIGN KEY (owner_user_id, organization_id)
    REFERENCES service_desk.users(id, organization_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT knowledge_articles_reviewer_fk FOREIGN KEY (reviewer_user_id, organization_id)
    REFERENCES service_desk.users(id, organization_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT knowledge_articles_source_ticket_fk FOREIGN KEY (source_ticket_id, organization_id)
    REFERENCES service_desk.tickets(id, organization_id) ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE service_desk.knowledge_article_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  article_id uuid NOT NULL,
  version integer NOT NULL,
  title text NOT NULL,
  summary text NOT NULL,
  body text NOT NULL,
  audience text NOT NULL,
  category_id uuid,
  change_summary text NOT NULL,
  created_by_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT knowledge_article_versions_article_version_key UNIQUE (article_id, version),
  CONSTRAINT knowledge_article_versions_version_check CHECK (version > 0),
  CONSTRAINT knowledge_article_versions_audience_check CHECK (audience IN ('staff', 'technician')),
  CONSTRAINT knowledge_article_versions_change_length CHECK (char_length(change_summary) BETWEEN 3 AND 500),
  CONSTRAINT knowledge_article_versions_organization_fk FOREIGN KEY (organization_id)
    REFERENCES service_desk.organizations(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT knowledge_article_versions_article_fk FOREIGN KEY (article_id, organization_id)
    REFERENCES service_desk.knowledge_articles(id, organization_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT knowledge_article_versions_creator_fk FOREIGN KEY (created_by_user_id, organization_id)
    REFERENCES service_desk.users(id, organization_id) ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE service_desk.knowledge_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  article_id uuid NOT NULL,
  article_version integer NOT NULL,
  user_id uuid NOT NULL,
  helpful boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT knowledge_feedback_once_key UNIQUE (article_id, article_version, user_id),
  CONSTRAINT knowledge_feedback_version_check CHECK (article_version > 0),
  CONSTRAINT knowledge_feedback_organization_fk FOREIGN KEY (organization_id)
    REFERENCES service_desk.organizations(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT knowledge_feedback_article_fk FOREIGN KEY (article_id, organization_id)
    REFERENCES service_desk.knowledge_articles(id, organization_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT knowledge_feedback_user_fk FOREIGN KEY (user_id, organization_id)
    REFERENCES service_desk.users(id, organization_id) ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE service_desk.knowledge_ticket_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  article_id uuid NOT NULL,
  ticket_id uuid NOT NULL,
  linked_by_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT knowledge_ticket_links_once_key UNIQUE (article_id, ticket_id),
  CONSTRAINT knowledge_ticket_links_organization_fk FOREIGN KEY (organization_id)
    REFERENCES service_desk.organizations(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT knowledge_ticket_links_article_fk FOREIGN KEY (article_id, organization_id)
    REFERENCES service_desk.knowledge_articles(id, organization_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT knowledge_ticket_links_ticket_fk FOREIGN KEY (ticket_id, organization_id)
    REFERENCES service_desk.tickets(id, organization_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT knowledge_ticket_links_user_fk FOREIGN KEY (linked_by_user_id, organization_id)
    REFERENCES service_desk.users(id, organization_id) ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE service_desk.knowledge_article_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  article_id uuid NOT NULL,
  asset_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT knowledge_article_assets_once_key UNIQUE (article_id, asset_id),
  CONSTRAINT knowledge_article_assets_organization_fk FOREIGN KEY (organization_id)
    REFERENCES service_desk.organizations(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT knowledge_article_assets_article_fk FOREIGN KEY (article_id, organization_id)
    REFERENCES service_desk.knowledge_articles(id, organization_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT knowledge_article_assets_asset_fk FOREIGN KEY (asset_id, organization_id)
    REFERENCES service_desk.assets(id, organization_id) ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX knowledge_articles_visibility_idx ON service_desk.knowledge_articles (organization_id, state, audience, updated_at DESC);
CREATE INDEX knowledge_articles_review_idx ON service_desk.knowledge_articles (organization_id, review_date) WHERE state = 'published';
CREATE INDEX knowledge_articles_owner_idx ON service_desk.knowledge_articles (owner_user_id, organization_id);
CREATE INDEX knowledge_articles_reviewer_idx ON service_desk.knowledge_articles (reviewer_user_id, organization_id);
CREATE INDEX knowledge_articles_category_idx ON service_desk.knowledge_articles (category_id, organization_id);
CREATE INDEX knowledge_articles_source_ticket_idx ON service_desk.knowledge_articles (source_ticket_id, organization_id);
CREATE INDEX knowledge_versions_history_idx ON service_desk.knowledge_article_versions (article_id, organization_id, version DESC);
CREATE INDEX knowledge_versions_creator_idx ON service_desk.knowledge_article_versions (created_by_user_id, organization_id);
CREATE INDEX knowledge_feedback_summary_idx ON service_desk.knowledge_feedback (organization_id, article_id, article_version);
CREATE INDEX knowledge_feedback_user_idx ON service_desk.knowledge_feedback (user_id, organization_id);
CREATE INDEX knowledge_ticket_links_ticket_idx ON service_desk.knowledge_ticket_links (organization_id, ticket_id, created_at DESC);
CREATE INDEX knowledge_ticket_links_user_idx ON service_desk.knowledge_ticket_links (linked_by_user_id, organization_id);
CREATE INDEX knowledge_article_assets_asset_idx ON service_desk.knowledge_article_assets (organization_id, asset_id);

CREATE OR REPLACE FUNCTION service_desk.prevent_knowledge_version_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, service_desk
AS $$
BEGIN
  RAISE EXCEPTION 'knowledge article versions are immutable';
END;
$$;

CREATE TRIGGER knowledge_article_versions_immutable
BEFORE UPDATE OR DELETE ON service_desk.knowledge_article_versions
FOR EACH ROW EXECUTE FUNCTION service_desk.prevent_knowledge_version_change();

REVOKE ALL ON TABLE service_desk.knowledge_articles FROM anon, authenticated;
REVOKE ALL ON TABLE service_desk.knowledge_article_versions FROM anon, authenticated;
REVOKE ALL ON TABLE service_desk.knowledge_feedback FROM anon, authenticated;
REVOKE ALL ON TABLE service_desk.knowledge_ticket_links FROM anon, authenticated;
REVOKE ALL ON TABLE service_desk.knowledge_article_assets FROM anon, authenticated;
REVOKE ALL ON FUNCTION service_desk.prevent_knowledge_version_change() FROM PUBLIC, anon, authenticated;
