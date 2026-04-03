-- Migración: RPCs para opciones de filtro sin full table scan
-- Fecha: 2026-04-03
-- Referencia: auditoría 2026-03-31 — hallazgo getFilterOptions() full table scan

CREATE OR REPLACE FUNCTION get_distinct_active_companies()
RETURNS TABLE(company text) AS $$
    SELECT DISTINCT company
    FROM projects
    WHERE status = 'active'
      AND company IS NOT NULL
    ORDER BY company;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_distinct_active_requestors()
RETURNS TABLE(requestor text) AS $$
    SELECT DISTINCT requestor
    FROM projects
    WHERE status = 'active'
      AND requestor IS NOT NULL
    ORDER BY requestor;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Comentario: SECURITY DEFINER + STABLE permite que Supabase cachee el plan y que
-- la función corra con los privilegios del owner, respetando igualmente las
-- políticas de acceso a la tabla projects desde la aplicación.
-- Ejecutar en Supabase Dashboard → SQL Editor.
