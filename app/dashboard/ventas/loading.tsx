import { CardGridSkeleton } from "@/components/ui/skeletons";

export default function Loading() {
    return (
        <div className="mx-auto max-w-6xl p-6">
            <CardGridSkeleton count={6} />
        </div>
    );
}
