"use client";

import { useEffect, useState } from "react";
import { DashboardHeader } from "@/components/dashboard-header";
import { FolderKanban, Search, Calendar, User2, Building2, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { getActiveProjects, getFilterOptions, getCatalogData } from "../actions";
import { parseLocalDate } from "@/lib/date-utils";
import { toast } from "sonner";
import Link from "next/link";
import { ProjectDetailsPanel } from "@/components/sales/project-details-panel";
import { ProjectsFilter } from "@/components/sales/projects-filter";
import { useProjectFilters } from "./hooks/use-project-filters";
import { useTour } from "@/hooks/use-tour";

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

export default function ActiveProjectsPage() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const [filterOptions, setFilterOptions] = useState<{ clients: string[], requestors: string[] }>({ clients: [], requestors: [] });

    // Full catalog for editing
    const [catalog, setCatalog] = useState<{
        clients: { id: string, name: string, prefix?: string | null }[],
        contacts: { id: string, name: string, client_id?: string }[],
        materials: { id: string, name: string }[],
        statuses: { id: string, name: string }[],
        treatments: { id: string, name: string }[]
    }>({ clients: [], contacts: [], materials: [], statuses: [], treatments: [] });

    // Custom hook for filters
    const { filters, updateFilter, resetFilters, activeFilterCount } = useProjectFilters();

    const fetchProjects = async () => {
        try {
            const [projectsData, optionsData, catalogData] = await Promise.all([
                getActiveProjects(),
                getFilterOptions(),
                getCatalogData()
            ]);
            setProjects(projectsData as any);
            setFilterOptions(optionsData as any);
            setCatalog(catalogData as any);
        } catch (error: any) {
            toast.error("Error al cargar datos: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProjects();
    }, []);

    // Function to calculate progress and date status
    const getProjectStatus = (start: string, end: string) => {
        const startDate = parseLocalDate(start)?.getTime() || 0;
        const endDate = parseLocalDate(end)?.getTime() || 0;
        const today = new Date().setHours(0, 0, 0, 0); // Start of today

        const totalDuration = endDate - startDate;
        const elapsed = today - startDate;

        // Progress percentage (0-100)
        const progress = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));

        // Urgency color based on days remaining
        const daysRemaining = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
        let dateColor = "text-green-600 dark:text-green-500/80";
        if (daysRemaining < 0) dateColor = "text-red-700 dark:text-red-400 font-bold"; // Overdue
        else if (daysRemaining <= 7) dateColor = "text-red-500 dark:text-red-400 font-bold"; // Urgent
        else if (daysRemaining <= 15) dateColor = "text-yellow-600 dark:text-yellow-500/80"; // Warning

        return { progress, dateColor, daysRemaining };
    };

    // --- HELP TOUR HANDLER ---
    const { startTour } = useTour();

    const handleStartTour = () => {
        const isDemo = projects.length === 0;

        if (isDemo) {
            const demoProject = {
                id: "demo-project",
                code: "DEMO-001",
                name: "Proyecto de Demostración (Tour)",
                company: "Cliente Demo S.A.",
                requestor: "Juan Demo",
                start_date: new Date().toISOString(),
                delivery_date: new Date(Date.now() + 86400000 * 5).toISOString(), // 5 days from now
                status: "active"
            };
            setProjects([demoProject]);
            setSelectedProject(demoProject);
        } else {
            // If projects exist, select the first one for the tour
            setSelectedProject(projects[0]);
        }

        const cleanup = () => {
            if (isDemo) setProjects([]);
            setSelectedProject(null); // Close panel on finish
        };

        startTour([
            {
                element: "#active-projects-search",
                popover: { title: "Búsqueda Rápida", description: "Encuentra proyectos por Código, Nombre o Cliente.", side: "bottom", align: "start" }
            },
            {
                element: "#active-projects-filters",
                popover: { title: "Filtros Avanzados", description: "Filtra por Cliente, Solicitante, Estatus (A tiempo/Retrasado) o Rango de Fechas.", side: "bottom" }
            },
            {
                element: "#active-project-card-0",
                popover: { title: "Tarjeta de Proyecto", description: "Haz clic en cualquier tarjeta para ver el detalle completo.", side: "right", align: "center" }
            },
            // Side Panel Steps
            {
                element: "#project-details-panel",
                popover: { title: "Panel de Detalles", description: "Aquí puedes ver toda la información del proyecto sin salir de la página.", side: "left", align: "start" }
            },
            {
                element: "#project-details-items",
                popover: { title: "Partidas del Proyecto", description: "Lista de piezas a fabricar. Haz clic en el código para ver el detalle de cada pieza.", side: "left", align: "center" }
            }
        ], cleanup);
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
            const deliveryDate = parseLocalDate(p.delivery_date)?.getTime() || 0;
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
                icon={<FolderKanban className="w-8 h-8" />}
                backUrl="/dashboard/ventas"
                colorClass="text-orange-500"
                bgClass="bg-orange-500/10"
                onHelp={handleStartTour}
            />

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1 max-w-md" id="active-projects-search">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por Código, Nombre o Cliente..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 bg-background/50 border-border focus:border-orange-500 transition-all shadow-sm"
                    />
                </div>
                <div id="active-projects-filters">
                    <ProjectsFilter
                        filters={filters}
                        options={filterOptions}
                        onUpdate={updateFilter}
                        onReset={resetFilters}
                        activeCount={activeFilterCount}
                    />
                </div>
            </div>

            {/* Projects Grid */}
            {filteredProjects.length === 0 ? (
                <div className="text-center py-20 bg-muted/20 rounded-xl border border-dashed border-border">
                    <FolderKanban className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                    <p className="text-muted-foreground font-medium">No se encontraron proyectos activos.</p>
                </div>
            ) : (
                <div className={`grid gap-6 md:grid-cols-2 ${selectedProject ? "lg:grid-cols-2" : "lg:grid-cols-3"} transition-all duration-300`}>
                    {filteredProjects.map((project, index) => {
                        const { progress, dateColor, daysRemaining } = getProjectStatus(project.start_date, project.delivery_date);

                        return (
                            <Card
                                key={project.id}
                                id={index === 0 ? "active-project-card-0" : undefined}
                                onClick={() => setSelectedProject(project)}
                                className={`group cursor-pointer hover:shadow-lg transition-all duration-300 border-border overflow-hidden ${selectedProject?.id === project.id
                                    ? "ring-2 ring-primary/50 border-primary bg-card/80 dark:bg-card/40 shadow-md scale-[1.02]"
                                    : "bg-card/40 dark:bg-card/20 backdrop-blur-sm"
                                    }`}
                            >
                                <CardHeader className="pb-3 relative">
                                    <div className="flex justify-between items-start mb-2">
                                        <Badge variant="outline" className="bg-red-500/5 text-red-600 dark:text-red-400 border-none shadow-none px-2 py-0.5 h-auto font-mono font-bold tracking-wider backdrop-blur-md">
                                            {project.code}
                                        </Badge>
                                        <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold text-[10px] uppercase tracking-widest px-1">
                                            <span className="relative flex h-1.5 w-1.5">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-600 dark:bg-blue-400"></span>
                                            </span>
                                            En Progreso
                                        </div>
                                    </div>
                                    <CardTitle className="text-xl font-bold leading-tight group-hover:text-primary transition-colors line-clamp-2 min-h-[3.5rem]">
                                        {project.name}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4 text-sm pb-6">
                                    <div className="space-y-2">
                                        <div className="flex items-center text-muted-foreground">
                                            <Building2 className="w-4 h-4 mr-2 text-muted-foreground/40 dark:text-muted-foreground/20" />
                                            <span className="font-medium text-foreground">{project.company}</span>
                                        </div>
                                        <div className="flex items-center text-muted-foreground">
                                            <User2 className="w-4 h-4 mr-2 text-muted-foreground/40 dark:text-muted-foreground/20" />
                                            <span className="truncate">{project.requestor}</span>
                                        </div>
                                    </div>

                                    <div className="pt-2 border-t border-border/50">
                                        <div className="flex justify-between items-center mb-2 text-xs">
                                            <div className="flex items-center gap-1.5 text-muted-foreground">
                                                <Calendar className="w-3.5 h-3.5" />
                                                Inicio: <span className="text-foreground font-medium">{parseLocalDate(project.start_date)?.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <span className={dateColor}>
                                                    Entrega: {parseLocalDate(project.delivery_date)?.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="relative pt-1">
                                            <div className="flex justify-between text-[10px] mb-1 font-semibold text-muted-foreground">
                                                <span>Progreso estimado</span>
                                                <span>{Math.round(progress)}%</span>
                                            </div>
                                            <Progress value={progress} className="h-2 bg-muted transition-all" indicatorClassName={daysRemaining < 7 ? "bg-red-500 dark:bg-red-600/80" : "bg-primary dark:bg-primary/80"} />
                                        </div>
                                        {daysRemaining < 0 && (
                                            <p className="text-[10px] text-red-600 dark:text-red-400 font-bold mt-1 flex items-center justify-end opacity-90">
                                                <AlertCircle className="w-3 h-3 mr-1" />
                                                RETRASADO ({Math.abs(daysRemaining)} días)
                                            </p>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )
            }

            <ProjectDetailsPanel
                project={selectedProject}
                isOpen={!!selectedProject}
                onClose={() => setSelectedProject(null)}
                onProjectUpdated={fetchProjects}
                clients={catalog.clients}
                contacts={catalog.contacts}
                materials={catalog.materials}
                statuses={catalog.statuses}
                treatments={catalog.treatments}
            />
        </div >
    );
}
