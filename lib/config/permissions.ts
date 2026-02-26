// lib/config/permissions.ts

/**
 * Global Role-to-Route mapping.
 * Used by both the Middleware (server-side protection) and the Sidebar (client-side rendering).
 * 
 * "*" means full access to all routes under /dashboard
 */
export const ROLE_ROUTE_ACCESS: Record<string, string[]> = {
    admin: ["*"],
    administracion: ["/dashboard", "/dashboard/admin", "/dashboard/actualizaciones"],
    recursos_humanos: ["/dashboard", "/dashboard/rrhh", "/dashboard/actualizaciones"],
    contabilidad: ["/dashboard", "/dashboard/contabilidad", "/dashboard/actualizaciones"],
    compras: ["/dashboard", "/dashboard/compras", "/dashboard/actualizaciones"],
    ventas: ["/dashboard", "/dashboard/ventas", "/dashboard/actualizaciones"],
    // Automatizacion gets access to Produccion and Diseno
    automatizacion: ["/dashboard", "/dashboard/produccion", "/dashboard/diseno", "/dashboard/actualizaciones"],
    diseno: ["/dashboard", "/dashboard/diseno", "/dashboard/actualizaciones"],
    produccion: ["/dashboard", "/dashboard/produccion", "/dashboard/actualizaciones"],
    operador: ["/dashboard", "/dashboard/produccion", "/dashboard/actualizaciones"],
    calidad: ["/dashboard", "/dashboard/calidad", "/dashboard/actualizaciones"],
    almacen: ["/dashboard", "/dashboard/almacen", "/dashboard/actualizaciones"],
};

/**
 * List of routes that are always public (no auth required)
 */
export const PUBLIC_ROUTES = [
    "/",
    "/login",
    "/register",
    "/forgot-password",
    "/auth/callback",
    "/pending-approval"
];
