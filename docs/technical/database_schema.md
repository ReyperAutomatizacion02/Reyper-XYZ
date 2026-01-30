# Esquema de Base de Datos (PostgreSQL)

El sistema utiliza una base de datos relacional PostgreSQL hospedada en Supabase. A continuación se describen las tablas principales.

## Tablas Principales

### `projects` (Proyectos)
Almacena la información de alto nivel de cada proyecto.
*   `id`: UUID (Primary Key).
*   `code`: Código único del proyecto.
*   `name`: Nombre descriptivo.
*   `company`: Cliente o empresa asociada.
*   `requestor`: Persona que solicita.
*   `start_date` / `delivery_date`: Fechas clave.
*   `status`: Estado del proyecto ('active', 'delivered', etc.).
*   `notion_id`: ID de referencia para sincronización con Notion.

### `production_orders` (Partidas / Órdenes)
Detalle de las piezas a fabricar dentro de un proyecto.
*   `id`: UUID.
*   `part_code`: Código único de la pieza.
*   `part_name`: Descripción de la pieza.
*   `project_id`: Foreign Key -> `projects.id`.
*   `quantity`: Cantidad a fabricar.
*   `image`: URL de la imagen/plano (en Supabase Storage).
*   `status`: Estado general de la partida.
*   `material`: Tipo de material.

### `planning` (Planeación)
Registros detallados para el diagrama de Gantt.
*   `id`: UUID.
*   `order_id`: Foreign Key -> `production_orders.id`.
*   `register`: Identificador del registro de planeación.
*   `machine`: Máquina asignada.
*   `operator`: Operador asignado.
*   `planned_date` (Inicio) / `planned_end` (Fin): Rango de tiempo planificado.
*   `check_in` / `check_out`: Registro real de tiempos (opcional).

### `machines` (Máquinas)
Catálogo de maquinaria disponible.
*   `id`: UUID.
*   `name`: Nombre de la máquina.

## Módulo de Ventas

### `sales_quotes` (Cotizaciones)
Encabezados de las cotizaciones.
*   `id`: UUID.
*   `quote_number`: Folio consecutivo.
*   `client_id`: Cliente.
*   `total`, `subtotal`, `tax_amount`: Montos financieros.

### `sales_quote_items` (Partidas de Cotización)
Items individuales dentro de una cotización.
*   `quote_id`: FK -> `sales_quotes.id`.
*   `description`, `quantity`, `unit_price`, `total_price`.

## Seguridad (RLS)
Todas las tablas deben tener habilitado **Row Level Security (RLS)**.
*   Las políticas actuales permiten lectura/escritura a usuarios autenticados.
*   (Pendiente: Refinar políticas para acceso por roles específicos si es necesario).
