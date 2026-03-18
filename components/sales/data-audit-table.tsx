"use client";

import { useState } from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
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
    Pencil
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface ProductionOrder {
    id: string;
    part_code: string;
    part_name: string;
    quantity: number;
    genral_status: string;
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
    onSelectProject: (project: any) => void;
}

export function DataAuditTable({ projects, onSelectProject }: DataAuditTableProps) {
    const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

    const toggleRow = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const getGravityColor = (score: number) => {
        if (score < 40) return "text-red-500 bg-red-500/10";
        if (score < 80) return "text-orange-500 bg-orange-500/10";
        return "text-emerald-500 bg-emerald-500/10";
    };

    const isMissing = (val: any) => !val || val === "POR DEFINIR";

    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <Table>
                <TableHeader>
                    <TableRow className="hover:bg-transparent border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                        <TableHead className="w-[40px]"></TableHead>
                        <TableHead className="w-[120px] text-[10px] font-bold uppercase tracking-widest text-slate-400 py-4">Código</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-400 py-4">Proyecto / Integridad</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-400 py-4 text-center">Faltantes Críticos</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-400 py-4 text-right pr-6">Acción</TableHead>
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

function ProjectRow({ project, isExpanded, onToggle, onSelect }: {
    project: Project,
    isExpanded: boolean,
    onToggle: (e: React.MouseEvent) => void,
    onSelect: () => void
}) {
    const isMissing = (val: any) => !val || val === "" || val === "POR DEFINIR";

    // Critical fields check
    const missingFields = [
        isMissing(project.name) && "Nombre",
        isMissing(project.company) && "Cliente",
        isMissing(project.delivery_date) && "Fecha"
    ].filter(Boolean);

    const unlinkedFields = [
        (!isMissing(project.company) && !project.company_id) && "Cliente",
        (!isMissing(project.requestor) && !project.requestor_id) && "Solicitante"
    ].filter(Boolean);

    const scoreColor = project.integrityScore < 50 ? "bg-red-500" : project.integrityScore < 90 ? "bg-orange-500" : "bg-emerald-500";

    return (
        <>
            <TableRow
                className={cn(
                    "group cursor-pointer transition-colors border-slate-100 dark:border-slate-800/50",
                    isExpanded ? "bg-slate-50/50 dark:bg-slate-800/20" : "hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                )}
                onClick={onSelect}
            >
                <TableCell className="pl-4" onClick={onToggle}>
                    {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                </TableCell>
                <TableCell>
                    <Badge variant="outline" className="font-mono font-bold text-[#EC1C21] border-[#EC1C21]/20 bg-[#EC1C21]/5">
                        {project.code}
                    </Badge>
                </TableCell>
                <TableCell>
                    <div className="flex flex-col gap-2 py-2">
                        <div className="flex items-center gap-2">
                            <span className={cn(
                                "font-bold text-sm uppercase",
                                isMissing(project.name) ? "text-red-500/50 italic" : "text-slate-900 dark:text-white"
                            )}>
                                {project.name || "Proyecto sin nombre"}
                            </span>
                            {project.integrityScore === 100 && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                        </div>
                        <div className="flex items-center gap-4 w-full max-w-md">
                            <div className="flex-1">
                                <Progress value={project.integrityScore} className="h-1.5" indicatorClassName={scoreColor} />
                            </div>
                            <span className="text-[10px] font-black text-slate-400">{Math.round(project.integrityScore)}%</span>
                        </div>
                    </div>
                </TableCell>
                <TableCell className="text-center">
                    <div className="flex flex-col items-center gap-1">
                        {missingFields.length > 0 && (
                            <div className="flex flex-wrap justify-center gap-1">
                                {missingFields.map(f => (
                                    <Badge key={f as string} className="bg-red-500/10 text-red-600 border-none text-[8px] uppercase font-black px-1.5 py-0">
                                        Falta {f}
                                    </Badge>
                                ))}
                            </div>
                        )}
                        {unlinkedFields.length > 0 && (
                            <div className="flex flex-wrap justify-center gap-1">
                                {unlinkedFields.map(f => (
                                    <Badge key={f as string} className="bg-orange-500/10 text-orange-600 border-none text-[8px] uppercase font-black px-1.5 py-0 flex items-center gap-1">
                                        <AlertCircle className="w-2 h-2" />
                                        {f} Sin Vincular
                                    </Badge>
                                ))}
                            </div>
                        )}
                        {missingFields.length === 0 && unlinkedFields.length === 0 && (
                            <Badge className="bg-emerald-500/10 text-emerald-600 border-none text-[8px] uppercase font-black px-1.5 py-0">
                                Ok
                            </Badge>
                        )}
                    </div>
                </TableCell>
                <TableCell className="text-right pr-6">
                    <button className="p-2 hover:bg-orange-500/10 hover:text-orange-600 rounded-lg transition-colors text-slate-400">
                        <Pencil className="w-4 h-4" />
                    </button>
                </TableCell>
            </TableRow>

            <AnimatePresence>
                {isExpanded && (
                    <TableRow className="hover:bg-transparent bg-slate-50/30 dark:bg-slate-900/40 border-none">
                        <TableCell colSpan={5} className="p-0">
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden bg-slate-50/50 dark:bg-slate-950/20 px-12 py-4"
                            >
                                <div className="space-y-4">
                                    {/* Project Header Secondary Info */}
                                    <div className="grid grid-cols-4 gap-4 pb-4 border-b border-slate-200/50 dark:border-slate-800/50">
                                        <div className="space-y-1">
                                            <span className="text-[9px] uppercase font-black text-slate-400 tracking-wider">Cliente</span>
                                            <div className={cn("text-xs font-bold flex items-center gap-1.5", isMissing(project.company) ? "text-red-500" : "text-slate-600")}>
                                                <Building2 className="w-3 h-3 opacity-50" />
                                                {project.company || "FALTANTE"}
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[9px] uppercase font-black text-slate-400 tracking-wider">Solicitante</span>
                                            <div className={cn("text-xs font-bold flex items-center gap-1.5", isMissing(project.requestor) ? "text-slate-400" : "text-slate-600")}>
                                                <User2 className="w-3 h-3 opacity-50" />
                                                {project.requestor || "NO REGISTRADO"}
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[9px] uppercase font-black text-slate-400 tracking-wider">Entrega</span>
                                            <div className={cn("text-xs font-bold flex items-center gap-1.5", isMissing(project.delivery_date) ? "text-red-500" : "text-slate-600")}>
                                                <Calendar className="w-3 h-3 opacity-50" />
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
                                        <span className="text-[9px] uppercase font-black text-slate-500 tracking-widest pl-1">Auditoría de Partidas</span>
                                        <div className="rounded-xl border border-slate-200/60 dark:border-slate-800/60 overflow-hidden bg-white/50 dark:bg-slate-900/50 shadow-sm">
                                            <Table>
                                                <TableHeader className="bg-slate-100/30 dark:bg-slate-800/30">
                                                    <TableRow className="hover:bg-transparent border-slate-200/60 dark:border-slate-800/60">
                                                        <TableHead className="py-2 h-auto text-[8px] font-black uppercase">Código</TableHead>
                                                        <TableHead className="py-2 h-auto text-[8px] font-black uppercase">Nombre de Partida</TableHead>
                                                        <TableHead className="py-2 h-auto text-[8px] font-black uppercase">Cant.</TableHead>
                                                        <TableHead className="py-2 h-auto text-[8px] font-black uppercase">Material</TableHead>
                                                        <TableHead className="py-2 h-auto text-[8px] font-black uppercase">Tratamiento</TableHead>
                                                        <TableHead className="py-2 h-auto text-[8px] font-black uppercase text-right">Estatus</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {project.production_orders.map(item => (
                                                        <TableRow key={item.id} className="hover:bg-slate-100/20 dark:hover:bg-slate-800/20 border-slate-100/50 dark:border-slate-800/50">
                                                            <TableCell className="py-2 py-0 text-[11px] font-mono font-bold text-slate-500">{item.part_code}</TableCell>
                                                            <TableCell className="py-2">
                                                                <span className={cn(
                                                                    "text-[11px] font-bold",
                                                                    isMissing(item.part_name) ? "text-orange-500/50 italic" : "text-slate-700 dark:text-slate-300 uppercase"
                                                                )}>
                                                                    {item.part_name || "Nombre pendiente"}
                                                                </span>
                                                            </TableCell>
                                                            <TableCell className="py-2">
                                                                <span className={cn(
                                                                    "text-[11px] font-black",
                                                                    !item.quantity ? "text-orange-600" : "text-slate-600"
                                                                )}>
                                                                    {item.quantity || "0"}
                                                                </span>
                                                            </TableCell>
                                                            <TableCell className="py-2">
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className={cn(
                                                                        "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                                                                        isMissing(item.material)
                                                                            ? "bg-orange-500/5 text-orange-600 border-orange-500/20"
                                                                            : "bg-slate-100 dark:bg-slate-800 text-slate-500 border-transparent"
                                                                    )}>
                                                                        {item.material || "POR DEFINIR"}
                                                                    </span>
                                                                    {!isMissing(item.material) && !item.material_id && (
                                                                        <Badge className="bg-orange-500/10 text-orange-600 border-none text-[7px] uppercase font-black px-1 py-0">
                                                                            Sin Vincular
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="py-2">
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className={cn(
                                                                        "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                                                                        isMissing(item.treatment) || item.treatment === "SIN TRATAMIENTO" 
                                                                            ? "bg-slate-50 dark:bg-slate-800 text-slate-400 border-transparent italic" 
                                                                            : "bg-slate-100 dark:bg-slate-800 text-slate-500 border-transparent"
                                                                    )}>
                                                                        {item.treatment || "SIN TRATAMIENTO"}
                                                                    </span>
                                                                    {!isMissing(item.treatment) && item.treatment !== "SIN TRATAMIENTO" && !item.treatment_id && (
                                                                        <Badge className="bg-orange-500/10 text-orange-600 border-none text-[7px] uppercase font-black px-1 py-0">
                                                                            Sin Vincular
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="py-2 text-right">
                                                                {isMissing(item.part_name) || !item.quantity || isMissing(item.material) || (!isMissing(item.material) && !item.material_id) || (!isMissing(item.treatment) && item.treatment !== "SIN TRATAMIENTO" && !item.treatment_id) ? (
                                                                    <AlertCircle className="w-3.5 h-3.5 text-orange-500 ml-auto" />
                                                                ) : (
                                                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 ml-auto" />
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
