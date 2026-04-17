import { TableSkeleton } from "@/components/ui/skeletons";

export default function Loading() {
    return (
        <div className="flex flex-col gap-6 p-6">
            <TableSkeleton rows={10} cols={6} />
        </div>
    );
}
