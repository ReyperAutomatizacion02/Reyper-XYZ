# Uso de Scripts

El proyecto incluye varios scripts en TypeScript ubicados en la carpeta `scripts/` para tareas de mantenimiento y sincronización de datos.

## Ejecución de Scripts con `tsx`

Para ejecutar estos scripts directamente sin compilar, utilizamos `tsx` (incluido en las dependencias).

### Sincronización con Notion (`sync-notion.ts`)

Este es el script principal que trae datos desde Notion hacia Supabase.

**Uso Básico:**
```bash
npx tsx scripts/sync-notion.ts
```
Esto ejecutará una sincronización **completa** (escaneando hasta 30 días atrás).

**Opciones:**

*   `--incremental`: Ejecuta una sincronización ligera (últimos 3 días). Ideal para ejecutar frecuentemente (cron jobs).
    ```bash
    npx tsx scripts/sync-notion.ts --incremental
    ```
*   `--skip-projects`: Salta la fase de proyectos.
*   `--skip-items`: Salta la fase de partidas/imágenes.

### Limpieza de Datos (`clear-all-data.ts`)

⚠️ **PELIGRO**: Este script borra TODOS los datos de las tablas `planning`, `production_orders` y `projects` en Supabase. Úsalo solo cuando necesites reiniciar la base de datos completamente antes de una carga masiva limpia.

```bash
npx tsx scripts/clear-all-data.ts
```

### Inspección de DB (`inspect_db.ts`)

Script de utilidad para ver rápidamente los primeros registros de las tablas y verificar que la conexión a Supabase funciona correctamente.

```bash
npx tsx scripts/inspect_db.ts
```

## Creación de Nuevos Scripts

Si deseas agregar un nuevo script:
1.  Crea el archivo en `scripts/mi-script.ts`.
2.  Importa `dotenv` y `createClient` para conectar a Supabase.
3.  Ejecútalo con `npx tsx scripts/mi-script.ts`.
