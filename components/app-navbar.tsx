import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserCircle } from "lucide-react";
import { GeneralTour } from "./general-tour";
import { createClient } from "@/utils/supabase/server"; // Use server client to get user if server component
import { cookies } from "next/headers";

export default async function AppNavbar() {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const {
        data: { user },
    } = await supabase.auth.getUser();

    return (
        <header id="app-navbar" className="h-16 border-b border-navbar-border bg-navbar-bg flex items-center justify-between px-6 sticky top-0 z-30">
            <div className="flex items-center gap-4">
                {/* Placeholder for Breadcrumbs or Page Title */}
                <h1 className="text-lg font-semibold text-foreground">
                    Panel de Control
                </h1>
            </div>

            <div className="flex items-center gap-4">
                <GeneralTour />
                <ThemeToggle />

                {user ? (
                    <div id="navbar-user-info" className="flex items-center gap-2 pl-4 border-l border-navbar-border">
                        <div className="flex flex-col items-end">
                            <span className="text-sm font-medium text-foreground">
                                {user.user_metadata.full_name || user.email?.split('@')[0] || "Usuario"}
                            </span>
                            <span className="text-xs text-muted-foreground">
                                {user.email}
                            </span>
                        </div>
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                            <UserCircle className="w-6 h-6" />
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center gap-2">
                        <Link
                            href="/login"
                            className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
                        >
                            Iniciar Sesión
                        </Link>
                    </div>
                )}
            </div>
        </header>
    );
}
