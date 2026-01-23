-- Función para verificar si todas las partidas de un proyecto están completas
CREATE OR REPLACE FUNCTION check_project_completion() RETURNS TRIGGER AS $$
DECLARE
    target_project_id UUID;
    incomplete_count INTEGER;
    total_count INTEGER;
BEGIN
    -- Determinar el ID del proyecto afectado
    IF (TG_OP = 'DELETE') THEN
        target_project_id := OLD.project_id;
    ELSE
        target_project_id := NEW.project_id;
    END IF;

    -- Si no hay project_id, no hacemos nada
    IF target_project_id IS NULL THEN RETURN NULL; END IF;

    -- 1. Contar total de partidas del proyecto
    SELECT count(*) INTO total_count
    FROM production_orders
    WHERE project_id = target_project_id;

    -- Si el proyecto tiene partidas:
    IF total_count > 0 THEN
        -- 2. Contar cuántas partidas están INCOMPLETAS
        -- Consideramos incompleta cualquier partida que NO sea 'D7- ENTREGADA' ni 'D8-CANCELADA'
        SELECT count(*) INTO incomplete_count
        FROM production_orders
        WHERE project_id = target_project_id
        AND (genral_status IS NULL OR genral_status NOT IN ('D7-ENTREGADA', 'D8-CANCELADA'));

        -- 3. Actualizar estado del proyecto
        IF incomplete_count = 0 THEN
            -- Si no hay incompletas (todas son D7 o D8) -> COMPLETADO
            UPDATE projects 
            SET status = 'completed' 
            WHERE id = target_project_id AND status != 'completed';
        ELSE
            -- Si hay al menos una incompleta -> ACTIVO
            UPDATE projects 
            SET status = 'active' 
            WHERE id = target_project_id AND status != 'active';
        END IF;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Crear el Trigger
DROP TRIGGER IF EXISTS trg_check_project_completion ON production_orders;

CREATE TRIGGER trg_check_project_completion
AFTER INSERT OR UPDATE OR DELETE ON production_orders
FOR EACH ROW EXECUTE FUNCTION check_project_completion();

-- 4. ACTUALIZACIÓN MASIVA INICIAL (Ejecutar una vez)
-- Esto alinea todos los proyectos existentes con la nueva lógica

DO $$
BEGIN
    -- A) Marcar como COMPLETADOS los que ya tienen todo entregado/cancelado
    UPDATE projects p
SET status = 'completed'
WHERE status != 'completed'
  AND EXISTS (SELECT 1 FROM production_orders po WHERE po.project_id = p.id) -- Debe tener partidas
  AND NOT EXISTS (
    -- No debe existir ninguna partida pendiente
    SELECT 1 
    FROM production_orders po 
    WHERE po.project_id = p.id 
      AND (po.genral_status IS NULL OR po.genral_status NOT IN ('D7-ENTREGADA', 'D8-CANCELADA'))
  );

-- B) Marcar como ACTIVOS los que tienen pendientes (por si alguno estaba mal marcado)
UPDATE projects p
SET status = 'active'
WHERE status != 'active'
  AND EXISTS (
    -- Debe existir al menos una partida pendiente
    SELECT 1 
    FROM production_orders po 
    WHERE po.project_id = p.id 
      AND (po.genral_status IS NULL OR po.genral_status NOT IN ('D7-ENTREGADA', 'D8-CANCELADA'))
  );
END $$;
