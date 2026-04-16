"use client";

import { useRef, useEffect, useState } from "react";
import { ItemFieldKey } from "./types";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/utils/cn";
import logger from "@/utils/logger";
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
    Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { getProjectDetails, updateProject } from "@/app/dashboard/ventas/actions";
import { getErrorMessage } from "@/lib/action-result";
import { parseLocalDate } from "@/lib/date-utils";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { ProjectHeaderForm } from "./project-header-form";
import { ProductionItemDetail } from "./production-item-detail";
import { ProductionItemSummary } from "./production-item-summary";
import { useSidebar } from "@/components/sidebar-context";
import { DrawingViewerContent } from "../sales/drawing-viewer";

interface Project {
    id: string;
    code: string | null;
    name: string | null;
    company: string | null;
    company_id?: string | null;
    requestor: string | null;
    requestor_id?: string | null;
    start_date: string | null;
    delivery_date: string | null;
    status: string | null;
}

interface ProjectItem {
    id: string;
    part_code: string;
    part_name: string | null;
    quantity: number | null;
    status: string | null;
    status_id?: string | null;
    image?: string | null;
    material: string | null;
    material_id?: string | null;
    unit?: string | null;
    treatment: string | null;
    treatment_id?: string | null;
    design_no?: string | null;
    urgencia?: boolean | null;
    drawing_url?: string | null;
    general_status?: string | null;
    urgency_level?: string;
    material_confirmation?: string | null;
    model_url?: string | null;
    render_url?: string | null;
}

interface ProjectDetailsPanelProps {
    project: Project | null;
    isOpen: boolean;
    onClose: () => void;
    onProjectUpdated?: () => void;
    clients?: { id: string; name: string; prefix?: string | null }[];
    contacts?: { id: string; name: string; client_id?: string | null }[];
    materials?: { id: string; name: string }[];
    statuses?: { id: string; name: string }[];
    treatments?: { id: string; name: string }[];
    config?: {
        header?: {
            allowEdit?: boolean;
            hiddenFields?: string[];
            readOnlyFields?: string[];
        };
        items?: {
            allowEdit?: boolean;
            hiddenFields?: ItemFieldKey[];
            readOnlyFields?: ItemFieldKey[];
        };
    };
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
    treatments = [],
    config = {
        header: { allowEdit: true, hiddenFields: [], readOnlyFields: [] },
        items: { allowEdit: true, hiddenFields: [], readOnlyFields: [] },
    },
}: ProjectDetailsPanelProps) {
    const [items, setItems] = useState<ProjectItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [selectedItem, setSelectedItem] = useState<ProjectItem | null>(null);
    const [sideDrawing, setSideDrawing] = useState<{ url: string; title: string } | null>(null);
    const { isCollapsed } = useSidebar();

    useEffect(() => {
        if (project?.id && isOpen) {
            loadItems(project.id);
        } else if (!isOpen) {
            setItems([]);
            setIsEditing(false);
            setSelectedItem(null);
            setSideDrawing(null);
        }
    }, [project?.id, isOpen]);

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
                toast.error(getErrorMessage(result.error));
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
            const itemsList = data;
            setItems(itemsList);

            // Sync selected item if viewing detail
            if (selectedItem) {
                const updated = itemsList.find((i) => i.id === selectedItem.id);
                if (updated) setSelectedItem(updated);
            }
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
                    {/* Side Drawing View Area (Outside of panel to avoid clipping) */}
                    <AnimatePresence>
                        {sideDrawing && (
                            <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                className={cn(
                                    "fixed bottom-0 right-[500px] top-16 z-sub-panel border-r border-border bg-slate-100/90 backdrop-blur-sm transition-all duration-300",
                                    isCollapsed ? "left-[80px]" : "left-[288px]",
                                    "max-lg:left-0"
                                )}
                            >
                                <DrawingViewerContent
                                    url={sideDrawing.url}
                                    title={sideDrawing.title}
                                    onClose={() => setSideDrawing(null)}
                                    isInline
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Panel */}
                    <motion.div
                        initial={{ x: "100%" }}
                        animate={{ x: 0 }}
                        exit={{ x: "100%" }}
                        transition={{ type: "spring", damping: 25, stiffness: 200 }}
                        className="fixed inset-y-0 right-0 top-0 z-20 flex w-full max-w-[500px] flex-col border-l border-border bg-background pt-16 shadow-2xl"
                        id="project-details-panel"
                    >
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={selectedItem ? "detail" : "list"}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="flex h-full flex-col"
                            >
                                <div className="scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800 flex h-full flex-1 flex-col overflow-y-auto bg-slate-50/30 dark:bg-transparent">
                                    {!selectedItem ? (
                                        <div className="flex flex-1 flex-col">
                                            <ProjectHeaderForm
                                                project={project}
                                                isEditing={isEditing}
                                                isSaving={isSaving}
                                                onToggleEdit={setIsEditing}
                                                onSave={handleSaveProject}
                                                onClose={onClose}
                                                clients={clients}
                                                contacts={contacts}
                                                allowEdit={config.header?.allowEdit}
                                                readOnlyFields={config.header?.readOnlyFields}
                                                hiddenFields={config.header?.hiddenFields}
                                            />

                                            {!isEditing && (
                                                <div className="flex-1 space-y-8 p-5">
                                                    {!config.header?.hiddenFields?.includes("times") && (
                                                        <div className="flex flex-col gap-3">
                                                            <div className="flex items-center gap-2 pl-1 text-slate-500">
                                                                <Calendar className="h-4 w-4" />
                                                                <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500 text-opacity-80">
                                                                    Tiempos
                                                                </span>
                                                            </div>
                                                            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                                                                <div className="mb-6 flex items-start justify-between">
                                                                    <div className="flex flex-col">
                                                                        <span className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                                                            Inicio
                                                                        </span>
                                                                        <span className="text-[15px] font-bold capitalize text-slate-900 dark:text-white">
                                                                            {format(
                                                                                parseLocalDate(project.start_date) ||
                                                                                    new Date(),
                                                                                "dd MMM yyyy",
                                                                                { locale: es }
                                                                            )}
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex flex-col text-right">
                                                                        <span className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                                                            Entrega
                                                                        </span>
                                                                        <span className="text-[15px] font-bold capitalize text-brand">
                                                                            {format(
                                                                                parseLocalDate(project.delivery_date) ||
                                                                                    new Date(),
                                                                                "dd MMM yyyy",
                                                                                { locale: es }
                                                                            )}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                <div className="flex flex-col gap-2">
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-[11px] font-bold text-slate-900 dark:text-white">
                                                                            Progreso de tiempo
                                                                        </span>
                                                                        <span className="text-[11px] font-bold text-slate-900 dark:text-white">
                                                                            {Math.round(progress)}%
                                                                        </span>
                                                                    </div>
                                                                    <Progress
                                                                        value={progress}
                                                                        className="h-1.5 bg-slate-100 dark:bg-slate-800 [&>div]:bg-brand"
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}

                                                    <div className="flex flex-col gap-4">
                                                        <div className="mb-1 flex items-center gap-2 pl-1 text-slate-500">
                                                            <Package className="h-4 w-4" />
                                                            <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500 text-opacity-80">
                                                                Partidas ({items.length})
                                                            </span>
                                                        </div>

                                                        <div className="space-y-4">
                                                            {loading ? (
                                                                <div className="flex justify-center p-8">
                                                                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                                                </div>
                                                            ) : items.length === 0 ? (
                                                                <div className="rounded-lg border border-dashed bg-muted/30 p-8 text-center text-muted-foreground">
                                                                    <Package className="mx-auto mb-2 h-8 w-8 opacity-20" />
                                                                    <p>No hay partidas registradas</p>
                                                                </div>
                                                            ) : (
                                                                <div className="grid grid-cols-1 gap-2.5">
                                                                    {items.map((item) => (
                                                                        <ProductionItemSummary
                                                                            key={item.id}
                                                                            item={item}
                                                                            onClick={() => setSelectedItem(item)}
                                                                            hiddenFields={config.items?.hiddenFields}
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
                                        <div className="flex h-full flex-1 flex-col bg-slate-50/50 dark:bg-slate-900/10">
                                            {/* Drill-down Header: New Layout */}
                                            <div className="sticky top-0 z-10 flex h-16 shrink-0 items-center justify-between border-b border-border bg-background p-4">
                                                <div className="flex items-center gap-3">
                                                    {/* Back Button */}
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => {
                                                            setSelectedItem(null);
                                                            setIsEditing(false);
                                                        }}
                                                        className="h-9 w-9 rounded-full p-0 text-slate-500 hover:bg-slate-100"
                                                    >
                                                        <ChevronLeft className="h-5 w-5" />
                                                    </Button>

                                                    {/* Part Code */}
                                                    <Badge
                                                        variant="secondary"
                                                        className="rounded-xl border-none bg-red-50 px-4 py-1.5 font-mono text-xs font-bold tracking-widest text-red-600 shadow-none hover:bg-red-100"
                                                    >
                                                        {selectedItem.part_code}
                                                    </Badge>

                                                    {/* Item Navigation - Hidden in Edit Mode to reduce saturation */}
                                                    {!isEditing && (
                                                        <div className="flex items-center gap-1 rounded-lg border border-slate-200/50 bg-slate-100/50 p-1 dark:border-slate-700/50 dark:bg-slate-800/50">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => {
                                                                    const idx = items.findIndex(
                                                                        (i) => i.id === selectedItem.id
                                                                    );
                                                                    if (idx > 0) {
                                                                        setSelectedItem(items[idx - 1]);
                                                                    }
                                                                }}
                                                                disabled={
                                                                    items.findIndex((i) => i.id === selectedItem.id) ===
                                                                    0
                                                                }
                                                                className="h-6 w-6 p-0 text-slate-400 hover:bg-white dark:hover:bg-slate-700"
                                                            >
                                                                <ChevronLeft className="h-4 w-4" />
                                                            </Button>
                                                            <span className="select-none px-1 font-mono text-[9px] font-bold text-slate-400">
                                                                {items.findIndex((i) => i.id === selectedItem.id) + 1}/
                                                                {items.length}
                                                            </span>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => {
                                                                    const idx = items.findIndex(
                                                                        (i) => i.id === selectedItem.id
                                                                    );
                                                                    if (idx < items.length - 1) {
                                                                        setSelectedItem(items[idx + 1]);
                                                                    }
                                                                }}
                                                                disabled={
                                                                    items.findIndex((i) => i.id === selectedItem.id) ===
                                                                    items.length - 1
                                                                }
                                                                className="h-6 w-6 p-0 text-slate-400 hover:bg-white dark:hover:bg-slate-700"
                                                            >
                                                                <ChevronRight className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    {isEditing ? (
                                                        <div className="flex items-center gap-2 duration-300 animate-in fade-in slide-in-from-right-4">
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => setIsEditing(false)}
                                                                disabled={isSaving}
                                                                className="h-8 rounded-lg border-slate-200 bg-white px-4 text-[10px] font-bold uppercase tracking-widest text-slate-400 transition-all hover:bg-slate-50 dark:bg-slate-900"
                                                            >
                                                                Cancelar
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                onClick={() => {
                                                                    const btn =
                                                                        document.getElementById("trigger-save-item");
                                                                    if (btn) btn.click();
                                                                }}
                                                                className="h-8 rounded-lg border-none bg-brand px-4 text-[10px] font-bold uppercase tracking-widest text-white shadow-lg shadow-red-500/10 transition-all hover:scale-[1.02] hover:bg-brand-hover"
                                                            >
                                                                {isSaving ? (
                                                                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                                                ) : (
                                                                    <Check className="mr-1.5 h-3.5 w-3.5" />
                                                                )}
                                                                {isSaving ? "Guardando..." : "Guardar"}
                                                            </Button>
                                                        </div>
                                                    ) : (
                                                        config.items?.allowEdit && (
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => setIsEditing(true)}
                                                                className="h-8 rounded-lg border-red-100 bg-white px-4 text-[10px] font-bold uppercase tracking-widest text-red-600 transition-all hover:bg-red-50 dark:bg-slate-950"
                                                            >
                                                                EDITAR
                                                            </Button>
                                                        )
                                                    )}

                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={onClose}
                                                        className="ml-1 h-9 w-9 text-slate-400 hover:text-slate-600"
                                                    >
                                                        <X className="h-5 w-5" />
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
                                                        if (onProjectUpdated) onProjectUpdated();
                                                    }}
                                                    hiddenFields={config.items?.hiddenFields}
                                                    readOnlyFields={config.items?.readOnlyFields}
                                                    onViewDrawing={(url: string, title: string) => {
                                                        logger.debug("Setting side drawing:", { url, title });
                                                        setSideDrawing({ url, title });
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
