// lib/config/permissions.ts

// ─── Permission Identifiers ───────────────────────────────────────────────────

export const PERMISSIONS = {
    // Producción
    PRODUCCION_PLANEACION: "produccion:planeacion",
    PRODUCCION_MAQUINADOS: "produccion:maquinados",
    PRODUCCION_MAQUINAS: "produccion:maquinas",
    // Ventas
    VENTAS_COTIZADOR: "ventas:cotizador",
    VENTAS_NUEVO_PROYECTO: "ventas:nuevo-proyecto",
    VENTAS_HISTORIAL: "ventas:historial",
    VENTAS_CLIENTES: "ventas:clientes",
    VENTAS_PROYECTOS: "ventas:proyectos",
    VENTAS_AUDITORIA: "ventas:auditoria",
    // Almacén
    ALMACEN_INVENTARIO: "almacen:inventario",
    // Logística
    LOGISTICA_PROYECTOS: "logistica:proyectos",
    LOGISTICA_TRATAMIENTOS: "logistica:tratamientos",
    // Áreas de página única (sin sub-herramientas por ahora)
    DISENO: "diseno",
    RRHH: "rrhh",
    COMPRAS: "compras",
    CONTABILIDAD: "contabilidad",
    CALIDAD: "calidad",
    ADMINISTRACION: "administracion",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

// ─── Route ↔ Permission Mapping ───────────────────────────────────────────────

/** La ruta exacta que protege cada permiso */
export const PERMISSION_ROUTES: Record<Permission, string> = {
    "produccion:planeacion": "/dashboard/produccion/planeacion",
    "produccion:maquinados": "/dashboard/produccion/maquinados",
    "produccion:maquinas": "/dashboard/produccion/maquinas",
    "ventas:cotizador": "/dashboard/ventas/cotizador",
    "ventas:nuevo-proyecto": "/dashboard/ventas/nuevo-proyecto",
    "ventas:historial": "/dashboard/ventas/historial",
    "ventas:clientes": "/dashboard/ventas/clientes-usuarios",
    "ventas:proyectos": "/dashboard/ventas/proyectos",
    "ventas:auditoria": "/dashboard/ventas/auditoria",
    "almacen:inventario": "/dashboard/almacen/inventario",
    "logistica:proyectos": "/dashboard/logistica/proyectos",
    "logistica:tratamientos": "/dashboard/logistica/tratamientos",
    diseno: "/dashboard/diseno",
    rrhh: "/dashboard/rrhh",
    compras: "/dashboard/compras",
    contabilidad: "/dashboard/contabilidad",
    calidad: "/dashboard/calidad",
    administracion: "/dashboard/admin",
};

/** El hub/área al que pertenece cada permiso (para visibilidad en el sidebar) */
export const PERMISSION_AREA: Record<Permission, string> = {
    "produccion:planeacion": "/dashboard/produccion",
    "produccion:maquinados": "/dashboard/produccion",
    "produccion:maquinas": "/dashboard/produccion",
    "ventas:cotizador": "/dashboard/ventas",
    "ventas:nuevo-proyecto": "/dashboard/ventas",
    "ventas:historial": "/dashboard/ventas",
    "ventas:clientes": "/dashboard/ventas",
    "ventas:proyectos": "/dashboard/ventas",
    "ventas:auditoria": "/dashboard/ventas",
    "almacen:inventario": "/dashboard/almacen",
    "logistica:proyectos": "/dashboard/logistica",
    "logistica:tratamientos": "/dashboard/logistica",
    diseno: "/dashboard/diseno",
    rrhh: "/dashboard/rrhh",
    compras: "/dashboard/compras",
    contabilidad: "/dashboard/contabilidad",
    calidad: "/dashboard/calidad",
    administracion: "/dashboard/admin",
};

// ─── Etiquetas legibles ───────────────────────────────────────────────────────

export const PERMISSION_LABELS: Record<Permission, string> = {
    "produccion:planeacion": "Planeación",
    "produccion:maquinados": "Maquinados",
    "produccion:maquinas": "Gestión de Máquinas",
    "ventas:cotizador": "Nueva Cotización",
    "ventas:nuevo-proyecto": "Nuevo Proyecto",
    "ventas:historial": "Historial de Cotizaciones",
    "ventas:clientes": "Clientes y Usuarios",
    "ventas:proyectos": "Proyectos Activos",
    "ventas:auditoria": "Auditoría de Datos",
    "almacen:inventario": "Inventario",
    "logistica:proyectos": "Proyectos (Logística)",
    "logistica:tratamientos": "Tratamientos",
    diseno: "Diseño",
    rrhh: "RRHH",
    compras: "Compras",
    contabilidad: "Contabilidad",
    calidad: "Calidad",
    administracion: "Administración",
};

// ─── Permisos por Rol ─────────────────────────────────────────────────────────

/**
 * Permisos pre-seleccionados por defecto al aprobar un usuario con un rol dado.
 * El admin puede ajustarlos antes de guardar.
 */
export const ROLE_DEFAULT_PERMISSIONS: Record<string, Permission[]> = {
    produccion: ["produccion:planeacion", "produccion:maquinados"],
    operador: ["produccion:maquinados"],
    automatizacion: ["produccion:planeacion", "produccion:maquinados", "diseno"],
    ventas: [
        "ventas:cotizador",
        "ventas:nuevo-proyecto",
        "ventas:historial",
        "ventas:clientes",
        "ventas:proyectos",
        "ventas:auditoria",
    ],
    diseno: ["diseno"],
    recursos_humanos: ["rrhh"],
    compras: ["compras"],
    contabilidad: ["contabilidad"],
    calidad: ["calidad"],
    almacen: ["almacen:inventario"],
    logistica: ["logistica:proyectos", "logistica:tratamientos"],
    administracion: ["administracion"],
};

/**
 * Todos los permisos disponibles para un rol (mostrados como checkboxes en el panel admin).
 */
export const ROLE_AVAILABLE_PERMISSIONS: Record<string, Permission[]> = {
    produccion: ["produccion:planeacion", "produccion:maquinados", "produccion:maquinas"],
    operador: ["produccion:maquinados", "produccion:maquinas"],
    automatizacion: ["produccion:planeacion", "produccion:maquinados", "produccion:maquinas", "diseno"],
    ventas: [
        "ventas:cotizador",
        "ventas:nuevo-proyecto",
        "ventas:historial",
        "ventas:clientes",
        "ventas:proyectos",
        "ventas:auditoria",
    ],
    diseno: ["diseno"],
    recursos_humanos: ["rrhh"],
    compras: ["compras"],
    contabilidad: ["contabilidad"],
    calidad: ["calidad"],
    almacen: ["almacen:inventario"],
    logistica: ["logistica:proyectos", "logistica:tratamientos"],
    administracion: ["administracion"],
};

// ─── Helper de acceso por ruta ────────────────────────────────────────────────

/**
 * Determina si una lista de permisos concede acceso a un pathname dado.
 * Usado por el middleware y el sidebar.
 */
export function hasPermissionForRoute(pathname: string, permissions: string[]): boolean {
    // El hub raíz y actualizaciones son accesibles para cualquier usuario aprobado
    if (pathname === "/dashboard") return true;
    if (pathname.startsWith("/dashboard/actualizaciones")) return true;

    for (const perm of permissions) {
        const route = PERMISSION_ROUTES[perm as Permission];
        const area = PERMISSION_AREA[perm as Permission];

        if (!route) continue;

        // Ruta exacta de la herramienta
        if (pathname === route || pathname.startsWith(route + "/")) return true;

        // Página hub del área (ej. /dashboard/produccion)
        if (area && pathname === area) return true;
    }

    return false;
}

// ─── Legacy: Rol → Rutas ──────────────────────────────────────────────────────

/**
 * @deprecated Usar permisos en su lugar.
 * Mantenido para compatibilidad con usuarios que aún no tienen permisos asignados.
 */
export const ROLE_ROUTE_ACCESS: Record<string, string[]> = {
    admin: ["*"],
    administracion: ["/dashboard", "/dashboard/admin", "/dashboard/actualizaciones"],
    recursos_humanos: ["/dashboard", "/dashboard/rrhh", "/dashboard/actualizaciones"],
    contabilidad: ["/dashboard", "/dashboard/contabilidad", "/dashboard/actualizaciones"],
    compras: ["/dashboard", "/dashboard/compras", "/dashboard/actualizaciones"],
    ventas: ["/dashboard", "/dashboard/ventas", "/dashboard/actualizaciones"],
    automatizacion: ["/dashboard", "/dashboard/produccion", "/dashboard/diseno", "/dashboard/actualizaciones"],
    diseno: ["/dashboard", "/dashboard/diseno", "/dashboard/actualizaciones"],
    produccion: ["/dashboard", "/dashboard/produccion", "/dashboard/actualizaciones"],
    operador: ["/dashboard", "/dashboard/produccion", "/dashboard/actualizaciones"],
    calidad: ["/dashboard", "/dashboard/calidad", "/dashboard/actualizaciones"],
    almacen: ["/dashboard", "/dashboard/almacen", "/dashboard/actualizaciones"],
    logistica: ["/dashboard", "/dashboard/logistica", "/dashboard/actualizaciones"],
};

export const PUBLIC_ROUTES = ["/", "/login", "/register", "/forgot-password", "/auth/callback", "/pending-approval"];
