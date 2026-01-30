# Guía de Despliegue (Vercel)

El frontend de Reyper XYZ está optimizado para ser desplegado en **Vercel**.

## Pasos para Desplegar

1.  **Conectar Repositorio**:
    *   En el dashboard de Vercel, selecciona "Add New Project".
    *   Importa el repositorio `Reyper-XYZ`.

2.  **Configurar Variables de Entorno**:
    *   Añade las mismas variables que tienes en `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, etc.).
    *   **Nota**: Las variables de Notion (`NOTION_TOKEN`, etc.) *no* son estrictamente necesarias en Vercel si los scripts de sincronización se corren externamente (ej. en un servidor dedicado o GitHub Actions), ya que el frontend no conecta directamente a Notion. Sin embargo, si planeas usar Server Actions que interactúen con Notion, añádelas también.

3.  **Build Settings**:
    *   Framework Preset: `Next.js` (Vercel lo detecta automáticamente).
    *   Build Command: `next build` (default).

4.  **Deploy**:
    *   Haz clic en "Deploy". Vercel construirá la aplicación y te dará una URL de producción.

## Sincronización Automática (Cron Jobs)

Para mantener los datos actualizados sin intervención manual, se recomienda configurar un **Cron Job** (por ejemplo, usando GitHub Actions o un servicio externo) que ejecute el script de sincronización periódicamente:

```bash
npx tsx scripts/sync-notion.ts --incremental
```

Se sugiere una frecuencia de cada 15 o 30 minutos durante horario laboral.
