import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserCircle } from "lucide-react";
import { GeneralTour } from "./general-tour";
import { createClient } from "@/utils/supabase/server"; // Use server client to get user if server component
import { cookies } from "next/headers";
import { MobileToggle } from "./mobile-toggle";

export default async function AppNavbar() {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const {
        data: { user },
    } = await supabase.auth.getUser();

    return (
        <header id="app-navbar" className="h-16 border-b border-navbar-border bg-navbar-bg flex items-center justify-between px-4 md:px-6 sticky top-0 z-30">
            <div className="flex items-center gap-2 md:gap-4">
                <MobileToggle />
                {/* Placeholder for Breadcrumbs or Page Title */}
                <h1 className="text-sm md:text-lg font-semibold text-foreground truncate max-w-[150px] md:max-w-none">
                    Panel de Control
                </h1>
            </div>

            <div className="flex items-center gap-2 md:gap-4">
                <div className="hidden sm:flex items-center gap-2">
                    <GeneralTour />
                    <ThemeToggle />
                </div>
                <div className="sm:hidden flex items-center gap-1">
                    <ThemeToggle />
                </div>

                {user ? (
                    <div id="navbar-user-info" className="flex items-center gap-2 pl-2 md:pl-4 border-l border-navbar-border">
                        <div className="flex flex-col items-end">
                            <span className="text-xs md:text-sm font-medium text-foreground">
                                {user.user_metadata.full_name || user.email?.split('@')[0] || "Usuario"}
                            </span>
                            <span className="hidden md:inline text-xs text-muted-foreground">
                                {user.email}
                            </span>
                        </div>
                        <div className="h-7 w-7 md:h-8 md:w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                            <UserCircle className="w-5 h-5 md:w-6 md:h-6" />
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center gap-2">
                        <Link
                            href="/login"
                            className="text-xs md:text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
                        >
                            Iniciar Sesión
                        </Link>
                    </div>
                )}
            </div>
        </header>
    );
}
