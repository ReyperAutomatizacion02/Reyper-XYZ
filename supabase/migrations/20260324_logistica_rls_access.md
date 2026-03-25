# Migración: Acceso RLS para Rol Logística

**Fecha**: 2026-03-24
**Proyecto**: Reyper XYZ
**Estado**: ⏳ PENDIENTE

## Problema

El rol `logistica` no estaba incluido en las políticas RLS de las tablas que necesita para funcionar.
La página `/dashboard/logistica/proyectos` consume:
- `projects` → lista de proyectos activos
- `production_orders` → conteo de partidas por proyecto
- `sales_clients` → catálogo de clientes (para filtros y edición)
- `sales_contacts` → catálogo de contactos
- `sales_materials` → catálogo de materiales

Sin acceso RLS, Supabase retorna resultados vacíos aunque el usuario esté autenticado.

---

## SQL a ejecutar en Supabase SQL Editor

```sql
-- ============================================================
-- LOGÍSTICA: Acceso de lectura a tablas necesarias
-- ============================================================

-- 1. projects — recrear política SELECT con logistica incluida
DROP POLICY IF EXISTS "projects_select" ON projects;
CREATE POLICY "projects_select" ON projects
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND (
      'admin'         = ANY(roles)
      OR 'automatizacion' = ANY(roles)
      OR 'produccion'     = ANY(roles)
      OR 'operador'       = ANY(roles)
      OR 'logistica'      = ANY(roles)
    )
  )
);

-- 2. production_orders — recrear política SELECT con logistica incluida
DROP POLICY IF EXISTS "production_orders_select" ON production_orders;
CREATE POLICY "production_orders_select" ON production_orders
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND (
      'admin'         = ANY(roles)
      OR 'automatizacion' = ANY(roles)
      OR 'produccion'     = ANY(roles)
      OR 'operador'       = ANY(roles)
      OR 'logistica'      = ANY(roles)
    )
  )
);

-- 3. sales_clients — agregar lectura para logistica
DROP POLICY IF EXISTS "sales_clients_select" ON sales_clients;
CREATE POLICY "sales_clients_select" ON sales_clients
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND (
      'admin'     = ANY(roles)
      OR 'ventas'     = ANY(roles)
      OR 'logistica'  = ANY(roles)
    )
  )
);

-- 4. sales_contacts — agregar lectura para logistica
DROP POLICY IF EXISTS "sales_contacts_select" ON sales_contacts;
CREATE POLICY "sales_contacts_select" ON sales_contacts
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND (
      'admin'     = ANY(roles)
      OR 'ventas'     = ANY(roles)
      OR 'logistica'  = ANY(roles)
    )
  )
);

-- 5. sales_materials — agregar lectura para logistica
DROP POLICY IF EXISTS "sales_materials_select" ON sales_materials;
CREATE POLICY "sales_materials_select" ON sales_materials
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND (
      'admin'     = ANY(roles)
      OR 'ventas'     = ANY(roles)
      OR 'logistica'  = ANY(roles)
    )
  )
);
```

---

## Verificación

Ejecuta esto para confirmar que las políticas se aplicaron correctamente:

```sql
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE tablename IN ('projects', 'production_orders', 'sales_clients', 'sales_contacts', 'sales_materials')
  AND cmd = 'SELECT'
ORDER BY tablename, policyname;
```

Deberías ver en `qual` que cada política incluye `'logistica' = ANY(roles)`.

---

## Matriz de Acceso Actualizada

| Tabla | Admin | Automatización | Producción | Operador | Ventas | **Logística** |
|-------|-------|----------------|------------|----------|--------|---------------|
| **planning** | CRUD | CRUD | CRUD | R | - | - |
| **production_orders** | CRUD | CRUD | CRUD | R | - | **R** ✅ |
| **projects** | CRUD | CRUD | CRUD | R | - | **R** ✅ |
| **machines** | CRUD | CRU | CRU | R | R | - |
| **employees** | CRUD | CRU | R | R | R | - |
| **sales_clients** | CRUD | - | - | - | CRU | **R** ✅ |
| **sales_contacts** | CRUD | - | - | - | CRU | **R** ✅ |
| **sales_materials** | CRUD | - | - | - | CRU | **R** ✅ |

**Nota**: Logística tiene acceso de **solo lectura** en todas las tablas.
Los INSERT/UPDATE/DELETE de ventas y producción no son modificados.
