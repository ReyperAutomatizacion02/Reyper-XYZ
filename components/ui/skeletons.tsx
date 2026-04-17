import { Skeleton } from "@/components/ui/skeleton";

export function DashboardHeaderSkeleton() {
    return (
        <div className="flex items-center gap-4">
            <Skeleton className="h-14 w-14 rounded-2xl" />
            <div className="space-y-2">
                <Skeleton className="h-7 w-32" />
                <Skeleton className="h-4 w-56" />
            </div>
        </div>
    );
}

export function CardGridSkeleton({ count = 6 }: { count?: number }) {
    return (
        <div className="space-y-8">
            <DashboardHeaderSkeleton />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: count }).map((_, i) => (
                    <div
                        key={i}
                        className="flex min-h-[160px] flex-col gap-3 rounded-2xl border border-border bg-card p-5"
                    >
                        <div className="flex items-center gap-3">
                            <Skeleton className="h-10 w-10 rounded-xl" />
                            <Skeleton className="h-5 w-32" />
                        </div>
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-3/4" />
                    </div>
                ))}
            </div>
        </div>
    );
}

export function TableSkeleton({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
    return (
        <div className="space-y-8">
            <DashboardHeaderSkeleton />
            <div className="rounded-lg border border-border">
                <div className="flex gap-4 border-b border-border bg-muted/30 px-4 py-3">
                    {Array.from({ length: cols }).map((_, i) => (
                        <Skeleton key={i} className="h-4 flex-1" />
                    ))}
                </div>
                {Array.from({ length: rows }).map((_, i) => (
                    <div key={i} className="flex gap-4 border-b border-border px-4 py-3 last:border-b-0">
                        {Array.from({ length: cols }).map((_, j) => (
                            <Skeleton key={j} className="h-4 flex-1" />
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}
