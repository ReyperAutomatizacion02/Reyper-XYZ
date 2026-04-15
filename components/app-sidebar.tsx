"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/utils/cn";
import { useUserPreferences } from "@/hooks/use-user-preferences";
import { SidebarSkeleton } from "@/components/ui/skeleton";
import { createClient } from "@/utils/supabase/client";
import { useSidebar } from "./sidebar-context";
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
    X,
    Truck,
    Check,
    AlertTriangle,
    Loader2,
} from "lucide-react";
import { LogoLarge, LogoShort } from "@/components/logo";
import { ROLE_ROUTE_ACCESS, hasPermissionForRoute } from "@/lib/config/permissions";

// Role-based access mapping imported from config

const sidebarItems = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Producción", href: "/dashboard/produccion", icon: Hammer },
    { name: "Ventas", href: "/dashboard/ventas", icon: ShoppingCart },
    { name: "Diseño", href: "/dashboard/diseno", icon: FolderOpen },
    { name: "RRHH", href: "/dashboard/rrhh", icon: Users },
    { name: "Administración", href: "/dashboard/admin", icon: Briefcase },
    { name: "Almacén", href: "/dashboard/almacen", icon: Package },
    { name: "Calidad", href: "/dashboard/calidad", icon: ClipboardList },
    { name: "Logística", href: "/dashboard/logistica", icon: Truck },
];

export function AppSidebar() {
    const [userRoles, setUserRoles] = useState<string[]>([]);
    const [userPermissions, setUserPermissions] = useState<string[] | null>(null);
    const pathname = usePathname();
    const router = useRouter();
    const supabase = createClient();
    const { getSidebarPrefs, updateSidebarPref, isLoading: prefsLoading, savingState } = useUserPreferences();
    const sidebarPrefs = getSidebarPrefs();
    const { isMobileOpen, setIsMobileOpen, toggleMobile, isCollapsed, setIsCollapsed } = useSidebar();

    // Track initialization state
    const [isInitialized, setIsInitialized] = useState(false);

    // Initialize isCollapsed from preferences once loaded
    useEffect(() => {
        if (!prefsLoading && !isInitialized) {
            // Use saved preference or default to false
            setIsCollapsed(sidebarPrefs.isCollapsed ?? false);
            setIsInitialized(true);
        }
    }, [prefsLoading, isInitialized, sidebarPrefs.isCollapsed, setIsCollapsed]);

    // Save preference when isCollapsed changes (after initial load)
    const handleToggleCollapse = () => {
        const newValue = !isCollapsed;
        setIsCollapsed(newValue);
        updateSidebarPref({ isCollapsed: newValue });
    };

    // Check user roles and permissions
    useEffect(() => {
        const checkProfile = async () => {
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (user) {
                const { data: profile } = await supabase
                    .from("user_profiles")
                    .select("roles, permissions")
                    .eq("id", user.id)
                    .single();
                setUserRoles(profile?.roles || []);
                setUserPermissions(profile?.permissions ?? null);
            }
        };
        checkProfile();
    }, [supabase]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push("/login");
    };

    const isAdmin = userRoles.includes("admin");

    // Filter sidebar items based on permissions (or roles as fallback)
    const filteredItems = sidebarItems.filter((item) => {
        if (userRoles.length === 0) return false;
        if (isAdmin) return true;

        if (userPermissions !== null) {
            // Nuevo sistema: usar permisos
            return hasPermissionForRoute(item.href, userPermissions);
        }

        // Legacy fallback: usar roles
        const allAllowedRoutes = new Set<string>();
        userRoles.forEach((role) => {
            const routes = ROLE_ROUTE_ACCESS[role] || [];
            routes.forEach((r) => allAllowedRoutes.add(r));
        });
        return Array.from(allAllowedRoutes).some((route) => {
            if (route === "/dashboard") return item.href === "/dashboard";
            return item.href === route || item.href.startsWith(route + "/");
        });
    });

    // Show skeleton while preferences are loading
    if (!isInitialized) {
        return <SidebarSkeleton />;
    }

    return (
        <>
            {/* Backdrop for mobile */}
            {isMobileOpen && (
                <div
                    className="fixed inset-0 z-nav-backdrop bg-black/50 backdrop-blur-sm transition-opacity duration-300 animate-in fade-in lg:hidden"
                    onClick={() => setIsMobileOpen(false)}
                />
            )}

            <aside
                id="app-sidebar"
                className={cn(
                    "fixed inset-y-0 z-nav-drawer flex h-[100dvh] flex-col border-r border-navbar-border bg-sidebar-bg shadow-xl transition-all duration-300 lg:relative",
                    isCollapsed ? "lg:w-20" : "lg:w-72",
                    isMobileOpen ? "w-[280px] translate-x-0" : "-translate-x-full lg:translate-x-0"
                )}
            >
                <div
                    className={cn(
                        "flex h-16 shrink-0 items-center border-b border-navbar-border bg-sidebar-bg px-3 transition-all duration-300",
                        isCollapsed ? "justify-center" : "justify-between px-4"
                    )}
                >
                    {/* Logo — hidden when collapsed on desktop */}
                    {!isCollapsed && (
                        <div id="sidebar-logo" className="overflow-hidden">
                            <LogoLarge className="h-9 w-auto" />
                        </div>
                    )}

                    <div className={cn("flex items-center gap-1", isCollapsed && "lg:w-full lg:justify-center")}>
                        {/* Saving state indicator — desktop only, hidden when collapsed */}
                        {!isCollapsed && savingState !== "idle" && (
                            <span
                                className={cn(
                                    "hidden items-center gap-1 text-[10px] font-medium transition-opacity lg:flex",
                                    savingState === "saving" && "text-muted-foreground",
                                    savingState === "saved" && "text-green-500",
                                    savingState === "error" && "text-destructive"
                                )}
                                aria-live="polite"
                            >
                                {savingState === "saving" && <Loader2 className="h-3 w-3 animate-spin" />}
                                {savingState === "saved" && <Check className="h-3 w-3" />}
                                {savingState === "error" && <AlertTriangle className="h-3 w-3" />}
                                {savingState === "saving" && "Guardando"}
                                {savingState === "saved" && "Guardado"}
                                {savingState === "error" && "Error"}
                            </span>
                        )}

                        {/* Mobile close button */}
                        <button
                            onClick={() => setIsMobileOpen(false)}
                            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-sidebar-hover lg:hidden"
                        >
                            <X className="h-5 w-5" />
                        </button>

                        {/* Desktop collapse button */}
                        <button
                            onClick={handleToggleCollapse}
                            className="hidden rounded-lg p-2 text-muted-foreground transition-colors hover:bg-sidebar-hover hover:text-foreground lg:block"
                        >
                            {isCollapsed ? <Menu className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
                        </button>
                    </div>
                </div>

                <nav id="sidebar-nav" className="flex-1 overflow-y-auto px-3 py-6">
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
                                            "group relative flex items-center gap-3 overflow-hidden rounded-xl px-3 py-2.5 transition-all duration-200",
                                            isActive
                                                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                                                : "text-muted-foreground hover:bg-muted hover:text-foreground",
                                            isCollapsed && "lg:justify-center"
                                        )}
                                    >
                                        <item.icon
                                            className={cn(
                                                "h-5 w-5 min-w-[1.25rem] transition-transform group-hover:scale-110",
                                                isActive && "animate-pulse"
                                            )}
                                        />
                                        <span
                                            className={cn(
                                                "whitespace-nowrap font-medium transition-all duration-300",
                                                isCollapsed
                                                    ? "lg:hidden lg:w-0 lg:opacity-0"
                                                    : "block w-auto opacity-100"
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
                            <li className="mt-4 border-t border-border pt-4">
                                <Link
                                    href="/dashboard/admin-panel"
                                    className={cn(
                                        "group relative flex items-center gap-3 overflow-hidden rounded-xl px-3 py-2.5 transition-all duration-200",
                                        pathname === "/dashboard/admin-panel" ||
                                            pathname.startsWith("/dashboard/admin-panel/")
                                            ? "bg-red-500 text-white shadow-lg shadow-red-500/20"
                                            : "text-red-500 hover:bg-red-500/10 hover:text-red-600",
                                        isCollapsed && "lg:justify-center"
                                    )}
                                >
                                    <Shield
                                        className={cn(
                                            "h-5 w-5 min-w-[1.25rem] transition-transform group-hover:scale-110",
                                            (pathname === "/dashboard/admin-panel" ||
                                                pathname.startsWith("/dashboard/admin-panel/")) &&
                                                "animate-pulse"
                                        )}
                                    />
                                    <span
                                        className={cn(
                                            "whitespace-nowrap font-medium transition-all duration-300",
                                            isCollapsed ? "lg:hidden lg:w-0 lg:opacity-0" : "block w-auto opacity-100"
                                        )}
                                    >
                                        Panel Admin
                                    </span>
                                </Link>
                            </li>
                        )}
                    </ul>
                </nav>

                <div className="border-t border-border bg-background/30 p-4">
                    <button
                        onClick={handleLogout}
                        className={cn(
                            "group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-destructive transition-colors hover:bg-destructive/10",
                            isCollapsed && "lg:justify-center"
                        )}
                    >
                        <LogOut className="h-5 w-5 min-w-[1.25rem] transition-transform group-hover:-translate-x-1" />
                        <span
                            className={cn(
                                "whitespace-nowrap font-medium transition-all duration-300",
                                isCollapsed ? "lg:hidden lg:w-0 lg:opacity-0" : "block w-auto opacity-100"
                            )}
                        >
                            Cerrar Sesión
                        </span>
                    </button>
                </div>
            </aside>
        </>
    );
}
