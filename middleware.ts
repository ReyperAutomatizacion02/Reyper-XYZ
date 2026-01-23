import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) =>
                        request.cookies.set(name, value)
                    );
                    supabaseResponse = NextResponse.next({
                        request,
                    });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    const {
        data: { user },
    } = await supabase.auth.getUser();

    const pathname = request.nextUrl.pathname;

    // Public routes that don't require authentication
    const publicRoutes = ["/", "/login", "/register", "/forgot-password", "/auth/callback", "/pending-approval"];
    const isPublicRoute = publicRoutes.some(route => pathname === route || pathname.startsWith("/auth/"));

    // If not authenticated and trying to access protected route
    if (!user && !isPublicRoute) {
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        return NextResponse.redirect(url);
    }

    // If authenticated, check approval status for protected routes
    if (user && pathname.startsWith("/dashboard")) {
        // Fetch user profile to check approval status
        const { data: profile } = await supabase
            .from("user_profiles")
            .select("is_approved, roles")
            .eq("id", user.id)
            .single();

        // If profile doesn't exist or user is not approved, redirect to pending
        if (!profile || !profile.is_approved) {
            const url = request.nextUrl.clone();
            url.pathname = "/pending-approval";
            return NextResponse.redirect(url);
        }

        // Role-based route permissions
        const roleRouteAccess: Record<string, string[]> = {
            admin: ["*"], // Admin tiene acceso a todo
            administracion: ["/dashboard", "/dashboard/admin"],
            recursos_humanos: ["/dashboard", "/dashboard/rrhh"],
            contabilidad: ["/dashboard", "/dashboard/contabilidad"],
            compras: ["/dashboard", "/dashboard/compras"],
            ventas: ["/dashboard", "/dashboard/ventas"],
            automatizacion: ["/dashboard", "/dashboard/produccion", "/dashboard/diseno"],
            diseno: ["/dashboard", "/dashboard/diseno"],
            produccion: ["/dashboard", "/dashboard/produccion"],
            calidad: ["/dashboard", "/dashboard/calidad"],
            almacen: ["/dashboard", "/dashboard/almacen"],
        };

        // Get user roles (array) and aggregate allowed routes
        const userRoles: string[] = profile.roles || ["pending"];
        const isAdmin = userRoles.includes("admin");

        // Collect all allowed routes from all user roles
        const allAllowedRoutes = new Set<string>();
        userRoles.forEach(role => {
            const routes = roleRouteAccess[role] || [];
            routes.forEach(r => allAllowedRoutes.add(r));
        });

        // Admin has full access
        if (!isAdmin) {
            // Check if user has access to this route
            const hasAccess = Array.from(allAllowedRoutes).some(route => {
                if (route === "/dashboard") {
                    return pathname === "/dashboard";
                }
                return pathname === route || pathname.startsWith(route + "/");
            });

            // Special case: admin-panel is always admin-only
            if (pathname.startsWith("/dashboard/admin-panel")) {
                const url = request.nextUrl.clone();
                url.pathname = "/dashboard";
                return NextResponse.redirect(url);
            }

            if (!hasAccess && pathname !== "/dashboard") {
                const url = request.nextUrl.clone();
                url.pathname = "/dashboard";
                return NextResponse.redirect(url);
            }
        }
    }

    return supabaseResponse;
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public folder
         */
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    ],
};
