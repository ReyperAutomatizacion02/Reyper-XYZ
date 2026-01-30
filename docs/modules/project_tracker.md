# Herramienta: Gestor de Proyectos (Project Tracker)

## Descripción General
El Gestor de Proyectos actúa como el cerebro de la operación, sincronizando la información estratégica desde planeación hasta entrega. Su función principal es servir como "Fuente Única de la Verdad" (Single Source of Truth), asegurando que Notion, el Sistema y el Piso de Producción hablen el mismo idioma.

**Ubicación**: `Dashboard > Proyectos`

## Funciones Principales

1.  **Sincronización Bidireccional (Notion)**: Conecta con las bases de datos administrativas para extraer nuevos proyectos aprobados automáticamente.
2.  **Semáforo de Estatus**: Indicadores visuales automáticos sobre la salud del proyecto (A tiempo, Retrasado, En Riesgo).
3.  **Trazabilidad de Piezas**: Permite "hacer drill-down" (profundizar) desde un proyecto general hasta cada tornillo o pieza específica que lo compone.

## Guía de Uso Paso a Paso

### 1. Consultar Estatus de un Proyecto
1.  Entra al módulo de **Proyectos**.
2.  Usa la barra de búsqueda para filtrar por **Nombre del Cliente** o **Código de Proyecto**.
3.  Observa la barra de progreso general (calculada en base al % de piezas terminadas).

### 2. Ver Detalle de Partidas
1.  Haz clic en el nombre del proyecto.
2.  Verás la lista de todas las "Partidas" (Piezas) asociadas.
3.  Aquí puedes ver qué piezas ya están maquinadas, cuáles están en tratamiento, y cuáles siguen en espera de material.

## Mejora en el Proceso

| Antes (Hojas de Excel / Correos) | Con Reyper XYZ |
| :--- | :--- |
| **Silos de Información**: Administración tenía unos datos, producción otros. | **Datos Unificados**: Todos ven lo mismo. Si Notion se actualiza, el sistema lo refleja. |
| **Reportes Manuales**: "¿Cómo va el proyecto X?" requería ir a piso a contar piezas. | **KPIs Automáticos**: El avance se calcula solo basado en el estatus de las órdenes de producción. |
| **Confusión de Versiones**: Maquinar con planos viejos. | **Control de Planos**: El sistema siempre muestra la última versión de la imagen/plano sincronizada desde la base de datos maestra. |
