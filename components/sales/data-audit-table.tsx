"use client";

import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
    ChevronDown,
    ChevronRight,
    AlertCircle,
    CheckCircle2,
    Package,
    Building2,
    User2,
    Calendar,
    FileText,
    Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface ProductionOrder {
    id: string;
    part_code: string;
    part_name: string;
    quantity: number;
    general_status: string;
    material: string;
    material_id?: string | null;
    treatment?: string | null;
    treatment_id?: string | null;
    unit: string;
    design_no: string;
}

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
    production_orders: ProductionOrder[];
    integrityScore: number;
}

interface DataAuditTableProps {
    projects: Project[];
    onSelectProject: (project: Project) => void;
}

export function DataAuditTable({ projects, onSelectProject }: DataAuditTableProps) {
    const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

    const toggleRow = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));
    };

    const getGravityColor = (score: number) => {
        if (score < 40) return "text-red-500 bg-red-500/10";
        if (score < 80) return "text-orange-500 bg-orange-500/10";
        return "text-emerald-500 bg-emerald-500/10";
    };

    const isMissing = (val: unknown) => !val || val === "POR DEFINIR";

    return (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <Table>
                <TableHeader>
                    <TableRow className="border-slate-200 bg-slate-50/50 hover:bg-transparent dark:border-slate-800 dark:bg-slate-800/30">
                        <TableHead className="w-[40px]"></TableHead>
                        <TableHead className="w-[120px] py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                            Código
                        </TableHead>
                        <TableHead className="py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                            Proyecto / Integridad
                        </TableHead>
                        <TableHead className="py-4 text-center text-[10px] font-bold uppercase tracking-widest text-slate-400">
                            Faltantes Críticos
                        </TableHead>
                        <TableHead className="py-4 pr-6 text-right text-[10px] font-bold uppercase tracking-widest text-slate-400">
                            Acción
                        </TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {projects.map((project) => (
                        <ProjectRow
                            key={project.id}
                            project={project}
                            isExpanded={!!expandedRows[project.id]}
                            onToggle={(e) => toggleRow(project.id, e)}
                            onSelect={() => onSelectProject(project)}
                        />
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}

function ProjectRow({
    project,
    isExpanded,
    onToggle,
    onSelect,
}: {
    project: Project;
    isExpanded: boolean;
    onToggle: (e: React.MouseEvent) => void;
    onSelect: () => void;
}) {
    const isMissing = (val: unknown) => !val || val === "" || val === "POR DEFINIR";

    // Critical fields check
    const missingFields = [
        isMissing(project.name) && "Nombre",
        isMissing(project.company) && "Cliente",
        isMissing(project.delivery_date) && "Fecha",
    ].filter(Boolean);

    const unlinkedFields = [
        !isMissing(project.company) && !project.company_id && "Cliente",
        !isMissing(project.requestor) && !project.requestor_id && "Solicitante",
    ].filter(Boolean);

    const scoreColor =
        project.integrityScore < 50 ? "bg-red-500" : project.integrityScore < 90 ? "bg-orange-500" : "bg-emerald-500";

    return (
        <>
            <TableRow
                className={cn(
                    "group cursor-pointer border-slate-100 transition-colors dark:border-slate-800/50",
                    isExpanded
                        ? "bg-slate-50/50 dark:bg-slate-800/20"
                        : "hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                )}
                onClick={onSelect}
            >
                <TableCell className="pl-4" onClick={onToggle}>
                    {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-slate-400" />
                    ) : (
                        <ChevronRight className="h-4 w-4 text-slate-400" />
                    )}
                </TableCell>
                <TableCell>
                    <Badge variant="outline" className="border-brand/20 bg-brand/5 font-mono font-bold text-brand">
                        {project.code}
                    </Badge>
                </TableCell>
                <TableCell>
                    <div className="flex flex-col gap-2 py-2">
                        <div className="flex items-center gap-2">
                            <span
                                className={cn(
                                    "text-sm font-bold uppercase",
                                    isMissing(project.name)
                                        ? "italic text-red-500/50"
                                        : "text-slate-900 dark:text-white"
                                )}
                            >
                                {project.name || "Proyecto sin nombre"}
                            </span>
                            {project.integrityScore === 100 && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                        </div>
                        <div className="flex w-full max-w-md items-center gap-4">
                            <div className="flex-1">
                                <Progress
                                    value={project.integrityScore}
                                    className="h-1.5"
                                    indicatorClassName={scoreColor}
                                />
                            </div>
                            <span className="text-[10px] font-black text-slate-400">
                                {Math.round(project.integrityScore)}%
                            </span>
                        </div>
                    </div>
                </TableCell>
                <TableCell className="text-center">
                    <div className="flex flex-col items-center gap-1">
                        {missingFields.length > 0 && (
                            <div className="flex flex-wrap justify-center gap-1">
                                {missingFields.map((f) => (
                                    <Badge
                                        key={f as string}
                                        className="border-none bg-red-500/10 px-1.5 py-0 text-[8px] font-black uppercase text-red-600"
                                    >
                                        Falta {f}
                                    </Badge>
                                ))}
                            </div>
                        )}
                        {unlinkedFields.length > 0 && (
                            <div className="flex flex-wrap justify-center gap-1">
                                {unlinkedFields.map((f) => (
                                    <Badge
                                        key={f as string}
                                        className="flex items-center gap-1 border-none bg-orange-500/10 px-1.5 py-0 text-[8px] font-black uppercase text-orange-600"
                                    >
                                        <AlertCircle className="h-2 w-2" />
                                        {f} Sin Vincular
                                    </Badge>
                                ))}
                            </div>
                        )}
                        {missingFields.length === 0 && unlinkedFields.length === 0 && (
                            <Badge className="border-none bg-emerald-500/10 px-1.5 py-0 text-[8px] font-black uppercase text-emerald-600">
                                Ok
                            </Badge>
                        )}
                    </div>
                </TableCell>
                <TableCell className="pr-6 text-right">
                    <button className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-orange-500/10 hover:text-orange-600">
                        <Pencil className="h-4 w-4" />
                    </button>
                </TableCell>
            </TableRow>

            <AnimatePresence>
                {isExpanded && (
                    <TableRow className="border-none bg-slate-50/30 hover:bg-transparent dark:bg-slate-900/40">
                        <TableCell colSpan={5} className="p-0">
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden bg-slate-50/50 px-12 py-4 dark:bg-slate-950/20"
                            >
                                <div className="space-y-4">
                                    {/* Project Header Secondary Info */}
                                    <div className="grid grid-cols-4 gap-4 border-b border-slate-200/50 pb-4 dark:border-slate-800/50">
                                        <div className="space-y-1">
                                            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                                                Cliente
                                            </span>
                                            <div
                                                className={cn(
                                                    "flex items-center gap-1.5 text-xs font-bold",
                                                    isMissing(project.company) ? "text-red-500" : "text-slate-600"
                                                )}
                                            >
                                                <Building2 className="h-3 w-3 opacity-50" />
                                                {project.company || "FALTANTE"}
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                                                Solicitante
                                            </span>
                                            <div
                                                className={cn(
                                                    "flex items-center gap-1.5 text-xs font-bold",
                                                    isMissing(project.requestor) ? "text-slate-400" : "text-slate-600"
                                                )}
                                            >
                                                <User2 className="h-3 w-3 opacity-50" />
                                                {project.requestor || "NO REGISTRADO"}
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                                                Entrega
                                            </span>
                                            <div
                                                className={cn(
                                                    "flex items-center gap-1.5 text-xs font-bold",
                                                    isMissing(project.delivery_date) ? "text-red-500" : "text-slate-600"
                                                )}
                                            >
                                                <Calendar className="h-3 w-3 opacity-50" />
                                                {project.delivery_date || "S/F"}
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-end">
                                            <Badge variant="secondary" className="text-[9px] font-black uppercase">
                                                {project.production_orders.length} Partidas
                                            </Badge>
                                        </div>
                                    </div>

                                    {/* Items Table */}
                                    <div className="space-y-2">
                                        <span className="pl-1 text-[9px] font-black uppercase tracking-widest text-slate-500">
                                            Auditoría de Partidas
                                        </span>
                                        <div className="overflow-hidden rounded-xl border border-slate-200/60 bg-white/50 shadow-sm dark:border-slate-800/60 dark:bg-slate-900/50">
                                            <Table>
                                                <TableHeader className="bg-slate-100/30 dark:bg-slate-800/30">
                                                    <TableRow className="border-slate-200/60 hover:bg-transparent dark:border-slate-800/60">
                                                        <TableHead className="h-auto py-2 text-[8px] font-black uppercase">
                                                            Código
                                                        </TableHead>
                                                        <TableHead className="h-auto py-2 text-[8px] font-black uppercase">
                                                            Nombre de Partida
                                                        </TableHead>
                                                        <TableHead className="h-auto py-2 text-[8px] font-black uppercase">
                                                            Cant.
                                                        </TableHead>
                                                        <TableHead className="h-auto py-2 text-[8px] font-black uppercase">
                                                            Material
                                                        </TableHead>
                                                        <TableHead className="h-auto py-2 text-[8px] font-black uppercase">
                                                            Tratamiento
                                                        </TableHead>
                                                        <TableHead className="h-auto py-2 text-right text-[8px] font-black uppercase">
                                                            Estatus
                                                        </TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {project.production_orders.map((item) => (
                                                        <TableRow
                                                            key={item.id}
                                                            className="border-slate-100/50 hover:bg-slate-100/20 dark:border-slate-800/50 dark:hover:bg-slate-800/20"
                                                        >
                                                            <TableCell className="py-0 py-2 font-mono text-[11px] font-bold text-slate-500">
                                                                {item.part_code}
                                                            </TableCell>
                                                            <TableCell className="py-2">
                                                                <span
                                                                    className={cn(
                                                                        "text-[11px] font-bold",
                                                                        isMissing(item.part_name)
                                                                            ? "italic text-orange-500/50"
                                                                            : "uppercase text-slate-700 dark:text-slate-300"
                                                                    )}
                                                                >
                                                                    {item.part_name || "Nombre pendiente"}
                                                                </span>
                                                            </TableCell>
                                                            <TableCell className="py-2">
                                                                <span
                                                                    className={cn(
                                                                        "text-[11px] font-black",
                                                                        !item.quantity
                                                                            ? "text-orange-600"
                                                                            : "text-slate-600"
                                                                    )}
                                                                >
                                                                    {item.quantity || "0"}
                                                                </span>
                                                            </TableCell>
                                                            <TableCell className="py-2">
                                                                <div className="flex items-center gap-1.5">
                                                                    <span
                                                                        className={cn(
                                                                            "rounded-full border px-2 py-0.5 text-[10px] font-bold",
                                                                            isMissing(item.material)
                                                                                ? "border-orange-500/20 bg-orange-500/5 text-orange-600"
                                                                                : "border-transparent bg-slate-100 text-slate-500 dark:bg-slate-800"
                                                                        )}
                                                                    >
                                                                        {item.material || "POR DEFINIR"}
                                                                    </span>
                                                                    {!isMissing(item.material) && !item.material_id && (
                                                                        <Badge className="border-none bg-orange-500/10 px-1 py-0 text-[7px] font-black uppercase text-orange-600">
                                                                            Sin Vincular
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="py-2">
                                                                <div className="flex items-center gap-1.5">
                                                                    <span
                                                                        className={cn(
                                                                            "rounded-full border px-2 py-0.5 text-[10px] font-bold",
                                                                            isMissing(item.treatment) ||
                                                                                item.treatment === "SIN TRATAMIENTO"
                                                                                ? "border-transparent bg-slate-50 italic text-slate-400 dark:bg-slate-800"
                                                                                : "border-transparent bg-slate-100 text-slate-500 dark:bg-slate-800"
                                                                        )}
                                                                    >
                                                                        {item.treatment || "SIN TRATAMIENTO"}
                                                                    </span>
                                                                    {!isMissing(item.treatment) &&
                                                                        item.treatment !== "SIN TRATAMIENTO" &&
                                                                        !item.treatment_id && (
                                                                            <Badge className="border-none bg-orange-500/10 px-1 py-0 text-[7px] font-black uppercase text-orange-600">
                                                                                Sin Vincular
                                                                            </Badge>
                                                                        )}
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="py-2 text-right">
                                                                {isMissing(item.part_name) ||
                                                                !item.quantity ||
                                                                isMissing(item.material) ||
                                                                (!isMissing(item.material) && !item.material_id) ||
                                                                (!isMissing(item.treatment) &&
                                                                    item.treatment !== "SIN TRATAMIENTO" &&
                                                                    !item.treatment_id) ? (
                                                                    <AlertCircle className="ml-auto h-3.5 w-3.5 text-orange-500" />
                                                                ) : (
                                                                    <CheckCircle2 className="ml-auto h-3.5 w-3.5 text-emerald-500" />
                                                                )}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        </TableCell>
                    </TableRow>
                )}
            </AnimatePresence>
        </>
    );
}
