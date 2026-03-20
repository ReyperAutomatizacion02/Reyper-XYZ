import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
    return (
        <div className="p-6 space-y-6">
            <Skeleton className="h-8 w-40" />
            <div className="flex gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-24 rounded-md" />
                ))}
            </div>
            <div className="flex gap-3">
                <Skeleton className="h-9 flex-1 max-w-sm rounded-md" />
                <Skeleton className="h-9 w-28 rounded-md" />
            </div>
            <div className="space-y-2">
                {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full rounded-md" />
                ))}
            </div>
        </div>
    );
}
