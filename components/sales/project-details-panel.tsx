"use client";

import { useEffect, useState } from "react";
import { X, Calendar, User2, Building2, Package, Image as ImageIcon, Loader2, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { getProjectDetails } from "@/app/dashboard/ventas/actions";
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
    const [selectedItem, setSelectedItem] = useState<ProjectItem | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (project && isOpen) {
            loadItems(project.id);
        } else {
            setItems([]);
            setSelectedItem(null);
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
                        className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-background border-l border-border shadow-2xl z-20 flex flex-col pt-16 overflow-hidden"
                        id="project-details-panel"
                    >
                        <AnimatePresence mode="wait">
                            {!selectedItem ? (
                                <motion.div
                                    key="list"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="flex flex-col h-full"
                                >
                                    {/* Header */}
                                    <div className="p-6 border-b border-border bg-muted/10 flex-shrink-0" id="project-details-header">
                                        <div className="flex items-start justify-between mb-4">
                                            <Badge variant="outline" className="bg-red-500/5 text-red-600 dark:text-red-400 border-none shadow-none px-2 py-0.5 h-auto font-mono font-bold tracking-wider">
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
                                        <section className="space-y-4" id="project-details-dates">
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
                                                        <p className="font-semibold text-red-600 dark:text-red-400">{new Date(project.delivery_date).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
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
                                        <section className="space-y-4" id="project-details-items">
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
                                                        <div key={item.id} className="p-4 rounded-xl border border-border/50 bg-card/50 hover:border-primary/30 transition-all hover:shadow-lg group flex flex-col gap-4">
                                                            {/* Card Header: Code (Clickable, No Border) & Status */}
                                                            <div className="flex items-center justify-between gap-3 border-b border-border/40 pb-2 mb-1">
                                                                <span
                                                                    onClick={() => setSelectedItem(item)}
                                                                    className="text-[11px] font-mono font-bold text-red-500 dark:text-red-400 leading-none whitespace-nowrap cursor-pointer hover:underline transition-all"
                                                                >
                                                                    {item.part_code}
                                                                </span>
                                                                <Badge variant="secondary" className="text-[9px] px-2 py-0.5 h-auto bg-muted/80 text-muted-foreground border-border/50 font-normal tracking-wide">
                                                                    {item.status}
                                                                </Badge>
                                                            </div>

                                                            {/* Card Body: Image & Main Info */}
                                                            <div className="flex gap-5 items-start">
                                                                {/* Image Column (16:9) */}
                                                                <div className="w-32 aspect-video rounded-lg bg-white dark:bg-muted/10 flex items-center justify-center overflow-hidden relative border border-border shadow-sm shrink-0">
                                                                    {item.image ? (
                                                                        <Image
                                                                            src={item.image}
                                                                            alt={item.part_name}
                                                                            fill
                                                                            className="object-cover transition-transform duration-500 group-hover:scale-110"
                                                                            sizes="150px"
                                                                        />
                                                                    ) : (
                                                                        <ImageIcon className="w-6 h-6 text-muted-foreground/30" />
                                                                    )}
                                                                </div>

                                                                {/* Main Info Column: Name -> Material -> Pieces */}
                                                                <div className="flex-1 flex flex-col gap-3 min-w-0">
                                                                    <h4 className="text-sm font-bold text-foreground uppercase tracking-tight break-words">
                                                                        {item.part_name}
                                                                    </h4>

                                                                    <div className="flex flex-col gap-1 border-l-2 border-primary/20 pl-3 py-0.5">
                                                                        <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider truncate">
                                                                            {item.material}
                                                                        </span>
                                                                        <span className="text-[11px] font-bold text-foreground">
                                                                            {item.quantity} pza{item.quantity !== 1 ? 's' : ''}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </section>
                                    </div>
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="detail"
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                    className="flex flex-col h-full bg-card/30"
                                >
                                    {/* Detail Header */}
                                    <div className="p-6 border-b border-border bg-muted/30 flex-shrink-0">
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => setSelectedItem(null)}
                                                    className="h-8 w-8 rounded-full text-primary hover:text-primary/80 hover:bg-primary/10 transition-all -ml-2"
                                                >
                                                    <ChevronLeft className="w-5 h-5" />
                                                </Button>
                                                <span className="text-[13px] font-mono font-bold text-red-500 dark:text-red-400">
                                                    {selectedItem.part_code}
                                                </span>
                                            </div>
                                            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-full hover:bg-muted">
                                                <X className="w-5 h-5" />
                                            </Button>
                                        </div>
                                        <h2 className="text-xl font-bold leading-tight">{selectedItem.part_name}</h2>
                                    </div>

                                    {/* Detail Content */}
                                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                        <div className="aspect-video w-full rounded-xl bg-white dark:bg-muted/10 flex items-center justify-center relative overflow-hidden border border-border shadow-inner">
                                            {selectedItem.image ? (
                                                <Image
                                                    src={selectedItem.image}
                                                    alt={selectedItem.part_name}
                                                    fill
                                                    className="object-contain p-4"
                                                    sizes="400px"
                                                />
                                            ) : (
                                                <div className="flex flex-col items-center gap-2 text-muted-foreground/30">
                                                    <ImageIcon className="w-12 h-12" />
                                                    <span className="text-xs">Sin imagen disponible</span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="bg-muted/20 p-3 rounded-lg border border-border/50">
                                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Cantidad</p>
                                                <p className="text-sm font-bold">{selectedItem.quantity} piezas</p>
                                            </div>
                                            <div className="bg-muted/20 p-3 rounded-lg border border-border/50">
                                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Estatus</p>
                                                <Badge variant="secondary" className="text-[11px] h-auto py-0.5">
                                                    {selectedItem.status}
                                                </Badge>
                                            </div>
                                        </div>

                                        <div className="bg-muted/20 p-3 rounded-lg border border-border/50">
                                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Material</p>
                                            <p className="text-sm font-semibold">{selectedItem.material}</p>
                                        </div>

                                        <div className="pt-4 border-t border-border">
                                            <p className="text-xs text-muted-foreground italic text-center">
                                                En próximas versiones podrás ver planeación detallada por pieza aquí.
                                            </p>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
