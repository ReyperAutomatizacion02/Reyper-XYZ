# Migración Aplicada: Políticas RLS Estrictas

**Fecha**: 2026-02-03  
**Proyecto**: Reyper XYZ (dnqtxzqntuvclvtrojsb)  
**Estado**: ✅ EXITOSA

## Resumen

Se implementaron políticas RLS estrictas basadas en roles para **12 tablas** que anteriormente permitían acceso total a cualquier usuario autenticado.

---

## Políticas Implementadas

### 📦 Tablas de Producción

#### 1. `planning`
- **SELECT**: Admin, automatización, producción, operador
- **INSERT/UPDATE**: Admin, automatización, producción
- **DELETE**: Solo admin

#### 2. `production_orders`
- **SELECT**: Admin, automatización, producción, operador
- **INSERT/UPDATE**: Admin, automatización, producción
- **DELETE**: Solo admin

#### 3. `projects`
- **SELECT**: Admin, automatización, producción, operador
- **INSERT/UPDATE**: Admin, automatización, producción
- **DELETE**: Solo admin

#### 4. `machines`
- **SELECT**: Todos los usuarios autenticados
- **INSERT/UPDATE**: Admin, automatización, producción
- **DELETE**: Solo admin

#### 5. `employees`
- **SELECT**: Todos los usuarios autenticados
- **INSERT/UPDATE**: Admin, automatización
- **DELETE**: Solo admin

---

### 💰 Tablas de Ventas

Todas las tablas de ventas siguen el mismo patrón:

**Tablas**: `sales_quotes`, `sales_quote_items`, `sales_clients`, `sales_contacts`, `sales_materials`, `sales_areas`, `sales_positions`, `sales_units`

- **SELECT**: Admin, ventas
- **INSERT/UPDATE**: Admin, ventas
- **DELETE**: Solo admin

---

## Matriz de Acceso Implementada

| Tabla | Admin | Automatización | Producción | Operador | Ventas |
|-------|-------|----------------|------------|----------|--------|
| **planning** | CRUD | CRUD | CRUD | R | - |
| **production_orders** | CRUD | CRUD | CRUD | R | - |
| **projects** | CRUD | CRUD | CRUD | R | - |
| **machines** | CRUD | CRU | CRU | R | R |
| **employees** | CRUD | CRU | R | R | R |
| **sales_quotes** | CRUD | - | - | - | CRU |
| **sales_clients** | CRUD | - | - | - | CRU |
| **sales_contacts** | CRUD | - | - | - | CRU |
| **sales_materials** | CRUD | - | - | - | CRU |
| **sales_areas** | CRUD | - | - | - | CRU |
| **sales_positions** | CRUD | - | - | - | CRU |
| **sales_units** | CRUD | - | - | - | CRU |

**Leyenda**:
- **C**: Create (INSERT)
- **R**: Read (SELECT)
- **U**: Update (UPDATE)
- **D**: Delete (DELETE) - Solo admin en todas las tablas
- **-**: Sin acceso

---

## Mejoras de Seguridad

### Antes ❌
```sql
CREATE POLICY "Enable all for authenticated users" 
ON planning 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
```
- ❌ Cualquier usuario autenticado podía ver, modificar y eliminar TODO
- ❌ Un usuario de "Ventas" podía eliminar datos de "Producción"
- ❌ Sin trazabilidad ni control de acceso

### Después ✅
```sql
-- SELECT: Solo roles autorizados
CREATE POLICY "planning_select" ON planning
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND (
      'admin' = ANY(roles)
      OR 'automatizacion' = ANY(roles)
      OR 'produccion' = ANY(roles)
      OR 'operador' = ANY(roles)
    )
  )
);

-- DELETE: Solo admin
CREATE POLICY "planning_delete" ON planning
FOR DELETE TO authenticated
USING (is_admin());
```
- ✅ Solo usuarios con roles específicos pueden acceder
- ✅ Separación clara de responsabilidades
- ✅ Solo admin puede eliminar registros

---

## Verificación

### Usuarios Actuales

| Usuario | Roles | Acceso a Producción | Acceso a Ventas |
|---------|-------|---------------------|-----------------|
| **AUTM** | admin | ✅ Total | ✅ Total |
| **Fernando_Ramos** | ventas, operador | ✅ Lectura | ✅ Total |

---

## Impacto en Funcionalidad

### ✅ Sin Impacto
- Scripts de sincronización de Notion (usan SERVICE_ROLE_KEY que bypasea RLS)
- Usuario admin (acceso total)
- Usuario Fernando (tiene roles necesarios)

### ⚠️ Requiere Atención
- **Nuevos usuarios**: Deben tener roles asignados correctamente antes de poder acceder
- **Usuarios sin roles**: No podrán acceder a ninguna tabla (excepto `machines` y `employees` para lectura)

---

## Próximos Pasos

### Inmediato
1. ✅ Políticas RLS aplicadas
2. ⏳ Probar funcionalidad con usuario admin
3. ⏳ Probar funcionalidad con usuario ventas/operador
4. ⏳ Verificar que scripts de sincronización funcionan

### Opcional
1. Habilitar "Leaked Password Protection" en Supabase Dashboard
2. Crear política de asignación de roles para nuevos usuarios
3. Implementar auditoría de cambios en tablas críticas

---

## Comandos de Verificación

```sql
-- Ver todas las políticas de una tabla
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'planning'
ORDER BY policyname;

-- Probar acceso como usuario específico
-- (Ejecutar como ese usuario en la aplicación)
SELECT * FROM planning LIMIT 5;
INSERT INTO planning (...) VALUES (...);
UPDATE planning SET ... WHERE ...;
DELETE FROM planning WHERE ...;
```

---

## Rollback (Si es necesario)

Si algo falla, puedes revertir a las políticas permisivas:

```sql
-- Ejemplo para planning
DROP POLICY IF EXISTS "planning_select" ON planning;
DROP POLICY IF EXISTS "planning_insert" ON planning;
DROP POLICY IF EXISTS "planning_update" ON planning;
DROP POLICY IF EXISTS "planning_delete" ON planning;

CREATE POLICY "Enable all for authenticated users" 
ON planning 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
```

**Nota**: No recomendado por razones de seguridad.
