"use client";

import { useEffect, useState } from "react";
import { DashboardHeader } from "@/components/dashboard-header";
import { FolderKanban, Search, Calendar, User2, Building2, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { getActiveProjects, getFilterOptions } from "../actions";
import { toast } from "sonner";
import Link from "next/link";
import { ProjectDetailsPanel } from "./components/project-details-panel";
import { ProjectsFilter } from "./components/projects-filter";
import { useProjectFilters } from "./hooks/use-project-filters";

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

export default function ActiveProjectsPage() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const [filterOptions, setFilterOptions] = useState<{ clients: string[], requestors: string[] }>({ clients: [], requestors: [] });

    // Custom hook for filters
    const { filters, updateFilter, resetFilters, activeFilterCount } = useProjectFilters();

    useEffect(() => {
        const init = async () => {
            try {
                const [projectsData, optionsData] = await Promise.all([
                    getActiveProjects(),
                    getFilterOptions()
                ]);
                setProjects(projectsData as any);
                setFilterOptions(optionsData as any);
            } catch (error: any) {
                toast.error("Error al cargar datos: " + error.message);
            } finally {
                setLoading(false);
            }
        };
        init();
    }, []);

    // Function to calculate progress and date status
    const getProjectStatus = (start: string, end: string) => {
        const startDate = new Date(start).getTime();
        const endDate = new Date(end).getTime();
        const today = new Date().getTime();

        const totalDuration = endDate - startDate;
        const elapsed = today - startDate;

        // Progress percentage (0-100)
        const progress = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));

        // Urgency color based on days remaining
        const daysRemaining = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
        let dateColor = "text-green-600";
        if (daysRemaining < 0) dateColor = "text-red-700 font-bold"; // Overdue
        else if (daysRemaining <= 7) dateColor = "text-red-500 font-bold"; // Urgent
        else if (daysRemaining <= 15) dateColor = "text-yellow-600"; // Warning

        return { progress, dateColor, daysRemaining };
    };

    // Filter Logic
    const filteredProjects = projects.filter(p => {
        // 1. Text Search (Code, Name, Company)
        const matchesSearch = (p.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
            (p.code || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
            (p.company || "").toLowerCase().includes(searchTerm.toLowerCase());

        if (!matchesSearch) return false;

        // 2. Advanced Filters

        // Client Filter
        if (filters.clients.length > 0 && !filters.clients.includes(p.company)) return false;

        // Requestor Filter
        if (filters.requestors.length > 0 && !filters.requestors.includes(p.requestor)) return false;

        // Status Filter
        if (filters.status.length > 0) {
            const { daysRemaining } = getProjectStatus(p.start_date, p.delivery_date);
            const isLate = daysRemaining < 0;
            const isOntime = daysRemaining >= 0;

            const showingLate = filters.status.includes('retrasado');
            const showingOntime = filters.status.includes('a_tiempo');

            if (showingLate && !showingOntime && !isLate) return false;
            if (showingOntime && !showingLate && !isOntime) return false;
        }

        // Date Range Filter
        if (filters.dateRange?.from || filters.dateRange?.to) {
            const deliveryDate = new Date(p.delivery_date).getTime();
            if (filters.dateRange.from && deliveryDate < filters.dateRange.from.getTime()) return false;
            // Add 1 day to 'to' date to make it inclusive (end of day)
            if (filters.dateRange.to) {
                const endDate = new Date(filters.dateRange.to);
                endDate.setHours(23, 59, 59, 999);
                if (deliveryDate > endDate.getTime()) return false;
            }
        }

        return true;
    });



    if (loading) return <div className="p-8 text-center text-muted-foreground animate-pulse">Cargando proyectos activos...</div>;

    return (
        <div className={`space-y-6 max-w-7xl mx-auto pb-20 transition-all duration-300 ${selectedProject ? "mr-12 xl:mr-[28rem]" : ""}`}>
            <DashboardHeader
                title="Proyectos Activos"
                description="Monitoreo de proyectos en curso y tiempos de entrega"
                icon={<FolderKanban className="w-8 h-8 text-orange-500" />}
                backUrl="/dashboard/ventas"
                iconClassName="bg-orange-500/10 text-orange-500"
            />

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por Código, Nombre o Cliente..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 bg-background/50 border-border focus:border-orange-500 transition-all shadow-sm"
                    />
                </div>
                <ProjectsFilter
                    filters={filters}
                    options={filterOptions}
                    onUpdate={updateFilter}
                    onReset={resetFilters}
                    activeCount={activeFilterCount}
                />
            </div>

            {/* Projects Grid */}
            {filteredProjects.length === 0 ? (
                <div className="text-center py-20 bg-muted/20 rounded-xl border border-dashed border-border">
                    <FolderKanban className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                    <p className="text-muted-foreground font-medium">No se encontraron proyectos activos.</p>
                </div>
            ) : (
                <div className={`grid gap-6 md:grid-cols-2 ${selectedProject ? "lg:grid-cols-2" : "lg:grid-cols-3"} transition-all duration-300`}>
                    {filteredProjects.map((project) => {
                        const { progress, dateColor, daysRemaining } = getProjectStatus(project.start_date, project.delivery_date);

                        return (
                            <Card key={project.id} className="group hover:shadow-lg transition-all duration-300 border-border bg-card/50 backdrop-blur-sm overflow-hidden">
                                <CardHeader className="pb-3 relative">
                                    <div className="flex justify-between items-start mb-2">
                                        <Badge variant="outline" className="bg-red-500/5 text-red-600 border-red-200 font-mono font-bold tracking-wider shadow-sm backdrop-blur-md">
                                            {project.code}
                                        </Badge>
                                        <Badge className="bg-blue-500 text-white shadow-md shadow-blue-500/20 hover:bg-blue-600">
                                            En Progreso
                                        </Badge>
                                    </div>
                                    <CardTitle className="text-xl font-bold leading-tight group-hover:text-primary transition-colors line-clamp-2 min-h-[3.5rem]">
                                        {project.name}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4 text-sm pb-6">
                                    <div className="space-y-2">
                                        <div className="flex items-center text-muted-foreground">
                                            <Building2 className="w-4 h-4 mr-2 text-primary/60" />
                                            <span className="font-medium text-foreground">{project.company}</span>
                                        </div>
                                        <div className="flex items-center text-muted-foreground">
                                            <User2 className="w-4 h-4 mr-2 text-primary/60" />
                                            <span className="truncate">{project.requestor}</span>
                                        </div>
                                    </div>

                                    <div className="pt-2 border-t border-border/50">
                                        <div className="flex justify-between items-center mb-2 text-xs">
                                            <div className="flex items-center gap-1.5 text-muted-foreground">
                                                <Calendar className="w-3.5 h-3.5" />
                                                Inicio: <span className="text-foreground font-medium">{new Date(project.start_date).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <span className={dateColor}>
                                                    Entrega: {new Date(project.delivery_date).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="relative pt-1">
                                            <div className="flex justify-between text-[10px] mb-1 font-semibold text-muted-foreground">
                                                <span>Progreso estimado</span>
                                                <span>{Math.round(progress)}%</span>
                                            </div>
                                            <Progress value={progress} className="h-2 bg-muted" indicatorClassName={daysRemaining < 7 ? "bg-red-500" : "bg-primary"} />
                                        </div>
                                        {daysRemaining < 0 && (
                                            <p className="text-[10px] text-red-600 font-bold mt-1 flex items-center justify-end">
                                                <AlertCircle className="w-3 h-3 mr-1" />
                                                RETRASADO ({Math.abs(daysRemaining)} días)
                                            </p>
                                        )}
                                    </div>
                                </CardContent>
                                <CardFooter className="bg-muted/30 pt-4 pb-4 border-t border-border/50">
                                    <Button
                                        variant="ghost"
                                        className="w-full hover:bg-white dark:hover:bg-zinc-800 hover:shadow-sm font-semibold text-xs uppercase tracking-wide border border-transparent hover:border-border transition-all"
                                        onClick={() => setSelectedProject(project)}
                                    >
                                        Ver Detalles
                                    </Button>
                                </CardFooter>
                            </Card>
                        );
                    })}
                </div>
            )}

            <ProjectDetailsPanel
                project={selectedProject}
                isOpen={!!selectedProject}
                onClose={() => setSelectedProject(null)}
            />
        </div>
    );
}
