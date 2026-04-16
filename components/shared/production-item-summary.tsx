"use client";

import { Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";
import { cn, isValidImageSrc } from "@/lib/utils";

interface ProductionItemSummaryProps {
    item: any;
    onClick: () => void;
    hiddenFields?: string[];
}

export function ProductionItemSummary({ item, onClick, hiddenFields = [] }: ProductionItemSummaryProps) {
    const imageSource = item.image;
    const hasValidImage = isValidImageSrc(imageSource);

    return (
        <div
            onClick={onClick}
            className="group flex cursor-pointer items-center gap-4 rounded-xl border border-slate-200/60 bg-white p-3 shadow-sm transition-all hover:border-brand/30 hover:shadow-md dark:border-slate-800/60 dark:bg-slate-900"
        >
            {/* Thumbnail */}
            {!hiddenFields.includes("image") && (
                <div className="relative flex aspect-video w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200/50 bg-slate-100 transition-colors group-hover:border-brand/20 dark:border-slate-700/50 dark:bg-slate-800">
                    {hasValidImage ? (
                        <Image
                            src={imageSource}
                            alt={item.part_name || item.part_code || "Imagen de pieza"}
                            fill
                            className="object-cover opacity-90 transition-opacity group-hover:opacity-100"
                            sizes="(max-width: 768px) 100vw, 112px"
                        />
                    ) : (
                        <div className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
                            <Package className="mb-0.5 h-5 w-5 opacity-50" />
                            <span className="text-[8px] font-bold uppercase tracking-wider opacity-70">S/I</span>
                        </div>
                    )}
                </div>
            )}

            {/* Info */}
            <div className="flex min-w-0 flex-1 flex-col">
                <div className="mb-1 flex items-start justify-between gap-2">
                    <span className="rounded bg-brand/5 px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-widest text-brand">
                        {item.part_code}
                    </span>
                    {!hiddenFields.includes("status") && (
                        <Badge
                            variant="secondary"
                            className="border-none bg-slate-100 px-2 py-0 text-[8px] font-bold uppercase tracking-wider text-slate-500 dark:bg-slate-800"
                        >
                            {item.status || item.general_status}
                        </Badge>
                    )}
                </div>

                <h4 className="truncate text-[13px] font-black uppercase leading-tight text-slate-800 transition-colors group-hover:text-brand dark:text-slate-200">
                    {item.part_name}
                </h4>

                <div className="mt-1.5 flex items-center gap-3">
                    {!hiddenFields.includes("quantity") && (
                        <span className="rounded bg-slate-50 px-1.5 text-[10px] font-bold uppercase text-slate-500 dark:bg-slate-800/50">
                            {item.quantity} pzas
                        </span>
                    )}
                    {!hiddenFields.includes("material") && (
                        <span className="max-w-[100px] truncate text-[10px] font-medium text-slate-400">
                            {item.material || "S/M"}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}
