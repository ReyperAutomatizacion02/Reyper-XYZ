import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { PUBLIC_ROUTES, hasPermissionForRoute } from "./lib/config/permissions";

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
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
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

    // Rutas públicas que no requieren autenticación
    const isPublicRoute = PUBLIC_ROUTES.some((route) => pathname === route) || pathname.startsWith("/auth/");

    // Rutas API que permiten acceso sin sesión (webhooks con token secreto propio, etc.)
    // Toda ruta /api/ NO listada aquí requiere usuario autenticado.
    const API_PUBLIC_ROUTES: string[] = [];
    const isApiPublicRoute = API_PUBLIC_ROUTES.some((route) => pathname.startsWith(route));

    if (!user && !isPublicRoute && !isApiPublicRoute) {
        // API routes get a machine-readable 401, not an HTML redirect
        if (pathname.startsWith("/api/")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        return NextResponse.redirect(url);
    }

    if (user && pathname.startsWith("/dashboard")) {
        const { data: profile } = await supabase
            .from("user_profiles")
            .select("is_approved, roles, permissions")
            .eq("id", user.id)
            .single();

        if (!profile || !profile.is_approved) {
            const url = request.nextUrl.clone();
            url.pathname = "/pending-approval";
            return NextResponse.redirect(url);
        }

        const userRoles: string[] = profile.roles || [];
        const isAdmin = userRoles.includes("admin");

        if (!isAdmin) {
            // Admin-panel siempre es exclusivo para admins
            if (pathname.startsWith("/dashboard/admin-panel")) {
                const url = request.nextUrl.clone();
                url.pathname = "/dashboard";
                return NextResponse.redirect(url);
            }

            const userPermissions = (profile.permissions as string[]) ?? [];

            if (!hasPermissionForRoute(pathname, userPermissions)) {
                const url = request.nextUrl.clone();
                url.pathname = "/dashboard";
                return NextResponse.redirect(url);
            }
        }
    }

    return supabaseResponse;
}

export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
