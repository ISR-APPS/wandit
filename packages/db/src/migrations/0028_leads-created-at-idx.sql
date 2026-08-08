-- Dashboard aggregate leads list: the workspace-wide query orders by
-- (created_at DESC, id DESC) with no project_id equality, which neither
-- projectId-prefixed index can serve. A bare recency index lets Postgres
-- walk newest-first and stop at the page size instead of sorting the whole
-- lead book on every 15-second poll.
CREATE INDEX IF NOT EXISTS "leads_createdAt_id_idx" ON "leads" ("created_at", "id");
