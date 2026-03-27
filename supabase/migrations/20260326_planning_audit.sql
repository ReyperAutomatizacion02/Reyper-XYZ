    -- Planning Audit Log
    -- Tracks every schedule change (INSERT, UPDATE) made to planning tasks,
    -- recording who changed what and when.

    CREATE TABLE IF NOT EXISTS planning_audit (
        id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        task_id     UUID        NOT NULL,
        order_id    UUID        REFERENCES production_orders(id) ON DELETE SET NULL,
        machine     TEXT,
        action      TEXT        NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
        old_planned_date  TIMESTAMPTZ,
        old_planned_end   TIMESTAMPTZ,
        new_planned_date  TIMESTAMPTZ,
        new_planned_end   TIMESTAMPTZ,
        changed_by  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
        changed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Index for quick lookup by task or by who made changes
    CREATE INDEX IF NOT EXISTS idx_planning_audit_task_id   ON planning_audit (task_id);
    CREATE INDEX IF NOT EXISTS idx_planning_audit_changed_by ON planning_audit (changed_by);
    CREATE INDEX IF NOT EXISTS idx_planning_audit_changed_at ON planning_audit (changed_at DESC);

    -- RLS: only admin and produccion roles can read the audit log; no direct client writes
    ALTER TABLE planning_audit ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "audit_read_admin_produccion"
        ON planning_audit FOR SELECT
        USING (
            EXISTS (
                SELECT 1 FROM user_profiles
                WHERE user_profiles.id = auth.uid()
                AND user_profiles.roles && ARRAY['admin', 'produccion']
            )
        );

    -- No INSERT/UPDATE/DELETE policies: writes happen exclusively from server actions
    -- using the service role key, bypassing RLS.
