"use client";

import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSidebar } from "./sidebar-context";

export function MobileToggle() {
    const { isMobileOpen, toggleMobile } = useSidebar();

    return (
        <Button
            variant="ghost"
            size="icon"
            className="lg:hidden text-foreground hover:bg-muted"
            onClick={toggleMobile}
            aria-label={isMobileOpen ? "Cerrar menú" : "Abrir menú"}
        >
            {isMobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </Button>
    );
}
