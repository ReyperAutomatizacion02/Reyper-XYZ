"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/cn";

interface DashboardHeaderProps {
    title: string;
    description?: string;
    icon?: React.ReactNode; // Changed from LucideIcon to ReactNode
    backUrl?: string;
    onBack?: () => void;
    children?: React.ReactNode;
    className?: string;
    iconClassName?: string;
}

export function DashboardHeader({
    title,
    description,
    icon,
    backUrl,
    onBack,
    children,
    className,
    iconClassName
}: DashboardHeaderProps) {
    return (
        <div className={cn("flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6", className)}>
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
                        <div className={cn("p-3 rounded-xl bg-primary/10 flex items-center justify-center shrink-0", iconClassName)}>
                            {icon}
                        </div>
                    )}
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
                            {title}
                        </h1>
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
