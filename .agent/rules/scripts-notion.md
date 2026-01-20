---
trigger: always_on
---

Necesito crear algunos Scripts para todo el control de datos de Notion hasta la implementacion completa de esta plataforma.

Chequeo de propiedades y tipos en Proyectos:
- CODIGO PROYECTO E
- NOMBRE DE PROYECTO
- 01-EMPRESA.
- SOLICITA
- 01-FECHA DE SOLICITUD
- 01-FECHA DE ENTREGA X CLIENTE
- BD - PROYECTOS
- Última edición

Chequeo de propiedades y tipos en Partidas:
- 01-CODIGO PIEZA
- 01-NOMBRE DE LA PIEZA
- 06-ESTATUS GENERAL
- 01-CANTIDAD F.*
- 01-MATERIAL PIEZA
- 06-CONFIRMACION O CAMBIO DE MATERIAL
- 01-BDCODIGO P E PRO
- ZAUX-FECHA ULTIMA EDICION

Obtención de todo desde cero:
PARA PROYECTOS:
- code -> CODIGO PROYECTO E
- name -> NOMBRE DE PROYECTO
- company -> 01-EMPRESA.
- requestor -> SOLICITA
- start_date -> 01-FECHA DE SOLICITUD
- delivery_date -> 01-FECHA DE ENTREGA X CLIENTE
- status -> active (por defecto)
- notion_id -> notion page ID
- created_at -> Fecha de creación en Supabase
- last_edited_at -> Fecha de modificación en Supabase

PARA PARTIDAS:
- part_code -> 01-CODIGO PIEZA
- part_name -> 01-NOMBRE DE LA PIEZA
- genral_status -> 01-ESTATUS GENERAL
- material -> 01-MATERIAL PIEZA
- material_confirmation -> 01-CONFIRMACION O CAMBIO DE MATERIAL
- quantity -> 01-CANTIDAD F.*
- image -> 07-A MOSTRAR
- project_id -> Relación con el Proyecto de la base de tabla projects
- notion_id -> notion page ID
- created_at -> Fecha de creación en Supabase
- last_edited_at -> Fecha de modificación en Supabase

------------------------------

Chequeo de propiedades y tipos en Planeación:
- N
- MAQUINA
- OPERADOR
- planned_date -> FECHA PLANEADA (inicio)
- planned_end -> FECHA PLANEADA (fin)
- check_in -> CHECK IN
- CHECK OUT
- PARTIDA
- FECHA DE CREACION

Obtención de todo desde cero:
PARA PLANEACION:
- register -> N
- machine -> MAQUINA
- operator -> OPERADOR
- check_in -> CHECK IN
- check_out -> CHECK OUT
- order_id -> Relación con el Proyecto de la tabla planning
- notion_id -> notion page ID
- created_at -> Fecha de creación en Supabase
- last_edited_at -> Fecha de modificación en Supabase

Actualización de registros:
Obtener los registros cuya FECHA DE CREACION sea desde hace 30 días (un mes), el hoy y en un futuro.
PARA PLANEACION:
Usa la propiedad FECHA DE CREACION para filtrar los registros (on_or_after hace 30 días).