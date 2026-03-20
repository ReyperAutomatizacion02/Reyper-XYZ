import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
    return (
        <div className="p-6 space-y-6">
            <Skeleton className="h-8 w-48" />
            <div className="flex gap-3">
                <Skeleton className="h-9 flex-1 max-w-sm rounded-md" />
                <Skeleton className="h-9 w-32 rounded-md" />
            </div>
            <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full rounded-md" />
                ))}
            </div>
        </div>
    );
}
