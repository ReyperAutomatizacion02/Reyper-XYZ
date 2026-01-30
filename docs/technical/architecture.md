# Arquitectura Técnica

## Stack Tecnológico

*   **Frontend**: [Next.js 15+](https://nextjs.org/) (App Router)
    *   Framework de React para renderizado híbrido (SSR/CSR).
    *   Routing basado en sistema de archivos (`app/` directory).
*   **Lenguaje**: TypeScript
    *   Tipado estático para robustez y mantenibilidad.
*   **Estilos**: Tailwind CSS + Shadcn/UI
    *   Utility-first CSS para desarrollo rápido.
    *   Componentes accesibles y personalizables.
*   **Backend / BaaS**: Supabase
    *   **Base de Datos**: PostgreSQL.
    *   **Auth**: Autenticación de usuarios (Email/Password, OAuth Google).
    *   **Storage**: Almacenamiento de imágenes (planos, fotos de piezas).
*   **Sincronización**: Node.js Scripts
    *   Scripts ejecutados periódicamente o bajo demanda para traer datos de Notion.

## Diagrama de Flujo de Datos

```mermaid
graph TD
    User[Usuario] -->|Interactúa| Frontend[Next.js App]
    Frontend -->|Lee/Escribe| Supabase[Supabase PostgreSQL]
    Frontend -->|Auth| SBAuth[Supabase Auth]
    
    Notion[Notion Databases] -->|API| Scripts[Sync Scripts (Node.js)]
    Scripts -->|Upsert| Supabase
    
    Supabase -->|Triggers| DBFunctions[Database Functions]
```

## Estructura del Proyecto

*   `app/`: Rutas de la aplicación (Pages, Layouts).
*   `components/`: Componentes de UI reutilizables.
*   `lib/` & `utils/`: Utilidades, clientes de Supabase, funciones auxiliares.
*   `scripts/`: Lógica de sincronización con Notion y mantenimiento de DB.
*   `supabase/`: Definiciones SQL, migraciones y tipos.
*   `public/`: Assets estáticos.

## Principios de Diseño
1.  **Server Components**: Se prioriza el uso de React Server Components para fetching de datos inicial.
2.  **Client Components**: Uso específico para interactividad (formularios, el Gantt chart).
3.  **Tipado Estricto**: Uso de `utils/supabase/types.ts` generado automáticamente para garantizar la integridad de datos entre DB y Frontend.
