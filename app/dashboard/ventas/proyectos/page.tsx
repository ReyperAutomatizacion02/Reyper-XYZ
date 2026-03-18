"use client";

import { useEffect, useState } from "react";
import { DashboardHeader } from "@/components/dashboard-header";
import { FolderKanban, Search, Calendar, User2, Building2, AlertCircle, LayoutGrid, List, ArrowUpWideNarrow } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getActiveProjects, getFilterOptions, getCatalogData } from "../actions";
import { parseLocalDate } from "@/lib/date-utils";
import { toast } from "sonner";
import { ProjectDetailsPanel } from "@/components/projects/project-details-panel";
import { ProjectsFilter } from "@/components/projects/projects-filter";
import { ProjectsTable } from "@/components/projects/projects-table";
import { useProjectFilters } from "./hooks/use-project-filters";
import { useTour } from "@/hooks/use-tour";

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
    parts_count?: number;
}

export default function ActiveProjectsPage() {
    const { filters, updateFilter, toggleSort, resetFilters, activeFilterCount, isLoaded } = useProjectFilters();

    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const [filterOptions, setFilterOptions] = useState<{ clients: string[], requestors: string[] }>({ clients: [], requestors: [] });

    // Full catalog for editing
    const [catalog, setCatalog] = useState<{
        clients: { id: string, name: string, prefix?: string | null }[],
        contacts: { id: string, name: string, client_id?: string | null }[],
        materials: { id: string, name: string }[],
        statuses: { id: string, name: string }[],
        treatments: { id: string, name: string }[]
    }>({ clients: [], contacts: [], materials: [], statuses: [], treatments: [] });

    const fetchProjects = async () => {
        try {
            const [projectsData, optionsData, catalogData] = await Promise.all([
                getActiveProjects(),
                getFilterOptions(),
                getCatalogData()
            ]);
            setProjects(projectsData as Project[]);
            setFilterOptions(optionsData as { clients: string[], requestors: string[] });
            setCatalog(catalogData);

            // Sync selected project if it exists
            if (selectedProject) {
                const updated = (projectsData as Project[]).find(p => p.id === selectedProject.id);
                if (updated) setSelectedProject(updated);
            }
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
    const getProjectStatus = (start: string | null, end: string | null) => {
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
        let statusBg = "bg-green-500";

        if (daysRemaining < 0) {
            dateColor = "text-[#EC1C21]"; // Overdue
            statusBg = "bg-[#EC1C21]";
        } else if (daysRemaining <= 7) {
            dateColor = "text-[#EC1C21]"; // Urgent
            statusBg = "bg-[#EC1C21]";
        } else if (daysRemaining <= 15) {
            dateColor = "text-orange-500"; // Warning
            statusBg = "bg-orange-500";
        }

        return { progress, dateColor, statusBg, daysRemaining };
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
                element: `#active-project-card-0`,
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
        if (filters.clients.length > 0 && !filters.clients.includes(p.company ?? "")) return false;

        // Requestor Filter
        if (filters.requestors.length > 0 && !filters.requestors.includes(p.requestor ?? "")) return false;

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

    // Sort Logic
    const sortedProjects = [...filteredProjects].sort((a, b) => {
        const field = filters.sortBy;
        const order = filters.sortOrder === 'desc' ? -1 : 1;

        if (field === 'delivery_date') {
            const dateA = new Date(a.delivery_date ?? "").getTime();
            const dateB = new Date(b.delivery_date ?? "").getTime();
            return (dateA - dateB) * order;
        }

        if (field === 'progress') {
            const progA = getProjectStatus(a.start_date, a.delivery_date).progress;
            const progB = getProjectStatus(b.start_date, b.delivery_date).progress;
            return (progA - progB) * order;
        }

        if (field === 'parts_count') {
            return ((a.parts_count || 0) - (b.parts_count || 0)) * order;
        }

        const valA = (a[field as keyof Project])?.toString().toLowerCase() || "";
        const valB = (b[field as keyof Project])?.toString().toLowerCase() || "";
        return valA.localeCompare(valB) * order;
    });

    if (loading) return <div className="p-8 text-center text-muted-foreground animate-pulse">Cargando proyectos activos...</div>;

    const viewMode = filters.viewMode;

    return (
        <div className={`space-y-6 max-w-7xl mx-auto pb-20 transition-all duration-300 ${selectedProject ? "mr-12 xl:mr-[500px]" : ""}`}>
            <DashboardHeader
                title="Proyectos Activos"
                description="Monitoreo de proyectos en curso y tiempos de entrega"
                icon={<FolderKanban className="w-8 h-8" />}
                backUrl="/dashboard/ventas"
                colorClass="text-orange-500"
                bgClass="bg-orange-500/10"
                onHelp={handleStartTour}
            />

            {/* Toolbar */}
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

                <div id="active-projects-filters" className="flex items-center gap-2">
                    <ProjectsFilter
                        filters={filters}
                        options={filterOptions}
                        onUpdate={updateFilter}
                        onReset={resetFilters}
                        activeCount={activeFilterCount}
                    />

                    {/* Sort Dropdown for Grid View */}
                    {viewMode === 'grid' && (
                        <Select value={filters.sortBy} onValueChange={(v) => toggleSort(v as typeof filters.sortBy)}>
                            <SelectTrigger className="w-[180px] bg-background/50 border-border h-10 px-3">
                                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                    <ArrowUpWideNarrow className="w-3.5 h-3.5" />
                                    <span>Orden: {
                                        filters.sortBy === 'delivery_date' ? 'Entrega' :
                                            filters.sortBy === 'name' ? 'Nombre' :
                                                filters.sortBy === 'code' ? 'Código' :
                                                    filters.sortBy === 'progress' ? 'Progreso' : 'Partidas'
                                    }</span>
                                </div>
                            </SelectTrigger>
                            <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                                <SelectItem value="delivery_date">Fecha Entrega</SelectItem>
                                <SelectItem value="code">Código</SelectItem>
                                <SelectItem value="name">Nombre Proyecto</SelectItem>
                                <SelectItem value="progress">Progreso</SelectItem>
                                <SelectItem value="parts_count">Cantidad Partidas</SelectItem>
                            </SelectContent>
                        </Select>
                    )}
                </div>

                <div className="flex items-center gap-2 bg-muted/40 p-1 rounded-xl border border-border/50 self-end lg:self-center">
                    <Tabs value={viewMode} onValueChange={(v) => updateFilter('viewMode', v)} className="w-auto">
                        <TabsList className="bg-transparent h-8 p-0 gap-1 child:rounded-lg">
                            <TabsTrigger
                                value="grid"
                                className="h-7 px-3 text-[10px] font-bold uppercase tracking-wider data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-orange-600"
                            >
                                <LayoutGrid className="w-3.5 h-3.5 mr-1.5" />
                                Cuadrícula
                            </TabsTrigger>
                            <TabsTrigger
                                value="table"
                                className="h-7 px-3 text-[10px] font-bold uppercase tracking-wider data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-orange-600"
                            >
                                <List className="w-3.5 h-3.5 mr-1.5" />
                                Tabla
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>
            </div>

            {/* Content Area */}
            {sortedProjects.length === 0 ? (
                <div className="text-center py-20 bg-muted/20 rounded-xl border border-dashed border-border">
                    <FolderKanban className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                    <p className="text-muted-foreground font-medium">No se encontraron proyectos activos.</p>
                </div>
            ) : viewMode === 'grid' ? (
                <div className={`grid gap-6 md:grid-cols-2 ${selectedProject ? "lg:grid-cols-1 xl:grid-cols-2" : "lg:grid-cols-3"} transition-all duration-300`}>
                    {sortedProjects.map((project, index) => {
                        const { progress, dateColor, statusBg, daysRemaining } = getProjectStatus(project.start_date, project.delivery_date);

                        return (
                            <div key={project.id} id={`active-project-card-${index}`}>
                                <Card
                                    className={cn(
                                        "group cursor-pointer transition-all hover:shadow-xl hover:-translate-y-1 relative overflow-hidden bg-white/80 dark:bg-slate-900/40 backdrop-blur-sm flex flex-col h-full",
                                        selectedProject?.id === project.id ? "ring-2 ring-orange-500 border-transparent shadow-lg" : "border-border/40 text-slate-800"
                                    )}
                                    onClick={() => setSelectedProject(project)}
                                >
                                    <CardHeader className="p-5 pb-2">
                                        <div className="flex justify-between items-start mb-2">
                                            <Badge variant="outline" className="bg-red-50 dark:bg-red-950/20 text-[#EC1C21] border-[#EC1C21]/20 font-mono font-bold tracking-widest px-2.5 py-1">
                                                {project.code}
                                            </Badge>
                                            <Badge variant="secondary" className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-none font-black text-[9px] uppercase tracking-wider px-2 py-0.5">
                                                {project.parts_count || 0} {project.parts_count === 1 ? 'PARTIDA' : 'PARTIDAS'}
                                            </Badge>
                                        </div>
                                        <CardTitle className={cn(
                                            "text-base uppercase font-black line-clamp-1 transition-colors",
                                            project.name ? "text-slate-800 dark:text-slate-100 group-hover:text-orange-600" : "text-slate-400 dark:text-slate-500 opacity-40"
                                        )}>
                                            {project.name || "SIN NOMBRE"}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-5 pt-2 flex flex-col flex-grow">
                                        <div className="grid grid-cols-2 gap-4 mb-4 mt-2">
                                            <div className="flex flex-col gap-1">
                                                <span className="text-[9px] uppercase font-bold text-slate-400 tracking-widest">Cliente</span>
                                                <div className={cn(
                                                    "flex items-center gap-2 text-xs font-bold",
                                                    project.company ? "text-slate-600 dark:text-slate-300" : "text-slate-400 dark:text-slate-500 opacity-40"
                                                )}>
                                                    <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                                        <Building2 className="w-3 h-3 text-slate-400" />
                                                    </div>
                                                    <span className="truncate uppercase">{project.company || "SIN CLIENTE"}</span>
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <span className="text-[9px] uppercase font-bold text-slate-400 tracking-widest">Solicitante</span>
                                                <div className={cn(
                                                    "flex items-center gap-2 text-xs font-bold",
                                                    project.requestor ? "text-slate-600 dark:text-slate-300" : "text-slate-400 dark:text-slate-500 opacity-40"
                                                )}>
                                                    <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                                        <User2 className="w-3 h-3 text-slate-400" />
                                                    </div>
                                                    <span className="truncate uppercase">{project.requestor || "SIN SOLICITANTE"}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800/50">
                                            <div className="flex justify-between items-center text-[10px] uppercase font-bold text-slate-400 tracking-widest">
                                                <div className="flex flex-col gap-1">
                                                    <span>Solicitud</span>
                                                    <span className={cn(
                                                        "font-black",
                                                        project.start_date ? "text-slate-600 dark:text-slate-300" : "text-slate-400 dark:text-slate-500 opacity-40 text-[9px]"
                                                    )}>
                                                        {project.start_date
                                                            ? parseLocalDate(project.start_date)?.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
                                                            : "SIN FECHA"}
                                                    </span>
                                                </div>
                                                <div className="flex flex-col gap-1 text-right">
                                                    <span>Entrega</span>
                                                    <span className={cn(
                                                        "font-black",
                                                        project.delivery_date ? "text-slate-600 dark:text-slate-300" : "text-slate-400 dark:text-slate-500 opacity-40 text-[9px]"
                                                    )}>
                                                        {project.delivery_date
                                                            ? parseLocalDate(project.delivery_date)?.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
                                                            : "SIN FECHA"}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <Progress
                                                    value={progress}
                                                    className="h-2 bg-slate-100 dark:bg-slate-800"
                                                    indicatorClassName={statusBg}
                                                />
                                                <div className="flex justify-between items-center">
                                                    <span className="text-[10px] font-black font-mono text-slate-400">{Math.round(progress)}% COMPLETADO</span>
                                                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                                                        {daysRemaining < 0 ? 'Retrasado' : daysRemaining === 0 ? 'Vence hoy' : `${daysRemaining} días restantes`}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <ProjectsTable
                    projects={sortedProjects}
                    onSelectProject={setSelectedProject}
                    selectedProjectId={selectedProject?.id}
                    sortBy={filters.sortBy}
                    sortOrder={filters.sortOrder}
                    onSort={toggleSort}
                />
            )}

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
        </div>
    );
}
