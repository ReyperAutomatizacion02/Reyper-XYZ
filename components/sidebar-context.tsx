"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

interface SidebarContextType {
    isMobileOpen: boolean;
    setIsMobileOpen: (open: boolean) => void;
    toggleMobile: () => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
    const [isMobileOpen, setIsMobileOpen] = useState(false);

    const toggleMobile = () => setIsMobileOpen((prev) => !prev);

    // Close sidebar on route change (for mobile)
    useEffect(() => {
        setIsMobileOpen(false);
    }, []);

    // Close mobile sidebars when transitioning to desktop
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth >= 1024) { // lg breakpoint
                setIsMobileOpen(false);
            }
        };

        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    return (
        <SidebarContext.Provider value={{ isMobileOpen, setIsMobileOpen, toggleMobile }}>
            {children}
        </SidebarContext.Provider>
    );
}

export function useSidebar() {
    const context = useContext(SidebarContext);
    if (!context) {
        throw new Error("useSidebar must be used within a SidebarProvider");
    }
    return context;
}
