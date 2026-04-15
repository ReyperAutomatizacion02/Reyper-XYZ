"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { parseLocalDate } from "@/lib/date-utils";
import { Calendar, Building2, User2, Package, AlertCircle, ArrowUpWideNarrow, ArrowDownWideNarrow } from "lucide-react";
import { cn } from "@/lib/utils";

interface Project {
    id: string;
    code: string | null;
    name: string | null;
    company: string | null;
    requestor: string | null;
    start_date: string | null;
    delivery_date: string | null;
    status: string | null;
    parts_count?: number;
}

type ProjectSortField = "code" | "name" | "delivery_date" | "progress" | "parts_count";

interface ProjectsTableProps {
    projects: Project[];
    onSelectProject: (project: Project) => void;
    selectedProjectId?: string;
    sortBy: string;
    sortOrder: "asc" | "desc" | "none";
    onSort: (field: ProjectSortField) => void;
    /**
     * Optional configuration to hide/show columns based on area
     */
    visibilityConfig?: {
        code?: boolean;
        name?: boolean;
        delivery_date?: boolean;
        progress?: boolean;
        parts_count?: boolean;
        requestor?: boolean;
        company?: boolean;
    };
}

export function ProjectsTable({
    projects,
    onSelectProject,
    selectedProjectId,
    sortBy,
    sortOrder,
    onSort,
    visibilityConfig = {
        code: true,
        name: true,
        delivery_date: true,
        progress: true,
        parts_count: true,
        requestor: true,
        company: true,
    },
}: ProjectsTableProps) {
    const getProjectStatus = (start: string | null, end: string | null) => {
        const startDate = parseLocalDate(start)?.getTime() || 0;
        const endDate = parseLocalDate(end)?.getTime() || 0;
        const today = new Date().setHours(0, 0, 0, 0);

        const totalDuration = endDate - startDate;
        const elapsed = today - startDate;
        const progress = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));

        const daysRemaining = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
        return { progress, daysRemaining };
    };

    const SortIndicator = ({ field }: { field: string }) => {
        if (sortBy !== field)
            return <ArrowUpWideNarrow className="ml-1 h-3 w-3 opacity-0 transition-opacity group-hover:opacity-30" />;
        return sortOrder === "asc" ? (
            <ArrowUpWideNarrow className="ml-1 h-3 w-3 text-orange-600" />
        ) : (
            <ArrowDownWideNarrow className="ml-1 h-3 w-3 text-orange-600" />
        );
    };

    return (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <Table>
                <TableHeader>
                    <TableRow className="border-slate-200 bg-slate-50/50 hover:bg-transparent dark:border-slate-800 dark:bg-slate-800/30">
                        {visibilityConfig.code && (
                            <TableHead
                                className="group w-[120px] cursor-pointer py-4 pl-6 text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-600"
                                onClick={() => onSort("code")}
                            >
                                <div className="flex items-center">
                                    Código <SortIndicator field="code" />
                                </div>
                            </TableHead>
                        )}
                        {visibilityConfig.name && (
                            <TableHead
                                className="group cursor-pointer py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-600"
                                onClick={() => onSort("name")}
                            >
                                <div className="flex items-center">
                                    Proyecto / Cliente <SortIndicator field="name" />
                                </div>
                            </TableHead>
                        )}
                        {visibilityConfig.delivery_date && (
                            <TableHead
                                className="group cursor-pointer py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-600"
                                onClick={() => onSort("delivery_date")}
                            >
                                <div className="flex items-center">
                                    Entrega <SortIndicator field="delivery_date" />
                                </div>
                            </TableHead>
                        )}
                        {visibilityConfig.progress && (
                            <TableHead
                                className="group cursor-pointer py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-600"
                                onClick={() => onSort("progress")}
                            >
                                <div className="flex items-center">
                                    Progreso <SortIndicator field="progress" />
                                </div>
                            </TableHead>
                        )}
                        {visibilityConfig.parts_count && (
                            <TableHead
                                className="group cursor-pointer py-4 pr-6 text-right text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-600"
                                onClick={() => onSort("parts_count")}
                            >
                                <div className="flex items-center justify-end">
                                    Partidas <SortIndicator field="parts_count" />
                                </div>
                            </TableHead>
                        )}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {projects.map((project) => {
                        const { progress, daysRemaining } = getProjectStatus(project.start_date, project.delivery_date);
                        const isSelected = selectedProjectId === project.id;
                        const isLate = daysRemaining < 0;

                        return (
                            <TableRow
                                key={project.id}
                                className={cn(
                                    "group cursor-pointer border-slate-100 transition-colors hover:bg-slate-50/80 dark:border-slate-800/50 dark:hover:bg-slate-800/40",
                                    isSelected &&
                                        "border-orange-100 bg-orange-50/50 dark:border-orange-900/20 dark:bg-orange-900/10"
                                )}
                                onClick={() => onSelectProject(project)}
                            >
                                {visibilityConfig.code && (
                                    <TableCell className="py-4 pl-6">
                                        <Badge
                                            variant="outline"
                                            className={cn(
                                                "border-none bg-slate-100/50 px-2 py-0.5 font-mono font-bold tracking-wider text-slate-600 dark:bg-slate-800/50 dark:text-slate-400",
                                                isSelected && "bg-orange-100 text-orange-600 dark:bg-orange-900/30"
                                            )}
                                        >
                                            {project.code}
                                        </Badge>
                                    </TableCell>
                                )}
                                {visibilityConfig.name && (
                                    <TableCell className="py-4">
                                        <div className="flex flex-col gap-0.5">
                                            <span className="line-clamp-1 text-[13px] font-bold uppercase text-slate-900 transition-colors group-hover:text-orange-600 dark:text-white">
                                                {project.name}
                                            </span>
                                            <div className="flex items-center gap-2 text-[10px] font-medium text-slate-400">
                                                {visibilityConfig.company && (
                                                    <span className="flex items-center gap-1">
                                                        <Building2 className="h-3 w-3 opacity-50" />
                                                        {project.company}
                                                    </span>
                                                )}
                                                {visibilityConfig.company && visibilityConfig.requestor && (
                                                    <span className="h-1 w-1 rounded-full bg-slate-200 dark:bg-slate-700" />
                                                )}
                                                {visibilityConfig.requestor && (
                                                    <span className="flex items-center gap-1">
                                                        <User2 className="h-3 w-3 opacity-50" />
                                                        {project.requestor}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </TableCell>
                                )}
                                {visibilityConfig.delivery_date && (
                                    <TableCell className="py-4">
                                        <div className="flex flex-col gap-0.5">
                                            <div
                                                className={cn(
                                                    "flex items-center gap-1.5 text-[11px] font-bold",
                                                    isLate
                                                        ? "text-red-600"
                                                        : daysRemaining <= 7
                                                          ? "text-orange-500"
                                                          : "text-slate-600 dark:text-slate-400"
                                                )}
                                            >
                                                <Calendar className="h-3.5 w-3.5" />
                                                {parseLocalDate(project.delivery_date)?.toLocaleDateString("es-MX", {
                                                    day: "2-digit",
                                                    month: "short",
                                                })}
                                            </div>
                                            {isLate && (
                                                <span className="flex items-center gap-1 text-[9px] font-bold uppercase text-red-500">
                                                    <AlertCircle className="h-2.5 w-2.5" />
                                                    Retrasado
                                                </span>
                                            )}
                                        </div>
                                    </TableCell>
                                )}
                                {visibilityConfig.progress && (
                                    <TableCell className="py-4">
                                        <div className="flex w-full max-w-[120px] flex-col gap-1.5">
                                            <div className="flex items-center justify-between text-[10px] font-bold">
                                                <span className="uppercase tracking-widest text-slate-400">
                                                    {Math.round(progress)}%
                                                </span>
                                            </div>
                                            <Progress
                                                value={progress}
                                                className="h-1.5 bg-slate-100 dark:bg-slate-800"
                                                indicatorClassName={cn(
                                                    "transition-all",
                                                    daysRemaining < 0
                                                        ? "bg-red-600"
                                                        : daysRemaining <= 7
                                                          ? "bg-[#EC1C21]"
                                                          : "bg-orange-500"
                                                )}
                                            />
                                        </div>
                                    </TableCell>
                                )}
                                {visibilityConfig.parts_count && (
                                    <TableCell className="py-4 pr-6 text-right">
                                        <Badge
                                            variant="secondary"
                                            className="border-none bg-blue-50 px-2.5 py-1 text-[10px] font-bold uppercase text-blue-600 shadow-none dark:bg-blue-900/10 dark:text-blue-400"
                                            style={{ backgroundColor: "#EFF6FF", color: "#2563EB" }}
                                        >
                                            <Package className="mr-1.5 h-3 w-3 opacity-70" />
                                            {project.parts_count || 0}{" "}
                                            {project.parts_count === 1 ? "partida" : "partidas"}
                                        </Badge>
                                    </TableCell>
                                )}
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </div>
    );
}
