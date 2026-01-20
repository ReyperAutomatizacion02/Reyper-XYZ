"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/utils/cn";
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
} from "lucide-react";



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
    const [isCollapsed, setIsCollapsed] = useState(false);
    const pathname = usePathname();

    return (
        <aside
            className={cn(
                "h-screen bg-card border-r border-border transition-all duration-300 flex flex-col pt-16 md:pt-0 z-40 fixed md:relative shadow-xl shadow-black/5",
                isCollapsed ? "w-20" : "w-72"
            )}
        >
            <div className="h-16 flex items-center justify-between px-4 border-b border-border bg-background/50 backdrop-blur-sm">
                <span
                    className={cn(
                        "font-black text-xl tracking-tight transition-opacity duration-300",
                        isCollapsed && "opacity-0 hidden"
                    )}
                >
                    Reyper<span className="text-primary">XYZ</span>
                </span>
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                >
                    {isCollapsed ? <Menu className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
                </button>
            </div>

            <nav className="flex-1 overflow-y-auto py-6 px-3">
                <ul className="space-y-1.5">
                    {sidebarItems.map((item) => {
                        const isActive = pathname === item.href;
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
                </ul>
            </nav>

            <div className="p-4 border-t border-border bg-background/30">
                <button
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
