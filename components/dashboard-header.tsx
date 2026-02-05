"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/cn";

interface DashboardHeaderProps {
    title: string;
    description?: string;
    icon?: React.ReactNode;
    backUrl?: string;
    onBack?: () => void;
    children?: React.ReactNode;
    className?: string;
    iconClassName?: string; // Kept for backward compatibility/manual overrides
    colorClass?: string;    // New: Text color for icon
    bgClass?: string;       // New: Background color for icon wrapper
    onHelp?: () => void;    // New: Trigger for help tour
}

export function DashboardHeader({
    title,
    description,
    icon,
    backUrl,
    onBack,
    children,
    className,
    iconClassName,
    colorClass,
    bgClass,
    onHelp,
}: DashboardHeaderProps) {
    return (
        <div id="page-header" className={cn("flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6", className)}>
            <div className="flex items-center gap-4">
                {onBack ? (
                    <Button variant="ghost" size="icon" className="shrink-0" onClick={onBack}>
                        <ArrowLeft className="w-5 h-5 text-muted-foreground" />
                    </Button>
                ) : backUrl ? (
                    <Link href={backUrl}>
                        <Button variant="ghost" size="icon" className="shrink-0">
                            <ArrowLeft className="w-5 h-5 text-muted-foreground" />
                        </Button>
                    </Link>
                ) : null}
                <div className="flex items-center gap-3">
                    {icon && (
                        <div className={cn(
                            "p-3 rounded-xl flex items-center justify-center shrink-0",
                            // Default to primary/10 if no bgClass provided
                            bgClass || "bg-primary/10",
                            // Apply custom text color if provided, otherwise inherit or use default
                            colorClass,
                            iconClassName
                        )}>
                            {/* If icon is a ReactNode, we can't easily inject classNames into it if it's already instantiated.
                                However, we can wrap it or expect the user to pass the icon with the color class applied.
                                Or we can cloneElement if it's a valid element.
                                But for now, let's assume the passed 'icon' node handles its own color OR inherits from parent div if possible (currentColor).
                            */}
                            {icon}
                        </div>
                    )}
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
                                {title}
                            </h1>
                            {/* Help Button - Only if onHelp is provided */}
                            {onHelp && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={onHelp}
                                    className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
                                    title="Iniciar Tour de Ayuda"
                                >
                                    <span className="sr-only">Ayuda</span>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-circle-help"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><path d="M12 17h.01" /></svg>
                                </Button>
                            )}
                        </div>
                        {description && (
                            <p className="text-muted-foreground font-medium text-sm md:text-base">{description}</p>
                        )}
                    </div>
                </div>
            </div>

            {children && (
                <div className="flex items-center gap-2 mt-2 md:mt-0">
                    {children}
                </div>
            )}
        </div>
    );
}
