"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/utils/cn";
import { useUserPreferences } from "@/hooks/use-user-preferences";
import { SidebarSkeleton } from "@/components/ui/skeleton";
import { createClient } from "@/utils/supabase/client";
import {
    LayoutDashboard,
    Hammer,
    ShoppingCart,
    Users,
    Briefcase,
    Settings,
    Menu,
    ChevronLeft,
    LogOut,
    FolderOpen,
    PieChart,
    ClipboardList,
    Package,
    Shield,
} from "lucide-react";


// Role-based access mapping (same as middleware)
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
    operador: ["/dashboard", "/dashboard/produccion"],
    calidad: ["/dashboard", "/dashboard/calidad"],
    almacen: ["/dashboard", "/dashboard/almacen"],
};

const sidebarItems = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Producción", href: "/dashboard/produccion", icon: Hammer },
    { name: "Ventas", href: "/dashboard/ventas", icon: ShoppingCart },
    { name: "Diseño", href: "/dashboard/diseno", icon: FolderOpen },
    { name: "RRHH", href: "/dashboard/rrhh", icon: Users },
    { name: "Administración", href: "/dashboard/admin", icon: Briefcase },
    { name: "Almacén", href: "/dashboard/almacen", icon: Package },
    { name: "Calidad", href: "/dashboard/calidad", icon: ClipboardList },
];

export function AppSidebar() {
    const [userRoles, setUserRoles] = useState<string[]>([]);
    const pathname = usePathname();
    const router = useRouter();
    const supabase = createClient();

    // User preferences for sidebar state
    const { getSidebarPrefs, updateSidebarPref, isLoading: prefsLoading } = useUserPreferences();
    const sidebarPrefs = getSidebarPrefs();

    // Use null to indicate "not yet initialized from prefs"
    const [isCollapsed, setIsCollapsed] = useState<boolean | null>(null);

    // Initialize isCollapsed from preferences once loaded
    useEffect(() => {
        if (!prefsLoading && isCollapsed === null) {
            // Use saved preference or default to false
            setIsCollapsed(sidebarPrefs.isCollapsed ?? false);
        }
    }, [prefsLoading, isCollapsed, sidebarPrefs.isCollapsed]);

    // Save preference when isCollapsed changes (after initial load)
    const handleToggleCollapse = () => {
        const newValue = !isCollapsed;
        setIsCollapsed(newValue);
        updateSidebarPref({ isCollapsed: newValue });
    };

    // Check user roles (array)
    useEffect(() => {
        const checkRoles = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: profile } = await supabase
                    .from("user_profiles")
                    .select("roles")
                    .eq("id", user.id)
                    .single();
                setUserRoles(profile?.roles || []);
            }
        };
        checkRoles();
    }, [supabase]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push("/login");
    };

    // Check if user is admin
    const isAdmin = userRoles.includes("admin");

    // Aggregate allowed routes from all user roles
    const allAllowedRoutes = new Set<string>();
    userRoles.forEach(role => {
        const routes = roleRouteAccess[role] || [];
        routes.forEach(r => allAllowedRoutes.add(r));
    });

    // Filter sidebar items based on roles
    const filteredItems = sidebarItems.filter(item => {
        if (userRoles.length === 0) return false;
        if (isAdmin) return true;

        return Array.from(allAllowedRoutes).some(route => {
            if (route === "/dashboard") {
                return item.href === "/dashboard";
            }
            return item.href === route || item.href.startsWith(route + "/");
        });
    });

    // Show skeleton while preferences are loading
    if (isCollapsed === null) {
        return <SidebarSkeleton />;
    }

    return (
        <aside
            id="app-sidebar"
            className={cn(
                "h-screen bg-sidebar-bg border-r border-navbar-border transition-all duration-300 flex flex-col pt-16 md:pt-0 z-40 fixed md:relative shadow-xl",
                isCollapsed ? "w-20" : "w-72"
            )}
        >
            <div className="h-16 flex items-center justify-between px-4 border-b border-navbar-border bg-background/50 backdrop-blur-sm">
                <span
                    id="sidebar-logo"
                    className={cn(
                        "font-black text-xl tracking-tight transition-opacity duration-300",
                        isCollapsed && "opacity-0 hidden"
                    )}
                >
                    Reyper<span className="text-primary">XYZ</span>
                </span>
                <button
                    onClick={handleToggleCollapse}
                    className="p-2 rounded-lg hover:bg-sidebar-hover text-muted-foreground hover:text-foreground transition-colors"
                >
                    {isCollapsed ? <Menu className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
                </button>
            </div>

            <nav id="sidebar-nav" className="flex-1 overflow-y-auto py-6 px-3">
                <ul className="space-y-1.5">
                    {filteredItems.map((item) => {
                        const isActive =
                            item.href === "/dashboard"
                                ? pathname === "/dashboard"
                                : pathname === item.href || pathname.startsWith(item.href + "/");
                        return (
                            <li key={item.href}>
                                <Link
                                    href={item.href}
                                    className={cn(
                                        "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative overflow-hidden",
                                        isActive
                                            ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                                            : "text-muted-foreground hover:text-foreground hover:bg-muted",
                                        isCollapsed && "justify-center"
                                    )}
                                >
                                    <item.icon className={cn("w-5 h-5 min-w-[1.25rem] transition-transform group-hover:scale-110", isActive && "animate-pulse")} />
                                    <span
                                        className={cn(
                                            "whitespace-nowrap transition-all duration-300 font-medium",
                                            isCollapsed ? "w-0 opacity-0 hidden" : "w-auto opacity-100 block"
                                        )}
                                    >
                                        {item.name}
                                    </span>
                                </Link>
                            </li>
                        );
                    })}

                    {/* Admin Panel - Solo visible para admins */}
                    {isAdmin && (
                        <li className="pt-4 mt-4 border-t border-border">
                            <Link
                                href="/dashboard/admin-panel"
                                className={cn(
                                    "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative overflow-hidden",
                                    pathname === "/dashboard/admin-panel" || pathname.startsWith("/dashboard/admin-panel/")
                                        ? "bg-red-500 text-white shadow-lg shadow-red-500/20"
                                        : "text-red-500 hover:text-red-600 hover:bg-red-500/10",
                                    isCollapsed && "justify-center"
                                )}
                            >
                                <Shield className={cn("w-5 h-5 min-w-[1.25rem] transition-transform group-hover:scale-110", (pathname === "/dashboard/admin-panel" || pathname.startsWith("/dashboard/admin-panel/")) && "animate-pulse")} />
                                <span
                                    className={cn(
                                        "whitespace-nowrap transition-all duration-300 font-medium",
                                        isCollapsed ? "w-0 opacity-0 hidden" : "w-auto opacity-100 block"
                                    )}
                                >
                                    Panel Admin
                                </span>
                            </Link>
                        </li>
                    )}
                </ul>
            </nav>

            <div className="p-4 border-t border-border bg-background/30">
                <button
                    onClick={handleLogout}
                    className={cn(
                        "flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-destructive hover:bg-destructive/10 transition-colors group",
                        isCollapsed && "justify-center"
                    )}
                >
                    <LogOut className="w-5 h-5 min-w-[1.25rem] group-hover:-translate-x-1 transition-transform" />
                    <span
                        className={cn(
                            "whitespace-nowrap transition-all duration-300 font-medium",
                            isCollapsed ? "w-0 opacity-0 hidden" : "w-auto opacity-100 block"
                        )}
                    >
                        Cerrar Sesión
                    </span>
                </button>
            </div>
        </aside>
    );
}
