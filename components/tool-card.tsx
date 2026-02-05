
import Link from "next/link";
import { ArrowRight, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ToolCardProps {
    name: string;
    description: string;
    href: string;
    icon: LucideIcon;
    colorClass?: string; // e.g. "text-orange-500"
    bgClass?: string;    // e.g. "bg-orange-500/10"
    disabled?: boolean;
    className?: string;
}

export function ToolCard({
    name,
    description,
    href,
    icon: Icon,
    colorClass = "text-red-500", // Default to Red if not specified
    bgClass = "bg-red-500/10",
    disabled = false,
    className,
}: ToolCardProps) {
    return (
        <Link
            href={disabled ? "#" : href}
            className={cn(
                "group p-6 rounded-2xl border border-border bg-card transition-all duration-300",
                "hover:shadow-xl hover:border-red-500/30", // Standard Red Hover Border
                disabled ? "opacity-60 cursor-not-allowed" : "",
                className
            )}
        >
            <div className="flex items-start justify-between mb-4">
                <div className={cn(
                    "p-3 rounded-xl transition-colors",
                    bgClass, // Custom Background Color
                    colorClass // Custom Icon Color
                )}>
                    <Icon className="w-6 h-6" />
                </div>
            </div>

            <h3 className={cn(
                "text-lg font-bold mb-2 transition-colors",
                !disabled && "group-hover:text-red-500" // Title turns Standard Red on hover
            )}>
                {name}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
                {description}
            </p>

            {!disabled && (
                <div className="flex items-center text-sm font-medium text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                    Abrir herramienta
                    <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                </div>
            )}
        </Link>
    );
}
