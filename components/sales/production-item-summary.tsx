"use client";

import { Package, Calendar, Settings } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";

interface ProductionItemSummaryProps {
    item: any;
    onClick: () => void;
}

export function ProductionItemSummary({ item, onClick }: ProductionItemSummaryProps) {
    return (
        <div
            onClick={onClick}
            className="bg-white dark:bg-slate-900 rounded-xl p-3 shadow-sm border border-slate-200/60 dark:border-slate-800/60 hover:shadow-md cursor-pointer transition-all hover:border-[#EC1C21]/30 group flex gap-4 items-center"
        >
            {/* Thumbnail */}
            <div className="w-28 aspect-video shrink-0 relative rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center border border-slate-200/50 dark:border-slate-700/50 group-hover:border-[#EC1C21]/20 transition-colors">
                {item.image || item.drawing_url ? (
                    <Image
                        src={item.image || item.drawing_url}
                        alt="Plano"
                        fill
                        className="object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                        sizes="(max-width: 768px) 100vw, 112px"
                    />
                ) : (
                    <div className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
                        <Package className="w-5 h-5 mb-0.5 opacity-50" />
                        <span className="text-[8px] font-bold uppercase tracking-wider opacity-70">S/I</span>
                    </div>
                )}
            </div>

            {/* Info */}
            <div className="flex flex-col flex-1 min-w-0">
                <div className="flex justify-between items-start mb-1 gap-2">
                    <span className="text-[10px] font-bold text-[#EC1C21] font-mono tracking-widest bg-[#EC1C21]/5 px-1.5 py-0.5 rounded">
                        {item.part_code}
                    </span>
                    <Badge variant="secondary" className="bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold text-[8px] uppercase tracking-wider px-2 py-0 border-none">
                        {item.status}
                    </Badge>
                </div>

                <h4 className="font-black text-[13px] uppercase text-slate-800 dark:text-slate-200 truncate leading-tight group-hover:text-[#EC1C21] transition-colors">
                    {item.part_name}
                </h4>

                <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-[10px] font-bold text-slate-500 bg-slate-50 dark:bg-slate-800/50 px-1.5 rounded uppercase">
                        {item.quantity} pzas
                    </span>
                    <span className="text-[10px] font-medium text-slate-400 truncate max-w-[100px]">
                        {item.material || 'S/M'}
                    </span>
                </div>
            </div>
        </div>
    );
}
