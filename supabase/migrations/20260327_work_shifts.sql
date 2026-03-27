-- Work Shifts
-- Configurable production shift schedule.
-- Each row represents one shift (e.g. "Turno 1 06:00-14:00").
-- The scheduler uses only active shifts to determine valid work windows.

CREATE TABLE IF NOT EXISTS work_shifts (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name         TEXT        NOT NULL,
    start_time   TIME        NOT NULL,   -- e.g. '06:00:00'
    end_time     TIME        NOT NULL,   -- e.g. '14:00:00'
    days_of_week INTEGER[]   NOT NULL DEFAULT '{1,2,3,4,5,6}', -- 0=Sun 1=Mon … 6=Sat
    active       BOOLEAN     NOT NULL DEFAULT true,
    sort_order   INTEGER     NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Default seed: two shifts that together replicate the legacy 06:00-22:00 window
INSERT INTO work_shifts (name, start_time, end_time, days_of_week, active, sort_order)
VALUES
    ('Turno 1', '06:00:00', '14:00:00', '{1,2,3,4,5,6}', true, 1),
    ('Turno 2', '14:00:00', '22:00:00', '{1,2,3,4,5,6}', true, 2)
ON CONFLICT DO NOTHING;

-- Index for quick lookup of active shifts ordered for display
CREATE INDEX IF NOT EXISTS idx_work_shifts_active_sort ON work_shifts (active, sort_order);

-- RLS: admin and produccion can read; only admin can write
ALTER TABLE work_shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shifts_read_admin_produccion"
    ON work_shifts FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.id = auth.uid()
            AND user_profiles.roles && ARRAY['admin', 'produccion']
        )
    );

CREATE POLICY "shifts_write_admin"
    ON work_shifts FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.id = auth.uid()
            AND user_profiles.roles && ARRAY['admin']
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.id = auth.uid()
            AND user_profiles.roles && ARRAY['admin']
        )
    );
