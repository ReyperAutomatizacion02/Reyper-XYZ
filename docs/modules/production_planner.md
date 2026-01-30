# Herramienta: Planificador de Producción (Gantt)

## Descripción General
El Planificador de Producción es el corazón operativo de Reyper XYZ. Es una herramienta visual interactiva basada en diagramas de Gantt que permite programar, asignar y monitorear las órdenes de trabajo en las diferentes máquinas cnc y estaciones de trabajo.

**Ubicación**: `Dashboard > Producción > Planeación`

## Funciones Principales

1.  **Visualización de Carga de Trabajo**: Muestra claramente qué máquina está ocupada, con qué pieza y por cuánto tiempo.
2.  **Edición "Drag & Drop"**: Permite mover tareas en el tiempo o reasignarlas a otras máquinas simplemente arrastrando las barras.
3.  **Gestión de Operadores**: Asignación de responsables específicos a cada tarea.
4.  **Sincronización de Estatus**: Los cambios en el planificador (ej. marcar como "Terminado") actualizan el estado general del proyecto.

## Guía de Uso Paso a Paso

### 1. Programar una Nueva Tarea
(Nota: Las tareas generalmente fluyen automáticamente desde las "Partidas" aprobadas, pero se pueden ajustar aquí).
1.  Identifica la **Barra de Pedido** en la lista de "Sin Asignar" o en el calendario.
2.  Arrastra la barra a la fila de la **Máquina** deseada.
3.  Estira la barra horizontalmente para definir la **Duración Estimada** del maquinado.

### 2. Ajustar Cambios de Planta
Si una máquina falla o un trabajo urgente llega:
1.  Identifica la tarea conflictiva.
2.  Arrastra la tarea verticalmente a una **Máquina Alternativa** disponible.
3.  El sistema recalcula automáticamente los tiempos.

### 3. Asignar Operador
1.  Haz doble clic sobre una barra de tarea.
2.  En el modal emergente, selecciona el **Operador** del menú desplegable.
3.  Guarda los cambios.

## Mejora en el Proceso

| Antes (Proceso Manual/Excel) | Con Reyper XYZ |
| :--- | :--- |
| **Pizarrones Físicos**: Información desactualizada tan pronto se escribe. | **Tiempo Real**: Cualquier cambio es visible inmediatamente para administración y planta. |
| **Conflictos de Programación**: Doble asignación de máquinas por error humano. | **Visualización Clara**: Es imposible asignar dos tareas al mismo tiempo en la misma máquina sin notarlo visualmente. |
| **Incertidumbre**: Ventas no sabe cuándo estará lista una pieza sin preguntar al jefe de taller. | **Transparencia**: Ventas puede consultar el Gantt y dar fechas precisas al cliente sin interrumpir a producción. |
