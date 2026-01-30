"use client";

import { useEffect, useState } from "react";
import { X, Calendar, User2, Building2, Package, Image as ImageIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { getProjectDetails } from "../../actions";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";

interface Project {
    id: string;
    code: string;
    name: string;
    company: string;
    requestor: string;
    start_date: string;
    delivery_date: string;
    status: string;
}

interface ProjectItem {
    id: string;
    part_code: string;
    part_name: string;
    quantity: number;
    status: string;
    image?: string;
    material: string;
}

interface ProjectDetailsPanelProps {
    project: Project | null;
    isOpen: boolean;
    onClose: () => void;
}

export function ProjectDetailsPanel({ project, isOpen, onClose }: ProjectDetailsPanelProps) {
    const [items, setItems] = useState<ProjectItem[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (project && isOpen) {
            loadItems(project.id);
        } else {
            setItems([]);
        }
    }, [project, isOpen]);

    const loadItems = async (id: string) => {
        setLoading(true);
        try {
            const data = await getProjectDetails(id);
            setItems(data as any);
        } catch (error: any) {
            toast.error("Error al cargar partidas: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    if (!project) return null;

    // Calculate progress (same logic as card)
    const startDate = new Date(project.start_date).getTime();
    const endDate = new Date(project.delivery_date).getTime();
    const today = new Date().getTime();
    const totalDuration = endDate - startDate;
    const elapsed = today - startDate;
    const progress = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Panel */}
                    <motion.div
                        initial={{ x: "100%" }}
                        animate={{ x: 0 }}
                        exit={{ x: "100%" }}
                        transition={{ type: "spring", damping: 25, stiffness: 200 }}
                        className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-background border-l border-border shadow-2xl z-20 flex flex-col pt-16"
                    >
                        {/* Header */}
                        <div className="p-6 border-b border-border bg-muted/10 flex-shrink-0">
                            <div className="flex items-start justify-between mb-4">
                                <Badge variant="outline" className="bg-red-500/5 text-red-600 border-red-200 font-mono font-bold tracking-wider">
                                    {project.code}
                                </Badge>
                                <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-full hover:bg-muted">
                                    <X className="w-5 h-5" />
                                </Button>
                            </div>
                            <h2 className="text-2xl font-bold leading-tight mb-2">{project.name}</h2>
                            <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                                <div className="flex items-center">
                                    <Building2 className="w-4 h-4 mr-2" />
                                    {project.company}
                                </div>
                                <div className="flex items-center">
                                    <User2 className="w-4 h-4 mr-2" />
                                    {project.requestor}
                                </div>
                            </div>
                        </div>

                        {/* Scrollable Content */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-8">

                            {/* Dates & Progress */}
                            <section className="space-y-4">
                                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center">
                                    <Calendar className="w-4 h-4 mr-2" /> Tiempos
                                </h3>
                                <div className="bg-muted/30 p-4 rounded-xl border border-border/50 space-y-4">
                                    <div className="flex justify-between items-center text-sm">
                                        <div>
                                            <p className="text-xs text-muted-foreground mb-1">Inicio</p>
                                            <p className="font-semibold">{new Date(project.start_date).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs text-muted-foreground mb-1">Entrega Estimada</p>
                                            <p className="font-semibold text-red-600">{new Date(project.delivery_date).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-xs font-medium">
                                            <span>Progreso de tiempo</span>
                                            <span>{Math.round(progress)}%</span>
                                        </div>
                                        <Progress value={progress} className="h-2" />
                                    </div>
                                </div>
                            </section>

                            {/* Production Orders / Items */}
                            <section className="space-y-4">
                                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                                    <span className="flex items-center"><Package className="w-4 h-4 mr-2" /> Partidas ({items.length})</span>
                                    {loading && <Loader2 className="w-3 h-3 animate-spin" />}
                                </h3>

                                {loading && items.length === 0 ? (
                                    <div className="space-y-3">
                                        {[1, 2, 3].map(i => (
                                            <div key={i} className="h-20 bg-muted/50 rounded-lg animate-pulse" />
                                        ))}
                                    </div>
                                ) : items.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground text-sm italic">
                                        No hay partidas registradas para este proyecto.
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {items.map(item => (
                                            <div key={item.id} className="flex gap-4 p-3 rounded-lg border border-border/50 bg-card hover:border-red-500/30 transition-colors">
                                                {/* Left Column: Image & Quantity */}
                                                <div className="flex flex-col gap-1.5 shrink-0">
                                                    <div className="w-36 h-20 rounded-md bg-white dark:bg-muted/20 flex items-center justify-center overflow-hidden relative border border-border">
                                                        {item.image ? (
                                                            <Image
                                                                src={item.image}
                                                                alt={item.part_name}
                                                                fill
                                                                className="object-contain"
                                                                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                                            />
                                                        ) : (
                                                            <ImageIcon className="w-6 h-6 text-muted-foreground/30" />
                                                        )}
                                                    </div>
                                                    <div className="flex items-center justify-center bg-muted/40 rounded py-1 border border-border/30">
                                                        <span className="text-[11px] font-semibold text-muted-foreground/80 leading-none">
                                                            {item.quantity} pza{item.quantity !== 1 ? 's' : ''}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Info */}
                                                <div className="flex-1 min-w-0 flex flex-col justify-between">
                                                    <div>
                                                        <div className="mb-1.5 mt-0.5">
                                                            <span className="text-xs font-mono font-bold text-red-500 bg-red-500/5 px-1.5 py-0.5 rounded border border-red-100 dark:border-red-500/10">
                                                                {item.part_code}
                                                            </span>
                                                        </div>
                                                        <h4 className="text-sm font-semibold leading-tight mb-2 line-clamp-2" title={item.part_name}>
                                                            {item.part_name}
                                                        </h4>
                                                    </div>

                                                    <div className="flex flex-col gap-1.5 mt-auto">
                                                        <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                                                            {item.material}
                                                        </span>
                                                        <Badge variant="secondary" className="text-[10px] px-2 py-0.5 w-fit whitespace-normal text-left h-auto">
                                                            {item.status}
                                                        </Badge>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </section>

                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
