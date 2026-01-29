"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const TabsContext = React.createContext<{
    value: string;
    onValueChange: (value: string) => void;
} | null>(null);

const Tabs = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement> & { defaultValue?: string; value?: string; onValueChange?: (value: string) => void }
>(({ className, defaultValue, value, onValueChange, ...props }, ref) => {
    const [statsValue, setStatsValue] = React.useState(defaultValue || "");
    const currentValue = value !== undefined ? value : statsValue;
    const handleValueChange = React.useCallback(
        (val: string) => {
            if (onValueChange) onValueChange(val);
            setStatsValue(val);
        },
        [onValueChange]
    );

    return (
        <TabsContext.Provider value={{ value: currentValue, onValueChange: handleValueChange }}>
            <div ref={ref} className={cn("", className)} {...props} />
        </TabsContext.Provider>
    );
});
Tabs.displayName = "Tabs";

const TabsList = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn(
            "inline-flex h-10 items-center justify-center rounded-md bg-zinc-100 p-1 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
            className
        )}
        {...props}
    />
));
TabsList.displayName = "TabsList";

const TabsTrigger = React.forwardRef<
    HTMLButtonElement,
    React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string }
>(({ className, value, ...props }, ref) => {
    const context = React.useContext(TabsContext);
    const isActive = context?.value === value;

    return (
        <button
            ref={ref}
            type="button"
            className={cn(
                "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
                isActive
                    ? "bg-white text-zinc-950 shadow-sm dark:bg-zinc-950 dark:text-zinc-50"
                    : "hover:bg-zinc-200/50 dark:hover:bg-zinc-700/50 hover:text-zinc-900 dark:hover:text-zinc-100",
                className
            )}
            onClick={() => context?.onValueChange(value)}
            {...props}
        />
    );
});
TabsTrigger.displayName = "TabsTrigger";

const TabsContent = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement> & { value: string }
>(({ className, value, ...props }, ref) => {
    const context = React.useContext(TabsContext);
    if (context?.value !== value) return null;

    return (
        <div
            ref={ref}
            className={cn(
                "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 animate-in fade-in-0 zoom-in-95",
                className
            )}
            {...props}
        />
    );
});
TabsContent.displayName = "TabsContent";

export { Tabs, TabsList, TabsTrigger, TabsContent };
