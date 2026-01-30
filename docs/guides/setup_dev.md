# Configuración del Entorno de Desarrollo

Guía para configurar el proyecto Reyper XYZ en una máquina local.

## Requisitos Previos

*   **Node.js**: Versión 18 o superior (LTS recomendado).
*   **Git**: Para control de versiones.
*   **Cuenta de Supabase**: Acceso al proyecto `reyper-xyz`.
*   **Cuenta de Notion**: Acceso a las bases de datos fuente (si vas a ejecutar scripts de sync).

## Instalación

1.  **Clonar el Repositorio**
    ```bash
    git clone https://github.com/ReyperAutomatizacion02/Reyper-XYZ.git
    cd Reyper-XYZ
    ```

2.  **Instalar Dependencias**
    ```bash
    npm install
    # o si usas pnpm
    pnpm install
    ```

3.  **Configurar Variables de Entorno**
    Crea un archivo `.env.local` en la raíz del proyecto basándote en el ejemplo siguiente. Solicita los valores reales al administrador del proyecto.

    ```env
    # .env.local

    # Conexión a Supabase
    NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
    NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key

    # Integración con Notion (Solo para scripts de backend)
    NOTION_TOKEN=secret_...
    NOTION_PROJECTS_DB_ID=...
    NOTION_ITEMS_DB_ID=...
    NOTION_PLANNING_DB_ID=...
    ```

## Ejecución Local

1.  **Iniciar Servidor de Desarrollo**
    ```bash
    npm run dev
    ```
    El servidor iniciará en `http://localhost:3000`.

## Solución de Problemas Comunes

*   **Error de RLS (Row Level Security)**: Si no ves datos en el frontend, verifica que tu usuario esté autenticado. Por defecto las políticas de seguridad bloquean accesos anónimos.
*   **Imágenes Rotas**: Si las imágenes de las partidas no cargan, verifica la configuración de CORS en el bucket `partidas` de Supabase o que el script de sincronización haya subido los archivos correctamente.
