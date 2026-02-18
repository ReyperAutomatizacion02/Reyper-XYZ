"use client";

import React, { useRef, useState, forwardRef, ReactNode } from "react";
import { UploadCloud, Loader2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface DropzoneProps {
    onFilesSelected: (files: File[]) => void;
    isUploading: boolean;
    children?: ReactNode;
    className?: string;
    accept?: string;
    multiple?: boolean;
}

export const Dropzone = forwardRef<HTMLInputElement, DropzoneProps>(({
    onFilesSelected,
    isUploading,
    children,
    className,
    accept = ".pdf,image/*",
    multiple = true
}, ref) => {
    const internalRef = useRef<HTMLInputElement>(null);
    const fileInputRef = (ref as React.RefObject<HTMLInputElement>) || internalRef;
    const [isDragging, setIsDragging] = useState(false);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            onFilesSelected(Array.from(e.dataTransfer.files));
        }
    };

    return (
        <div
            className={cn(
                "relative transition-all duration-200",
                !children && "w-full flex flex-col items-center justify-center border-2 border-dashed border-zinc-500/30 rounded-2xl p-8 hover:bg-zinc-500/5 cursor-pointer group",
                isDragging && "border-red-500 bg-red-500/5 ring-4 ring-red-500/10",
                className
            )}
            onClick={(e) => {
                if (!children) {
                    fileInputRef.current?.click();
                }
            }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            <input
                ref={fileInputRef}
                type="file"
                multiple={multiple}
                accept={accept}
                className="hidden"
                onChange={(e) => {
                    if (e.target.files) onFilesSelected(Array.from(e.target.files));
                }}
            />
            {isDragging && children && (
                <div className="absolute inset-0 z-[100] bg-red-500/10 backdrop-blur-[2px] border-2 border-dashed border-red-500 flex items-center justify-center rounded-xl pointer-events-none animate-in fade-in zoom-in duration-200">
                    <div className="bg-background/90 border border-red-500/20 px-6 py-4 rounded-2xl shadow-2xl flex flex-col items-center gap-2 scale-110">
                        <UploadCloud className="w-10 h-10 text-red-500 animate-bounce" />
                        <p className="text-sm font-bold uppercase text-red-600">Suelta tus planos aquí</p>
                    </div>
                </div>
            )}
            {children ? children : (
                <>
                    <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        {isUploading ? <Loader2 className="w-6 h-6 text-red-500 animate-spin" /> : <Plus className="w-6 h-6 text-red-500" />}
                    </div>
                    <p className="text-sm font-bold uppercase tracking-tight">{isUploading ? "Subiendo archivos..." : "Sube tus archivos aquí o arrástralos"}</p>
                    <p className="text-[10px] text-muted-foreground mt-1 uppercase">PDF o imágenes únicamente</p>
                </>
            )}
        </div>
    );
});

Dropzone.displayName = "Dropzone";
