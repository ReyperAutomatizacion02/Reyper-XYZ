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

export const Dropzone = forwardRef<HTMLInputElement, DropzoneProps>(
    ({ onFilesSelected, isUploading, children, className, accept = ".pdf,image/*", multiple = true }, ref) => {
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
                    !children &&
                        "group flex w-full cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-500/30 p-8 hover:bg-zinc-500/5",
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
                    <div className="pointer-events-none absolute inset-0 z-dropdown flex items-center justify-center rounded-xl border-2 border-dashed border-red-500 bg-red-500/10 backdrop-blur-[2px] duration-200 animate-in fade-in zoom-in">
                        <div className="flex scale-110 flex-col items-center gap-2 rounded-2xl border border-red-500/20 bg-background/90 px-6 py-4 shadow-2xl">
                            <UploadCloud className="h-10 w-10 animate-bounce text-red-500" />
                            <p className="text-sm font-bold uppercase text-red-600">Suelta tus planos aquí</p>
                        </div>
                    </div>
                )}
                {children ? (
                    children
                ) : (
                    <>
                        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/10 transition-transform group-hover:scale-110">
                            {isUploading ? (
                                <Loader2 className="h-6 w-6 animate-spin text-red-500" />
                            ) : (
                                <Plus className="h-6 w-6 text-red-500" />
                            )}
                        </div>
                        <p className="text-sm font-bold uppercase tracking-tight">
                            {isUploading ? "Subiendo archivos..." : "Sube tus archivos aquí o arrástralos"}
                        </p>
                        <p className="mt-1 text-[10px] uppercase text-muted-foreground">PDF o imágenes únicamente</p>
                    </>
                )}
            </div>
        );
    }
);

Dropzone.displayName = "Dropzone";
