"use client";

import { useRef, useEffect, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
    X,
    Calendar,
    User2,
    Building2,
    Package,
    Image as ImageIcon,
    Loader2,
    ChevronLeft,
    ChevronRight,
    Upload,
    Trash2,
    ExternalLink,
    AlertCircle,
    Eye,
    Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { getProjectDetails, updateProject } from "@/app/dashboard/ventas/actions";
import { parseLocalDate } from "@/lib/date-utils";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { ProjectHeaderForm } from "./project-header-form";
import { ProductionItemDetail } from "./production-item-detail";
import { ProductionItemSummary } from "./production-item-summary";

interface Project {
    id: string;
    code: string;
    name: string;
    company: string;
    company_id?: string;
    requestor: string;
    requestor_id?: string;
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
    status_id?: string;
    image?: string;
    material: string;
    material_id?: string;
    unit?: string;
    treatment: string;
    treatment_id?: string;
    design_no?: string;
    urgencia?: boolean;
    drawing_url?: string;
    genral_status?: string;
    urgency_level?: string;
}

interface ProjectDetailsPanelProps {
    project: Project | null;
    isOpen: boolean;
    onClose: () => void;
    onProjectUpdated?: () => void;
    clients?: { id: string; name: string; prefix?: string | null }[];
    contacts?: { id: string; name: string; client_id?: string }[];
    materials?: { id: string; name: string }[];
    statuses?: { id: string; name: string }[];
    treatments?: { id: string; name: string }[];
}

export function ProjectDetailsPanel({
    project,
    isOpen,
    onClose,
    onProjectUpdated,
    clients = [],
    contacts = [],
    materials = [],
    statuses = [],
    treatments = []
}: ProjectDetailsPanelProps) {
    const [items, setItems] = useState<ProjectItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [selectedItem, setSelectedItem] = useState<ProjectItem | null>(null);

    useEffect(() => {
        if (project && isOpen) {
            loadItems(project.id);
            setSelectedItem(null);
        } else {
            setItems([]);
            setIsEditing(false);
            setSelectedItem(null);
        }
    }, [project, isOpen]);

    const handleSaveProject = async (data: {
        name: string;
        start_date: string;
        delivery_date: string;
        company: string;
        company_id: string;
        requestor: string;
        requestor_id: string;
    }) => {
        if (!project) return;
        setIsSaving(true);
        try {
            const formData = {
                name: data.name,
                company: data.company,
                company_id: data.company_id,
                requestor: data.requestor,
                requestor_id: data.requestor_id,
                start_date: data.start_date,
                delivery_date: data.delivery_date,
            };

            const result = await updateProject(project.id, formData);

            if (result.success) {
                toast.success("Proyecto actualizado correctamente");
                setIsEditing(false);
                if (onProjectUpdated) {
                    onProjectUpdated();
                }
            } else {
                toast.error(result.error || "Error al actualizar proyecto");
            }
        } catch (error) {
            console.error("Error saving project:", error);
            toast.error("Error al actualizar proyecto");
        } finally {
            setIsSaving(false);
        }
    };

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

    // Calculate progress
    const startDate = parseLocalDate(project.start_date)?.getTime() || 0;
    const endDate = parseLocalDate(project.delivery_date)?.getTime() || 0;
    const today = new Date().setHours(0, 0, 0, 0);
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
                        className="fixed right-0 top-0 bottom-0 w-full max-w-[500px] bg-background border-l border-border shadow-2xl z-20 flex flex-col pt-16 overflow-hidden"
                        id="project-details-panel"
                    >
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={selectedItem ? "detail" : "list"}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="flex flex-col h-full"
                            >
                                <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800 bg-slate-50/30 dark:bg-transparent flex flex-col h-full">

                                    {!selectedItem ? (
                                        <div className="flex flex-col flex-1">
                                            <ProjectHeaderForm
                                                project={project}
                                                isEditing={isEditing}
                                                isSaving={isSaving}
                                                onToggleEdit={setIsEditing}
                                                onSave={handleSaveProject}
                                                onClose={onClose}
                                                clients={clients}
                                                contacts={contacts}
                                            />

                                            {!isEditing && (
                                                <div className="p-5 space-y-8 flex-1">
                                                    <div className="flex flex-col gap-3">
                                                        <div className="flex items-center gap-2 text-slate-500 pl-1">
                                                            <Calendar className="w-4 h-4" />
                                                            <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500 text-opacity-80">Tiempos</span>
                                                        </div>
                                                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
                                                            <div className="flex justify-between items-start mb-6">
                                                                <div className="flex flex-col">
                                                                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Inicio</span>
                                                                    <span className="text-[15px] font-bold text-slate-900 dark:text-white capitalize">
                                                                        {format(parseLocalDate(project.start_date) || new Date(), "dd MMM yyyy", { locale: es })}
                                                                    </span>
                                                                </div>
                                                                <div className="flex flex-col text-right">
                                                                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Entrega</span>
                                                                    <span className="text-[15px] font-bold text-[#EC1C21] capitalize">
                                                                        {format(parseLocalDate(project.delivery_date) || new Date(), "dd MMM yyyy", { locale: es })}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <div className="flex flex-col gap-2">
                                                                <div className="flex justify-between items-center">
                                                                    <span className="text-[11px] font-bold text-slate-900 dark:text-white">Progreso de tiempo</span>
                                                                    <span className="text-[11px] font-bold text-slate-900 dark:text-white">{Math.round(progress)}%</span>
                                                                </div>
                                                                <Progress value={progress} className="h-1.5 [&>div]:bg-[#EC1C21] bg-slate-100 dark:bg-slate-800" />
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-col gap-4">
                                                        <div className="flex items-center gap-2 text-slate-500 pl-1 mb-1">
                                                            <Package className="w-4 h-4" />
                                                            <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500 text-opacity-80">Partidas ({items.length})</span>
                                                        </div>

                                                        <div className="space-y-4">
                                                            {loading ? (
                                                                <div className="flex justify-center p-8">
                                                                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                                                                </div>
                                                            ) : items.length === 0 ? (
                                                                <div className="text-center p-8 text-muted-foreground bg-muted/30 rounded-lg border border-dashed">
                                                                    <Package className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                                                    <p>No hay partidas registradas</p>
                                                                </div>
                                                            ) : (
                                                                <div className="grid grid-cols-1 gap-2.5">
                                                                    {items.map((item) => (
                                                                        <ProductionItemSummary
                                                                            key={item.id}
                                                                            item={item}
                                                                            onClick={() => setSelectedItem(item)}
                                                                        />
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="flex flex-col flex-1 h-full bg-slate-50/50 dark:bg-slate-900/10">
                                            {/* Drill-down Header: New Layout */}
                                            <div className="flex items-center justify-between h-16 p-4 bg-background border-b border-border sticky top-0 z-10 shrink-0">
                                                <div className="flex items-center gap-3">
                                                    {/* Back Button */}
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => {
                                                            setSelectedItem(null);
                                                            setIsEditing(false);
                                                        }}
                                                        className="h-9 w-9 p-0 rounded-full hover:bg-slate-100 text-slate-500"
                                                    >
                                                        <ChevronLeft className="w-5 h-5" />
                                                    </Button>

                                                    {/* Part Code */}
                                                    <Badge variant="secondary" className="bg-red-50 text-red-600 hover:bg-red-100 border-none px-4 py-1.5 font-mono text-xs font-bold tracking-widest shadow-none rounded-xl">
                                                        {selectedItem.part_code}
                                                    </Badge>

                                                    {/* Item Navigation - Hidden in Edit Mode to reduce saturation */}
                                                    {!isEditing && (
                                                        <div className="flex items-center gap-1 bg-slate-100/50 dark:bg-slate-800/50 p-1 rounded-lg border border-slate-200/50 dark:border-slate-700/50">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => {
                                                                    const idx = items.findIndex(i => i.id === selectedItem.id);
                                                                    if (idx > 0) {
                                                                        setSelectedItem(items[idx - 1]);
                                                                    }
                                                                }}
                                                                disabled={items.findIndex(i => i.id === selectedItem.id) === 0}
                                                                className="h-6 w-6 p-0 hover:bg-white dark:hover:bg-slate-700 text-slate-400"
                                                            >
                                                                <ChevronLeft className="w-4 h-4" />
                                                            </Button>
                                                            <span className="text-[9px] font-bold font-mono text-slate-400 px-1 select-none">
                                                                {items.findIndex(i => i.id === selectedItem.id) + 1}/{items.length}
                                                            </span>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => {
                                                                    const idx = items.findIndex(i => i.id === selectedItem.id);
                                                                    if (idx < items.length - 1) {
                                                                        setSelectedItem(items[idx + 1]);
                                                                    }
                                                                }}
                                                                disabled={items.findIndex(i => i.id === selectedItem.id) === items.length - 1}
                                                                className="h-6 w-6 p-0 hover:bg-white dark:hover:bg-slate-700 text-slate-400"
                                                            >
                                                                <ChevronRight className="w-4 h-4" />
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    {isEditing ? (
                                                        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-4 duration-300">
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => setIsEditing(false)}
                                                                disabled={isSaving}
                                                                className="h-8 px-4 text-[10px] font-bold uppercase tracking-widest text-slate-400 border-slate-200 hover:bg-slate-50 bg-white dark:bg-slate-900 rounded-lg transition-all"
                                                            >
                                                                Cancelar
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                onClick={() => {
                                                                    const btn = document.getElementById('trigger-save-item');
                                                                    if (btn) btn.click();
                                                                }}
                                                                className="h-8 px-4 text-[10px] font-bold uppercase tracking-widest bg-[#EC1C21] hover:bg-[#D1181C] text-white rounded-lg shadow-lg shadow-red-500/10 border-none transition-all hover:scale-[1.02]"
                                                            >
                                                                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Check className="w-3.5 h-3.5 mr-1.5" />}
                                                                {isSaving ? "Guardando..." : "Guardar"}
                                                            </Button>
                                                        </div>
                                                    ) : (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => setIsEditing(true)}
                                                            className="h-8 px-4 text-[10px] font-bold uppercase tracking-widest text-red-600 border-red-100 hover:bg-red-50 bg-white dark:bg-slate-950 rounded-lg transition-all"
                                                        >
                                                            EDITAR
                                                        </Button>
                                                    )}

                                                    <Button variant="ghost" size="icon" onClick={onClose} className="h-9 w-9 text-slate-400 hover:text-slate-600 ml-1">
                                                        <X className="w-5 h-5" />
                                                    </Button>
                                                </div>
                                            </div>

                                            {/* Item Detail Component Content */}
                                            <div className="flex-1 overflow-y-auto overflow-x-hidden p-6">
                                                <ProductionItemDetail
                                                    key={selectedItem.id}
                                                    item={selectedItem}
                                                    isEditing={isEditing}
                                                    setIsEditing={setIsEditing}
                                                    onUpdate={() => {
                                                        loadItems(project.id);
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        </AnimatePresence>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
