# Integraciones

## Sincronización con Notion

El sistema mantiene una sincronización unidireccional (Notion -> Supabase) para los datos maestros de proyectos y producción. Esto permite que la administración siga usando Notion para ciertas tareas mientras el sistema consume esa data.

### Script de Sincronización: `scripts/sync-notion.ts`

Este script es el corazón de la integración. Realiza lo siguiente:

1.  **Fase 1: Proyectos**
    *   Lee la base de datos de "Proyectos" en Notion.
    *   Mapea campos como `CODIGO PROYECTO E`, `NOMBRE DE PROYECTO`, `01-EMPRESA.` a la tabla `projects`.
    *   Realiza un `upsert` basado en el `code` del proyecto.

2.  **Fase 2: Partidas (Items)**
    *   Lee la base de datos de "Partidas" en Notion.
    *   Sincroniza imágenes: Descarga las imágenes de Notion y las sube a Supabase Storage (`bucket: partidas`).
    *   Asocia la partida al proyecto correcto usando relaciones de Notion.
    *   Tabla destino: `production_orders`.

3.  **Fase 3: Planeación**
    *   Lee la base de datos de "Planeación" en Notion.
    *   Filtra registros recientes (últimos 30 días o 3 días en modo incremental).
    *   Formatea fechas para ajustar la zona horaria (UTC-6) y asegurar consistencia en el Gantt.
    *   Tabla destino: `planning`.

### Modos de Ejecución

*   **Sincronización Completa**: Escanea grandes rangos de fechas. Se usa para inicialización o corrección masiva.
*   **Sincronización Incremental**: Se activa con la bandera `INCREMENTAL=true`. Solo procesa registros modificados en los últimos 3 días para mayor eficiencia.

### Mapeo de Campos Críticos

| Entidad | Campo Notion | Campo Supabase | Notas |
| :--- | :--- | :--- | :--- |
| **Proyecto** | `CODIGO PROYECTO E` | `code` | Llave única de negocio. |
| **Partida** | `01-CODIGO PIEZA` | `part_code` | Llave única. |
| **Partida** | `07-A MOSTRAR` | `image` | Se transfiere el archivo físico. |
| **Planeación** | `FECHA PLANEADA` | `planned_date` | Requiere ajuste de Timezone. |

## Integración con Google (Auth)
Se utiliza Supabase Auth configurado con el proveedor de Google para permitir el inicio de sesión con cuentas corporativas (`@gmail.com` o dominio propio).
