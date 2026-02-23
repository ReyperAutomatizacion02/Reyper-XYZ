// lib/config/permissions.ts

/**
 * Global Role-to-Route mapping.
 * Used by both the Middleware (server-side protection) and the Sidebar (client-side rendering).
 * 
 * "*" means full access to all routes under /dashboard
 */
export const ROLE_ROUTE_ACCESS: Record<string, string[]> = {
    admin: ["*"],
    administracion: ["/dashboard", "/dashboard/admin"],
    recursos_humanos: ["/dashboard", "/dashboard/rrhh"],
    contabilidad: ["/dashboard", "/dashboard/contabilidad"],
    compras: ["/dashboard", "/dashboard/compras"],
    ventas: ["/dashboard", "/dashboard/ventas"],
    // Automatizacion gets access to Produccion and Diseno
    automatizacion: ["/dashboard", "/dashboard/produccion", "/dashboard/diseno"],
    diseno: ["/dashboard", "/dashboard/diseno"],
    produccion: ["/dashboard", "/dashboard/produccion"],
    operador: ["/dashboard", "/dashboard/produccion"],
    calidad: ["/dashboard", "/dashboard/calidad"],
    almacen: ["/dashboard", "/dashboard/almacen"],
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
