"use client";

import { cn } from "@/utils/cn";

interface SkeletonProps {
    className?: string;
    style?: React.CSSProperties;
}

export function Skeleton({ className, style }: SkeletonProps) {
    return (
        <div
            className={cn(
                "animate-pulse rounded-md bg-muted/50",
                className
            )}
            style={style}
        />
    );
}

// Skeleton for the sidebar
export function SidebarSkeleton() {
    return (
        <aside className="h-screen w-72 bg-card border-r border-border flex flex-col pt-16 md:pt-0 z-40 fixed md:relative shadow-xl shadow-black/5">
            {/* Header */}
            <div className="h-16 flex items-center justify-between px-4 border-b border-border bg-background/50">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-8 w-8 rounded-lg" />
            </div>

            {/* Navigation items */}
            <nav className="flex-1 py-6 px-3 space-y-2">
                {[...Array(6)].map((_, i) => (
                    <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                        <Skeleton className="h-5 w-5 min-w-[1.25rem]" />
                        <Skeleton className="h-4 w-24" />
                    </div>
                ))}
            </nav>

            {/* Footer */}
            <div className="p-4 border-t border-border">
                <div className="flex items-center gap-3 px-3 py-2.5">
                    <Skeleton className="h-5 w-5" />
                    <Skeleton className="h-4 w-20" />
                </div>
            </div>
        </aside>
    );
}

// Skeleton for the Gantt header/toolbar
export function GanttToolbarSkeleton() {
    return (
        <div className="flex-none px-4 py-2 border-b border-border bg-background/50 flex items-center gap-3">
            {/* View mode buttons */}
            <div className="flex bg-muted rounded-lg p-0.5 gap-1">
                <Skeleton className="h-7 w-14 rounded-md" />
                <Skeleton className="h-7 w-12 rounded-md" />
                <Skeleton className="h-7 w-16 rounded-md" />
            </div>

            {/* Filter */}
            <Skeleton className="h-8 w-16 rounded-lg" />

            {/* Search */}
            <Skeleton className="h-8 w-48 rounded-lg" />

            {/* Settings */}
            <Skeleton className="h-8 w-8 rounded-lg" />

            <div className="flex-1" />

            {/* Fullscreen */}
            <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
    );
}

// Skeleton for the Gantt chart area
export function GanttChartSkeleton() {
    return (
        <div className="flex-1 overflow-hidden relative p-4 flex flex-col">
            <div className="flex-1 w-full rounded-lg border border-border bg-card flex flex-col overflow-hidden">
                {/* Time header */}
                <div className="h-10 border-b border-border bg-muted/30 flex items-center px-4 gap-4">
                    <Skeleton className="h-6 w-6 rounded" />
                    <Skeleton className="h-6 w-16 rounded" />
                    <Skeleton className="h-6 w-6 rounded" />
                    <div className="flex-1" />
                    <Skeleton className="h-5 w-32" />
                </div>

                {/* Chart area */}
                <div className="flex-1 flex">
                    {/* Machine sidebar */}
                    <div className="w-48 border-r border-border p-2 space-y-3">
                        {[...Array(5)].map((_, i) => (
                            <Skeleton key={i} className="h-10 w-full rounded" />
                        ))}
                    </div>

                    {/* Timeline */}
                    <div className="flex-1 p-4 space-y-3">
                        <div className="flex gap-2">
                            <Skeleton className="h-9 rounded-lg w-[45%] ml-[5%]" />
                        </div>
                        <div className="flex gap-2">
                            <Skeleton className="h-9 rounded-lg w-[60%] ml-[15%]" />
                        </div>
                        <div className="flex gap-2">
                            <Skeleton className="h-9 rounded-lg w-[35%] ml-[10%]" />
                        </div>
                        <div className="flex gap-2">
                            <Skeleton className="h-9 rounded-lg w-[55%] ml-[0%]" />
                        </div>
                        <div className="flex gap-2">
                            <Skeleton className="h-9 rounded-lg w-[40%] ml-[20%]" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Full Production View Skeleton
export function ProductionViewSkeleton() {
    return (
        <div className="h-[calc(100vh-64px)] w-full flex flex-col bg-background">
            <GanttToolbarSkeleton />
            <GanttChartSkeleton />
        </div>
    );
}

// Dashboard Page Skeleton
export function DashboardSkeleton() {
    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <Skeleton className="h-9 w-40" />
                <Skeleton className="h-5 w-80 mt-2" />
            </div>

            {/* KPI Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="p-6 rounded-xl border bg-card shadow-sm">
                        <div className="flex justify-between">
                            <Skeleton className="h-4 w-28" />
                            <Skeleton className="h-4 w-4 rounded" />
                        </div>
                        <Skeleton className="h-9 w-16 mt-3" />
                    </div>
                ))}
            </div>

            {/* Charts */}
            <div className="grid gap-6 md:grid-cols-2">
                {/* Utilization Chart */}
                <div className="rounded-xl border bg-card shadow-sm p-6">
                    <div className="flex items-center gap-2 mb-6">
                        <Skeleton className="h-5 w-5" />
                        <div>
                            <Skeleton className="h-5 w-48" />
                            <Skeleton className="h-3 w-32 mt-1" />
                        </div>
                    </div>
                    <div className="h-[300px] flex items-end gap-2 p-4">
                        {[40, 65, 80, 55, 70, 45].map((h, i) => (
                            <Skeleton key={i} className="flex-1 rounded-t" style={{ height: `${h}%` }} />
                        ))}
                    </div>
                </div>

                {/* Trends Chart */}
                <div className="rounded-xl border bg-card shadow-sm p-6">
                    <div className="flex items-center gap-2 mb-6">
                        <Skeleton className="h-5 w-5" />
                        <div>
                            <Skeleton className="h-5 w-40" />
                            <Skeleton className="h-3 w-40 mt-1" />
                        </div>
                    </div>
                    <div className="h-[300px] flex flex-col justify-end p-4">
                        <Skeleton className="h-1/2 w-full rounded opacity-30" />
                        <Skeleton className="h-px w-full my-4" />
                        <div className="flex justify-between">
                            {[...Array(7)].map((_, i) => (
                                <Skeleton key={i} className="h-3 w-8" />
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Upcoming Deliveries */}
            <div className="rounded-xl border bg-card shadow-sm">
                <div className="p-6 border-b">
                    <Skeleton className="h-6 w-40" />
                </div>
                <div className="divide-y">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="p-4">
                            <div className="flex items-center justify-between gap-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <Skeleton className="h-4 w-20" />
                                        <Skeleton className="h-4 w-48" />
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                        <Skeleton className="h-3 w-24" />
                                        <Skeleton className="h-3 w-16" />
                                    </div>
                                </div>
                                <Skeleton className="h-6 w-24 rounded-full" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
