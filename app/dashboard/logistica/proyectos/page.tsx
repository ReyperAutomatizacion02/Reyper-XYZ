"use client";

import { useEffect, useState } from "react";
import { DashboardHeader } from "@/components/dashboard-header";
import { Truck, FolderKanban, Search, LayoutGrid, List, ArrowUpWideNarrow } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getActiveProjects, getFilterOptions, getCatalogData } from "../../ventas/actions";
import { parseLocalDate } from "@/lib/date-utils";
import { toast } from "sonner";
import { ProjectDetailsPanel } from "@/components/projects/project-details-panel";
import { ProjectsFilter } from "@/components/projects/projects-filter";
import { ProjectsTable } from "@/components/projects/projects-table";
import { useProjectFilters } from "../../ventas/proyectos/hooks/use-project-filters";
import { Building2, User2 } from "lucide-react";

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
    parts_count?: number;
}

/**
 * Logística Area Configuration
 * Define exactly what logistics users should see and edit
 */
const LOGISTICA_CONFIG = {
    table: {
        code: true,
        name: true,
        company: true,
        delivery_date: true,
        progress: true,
        parts_count: true,
        requestor: false
    },
    details: {
        header: {
            allowEdit: false,
            hiddenFields: [],
            readOnlyFields: ['name', 'company', 'requestor', 'start_date', 'delivery_date']
        },
        items: {
            allowEdit: true,
            hiddenFields: [],
            readOnlyFields: ['name', 'quantity', 'material', 'assets', 'urgency', 'drawing_url']
        }
    },
    filters: {
        hiddenTabs: [] // Logistics might want all filters
    }
};

export default function LogisticaProjectsPage() {
    const { filters, updateFilter, toggleSort, resetFilters, activeFilterCount } = useProjectFilters();

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

    const fetchProjects = async () => {
        setLoading(true);
        try {
            const [projectsData, optionsData, catalogData] = await Promise.all([
                getActiveProjects(),
                getFilterOptions(),
                getCatalogData()
            ]);
            setProjects(projectsData as any);
            setFilterOptions(optionsData as any);
            setCatalog(catalogData as any);

            // Sync selected project if it exists
            if (selectedProject) {
                const updated = (projectsData as any[]).find(p => p.id === selectedProject.id);
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
    const getProjectStatus = (start: string, end: string) => {
        const startDate = parseLocalDate(start)?.getTime() || 0;
        const endDate = parseLocalDate(end)?.getTime() || 0;
        const today = new Date().setHours(0, 0, 0, 0);

        const totalDuration = endDate - startDate;
        const elapsed = today - startDate;
        const progress = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
        const daysRemaining = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));

        let dateColor = "text-green-600 dark:text-green-500/80";
        let statusBg = "bg-green-500";

        if (daysRemaining < 0) {
            dateColor = "text-[#EC1C21]";
            statusBg = "bg-[#EC1C21]";
        } else if (daysRemaining <= 7) {
            dateColor = "text-[#EC1C21]";
            statusBg = "bg-[#EC1C21]";
        } else if (daysRemaining <= 15) {
            dateColor = "text-orange-500";
            statusBg = "bg-orange-500";
        }

        return { progress, dateColor, statusBg, daysRemaining };
    };

    // Filter Logic
    const filteredProjects = projects.filter(p => {
        const matchesSearch = (p.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
            (p.code || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
            (p.company || "").toLowerCase().includes(searchTerm.toLowerCase());
        if (!matchesSearch) return false;
        if (filters.clients.length > 0 && !filters.clients.includes(p.company)) return false;
        if (filters.requestors.length > 0 && !filters.requestors.includes(p.requestor)) return false;
        if (filters.status.length > 0) {
            const { daysRemaining } = getProjectStatus(p.start_date, p.delivery_date);
            const isLate = daysRemaining < 0;
            const isOntime = daysRemaining >= 0;
            const showingLate = filters.status.includes('retrasado');
            const showingOntime = filters.status.includes('a_tiempo');
            if (showingLate && !showingOntime && !isLate) return false;
            if (showingOntime && !showingLate && !isOntime) return false;
        }
        if (filters.dateRange?.from || filters.dateRange?.to) {
            const deliveryDate = parseLocalDate(p.delivery_date)?.getTime() || 0;
            if (filters.dateRange.from && deliveryDate < filters.dateRange.from.getTime()) return false;
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
            const dateA = new Date(a.delivery_date).getTime();
            const dateB = new Date(b.delivery_date).getTime();
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
        const valA = (a as any)[field]?.toString().toLowerCase() || "";
        const valB = (b as any)[field]?.toString().toLowerCase() || "";
        return valA.localeCompare(valB) * order;
    });

    if (loading) return <div className="p-8 text-center text-muted-foreground animate-pulse">Cargando proyectos para logística...</div>;

    return (
        <div className={`space-y-6 max-w-7xl mx-auto pb-20 transition-all duration-300 ${selectedProject ? "mr-12 xl:mr-[500px]" : ""}`}>
            <DashboardHeader
                title="Proyectos Activos"
                description="Gestión y monitoreo de piezas para entrega"
                icon={<FolderKanban className="w-8 h-8" />}
                backUrl="/dashboard/logistica"
                colorClass="text-blue-600"
                bgClass="bg-blue-50"
            />

            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por Código, Nombre o Cliente..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 bg-background/50 border-border focus:border-blue-500 transition-all shadow-sm"
                    />
                </div>

                <div className="flex items-center gap-2">
                    <ProjectsFilter
                        filters={filters}
                        options={filterOptions}
                        onUpdate={updateFilter}
                        onReset={resetFilters}
                        activeCount={activeFilterCount}
                        hiddenTabs={LOGISTICA_CONFIG.filters.hiddenTabs}
                    />

                    {filters.viewMode === 'grid' && (
                        <Select value={filters.sortBy} onValueChange={(v) => toggleSort(v as any)}>
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
                    <Tabs value={filters.viewMode} onValueChange={(v) => updateFilter('viewMode', v as any)} className="w-auto">
                        <TabsList className="bg-transparent h-8 p-0 gap-1 child:rounded-lg">
                            <TabsTrigger
                                value="grid"
                                className="h-7 px-3 text-[10px] font-bold uppercase tracking-wider data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-blue-600"
                            >
                                <LayoutGrid className="w-3.5 h-3.5 mr-1.5" />
                                Cuadrícula
                            </TabsTrigger>
                            <TabsTrigger
                                value="table"
                                className="h-7 px-3 text-[10px] font-bold uppercase tracking-wider data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-blue-600"
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
            ) : filters.viewMode === 'grid' ? (
                <div className={`grid gap-6 md:grid-cols-2 ${selectedProject ? "lg:grid-cols-1 xl:grid-cols-2" : "lg:grid-cols-3"} transition-all duration-300`}>
                    {sortedProjects.map((project) => {
                        const { progress, dateColor, statusBg, daysRemaining } = getProjectStatus(project.start_date, project.delivery_date);
                        return (
                            <Card
                                key={project.id}
                                className={cn(
                                    "group cursor-pointer transition-all hover:shadow-xl hover:-translate-y-1 relative overflow-hidden bg-white/80 dark:bg-slate-900/40 backdrop-blur-sm flex flex-col h-full",
                                    selectedProject?.id === project.id ? "ring-2 ring-blue-500 border-transparent shadow-lg" : "border-border/40 text-slate-800"
                                )}
                                onClick={() => setSelectedProject(project)}
                            >
                                <CardHeader className="p-5 pb-2">
                                    <div className="flex justify-between items-start mb-2">
                                        <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950/20 text-blue-600 border-blue-200 font-mono font-bold tracking-widest px-2.5 py-1">
                                            {project.code}
                                        </Badge>
                                        <Badge variant="secondary" className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-none font-black text-[9px] uppercase tracking-wider px-2 py-0.5">
                                            {project.parts_count || 0} {project.parts_count === 1 ? 'PARTIDA' : 'PARTIDAS'}
                                        </Badge>
                                    </div>
                                    <CardTitle className="text-base uppercase font-black line-clamp-1 transition-colors group-hover:text-blue-600">
                                        {project.name}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-5 pt-2 flex flex-col flex-grow">
                                    <div className="grid grid-cols-2 gap-4 mb-4 mt-2">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[9px] uppercase font-bold text-slate-400 tracking-widest">Cliente</span>
                                            <div className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
                                                <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                                    <Building2 className="w-3 h-3 text-slate-400" />
                                                </div>
                                                <span className="truncate uppercase">{project.company}</span>
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[9px] uppercase font-bold text-slate-400 tracking-widest">Solicitante</span>
                                            <div className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
                                                <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                                    <User2 className="w-3 h-3 text-slate-400" />
                                                </div>
                                                <span className="truncate uppercase">{project.requestor}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800/50">
                                        <div className="flex justify-between items-center text-[10px] uppercase font-bold text-slate-400 tracking-widest">
                                            <div className="flex flex-col gap-1">
                                                <span>Solicitud</span>
                                                <span className="font-black text-slate-600 dark:text-slate-300">
                                                    {parseLocalDate(project.start_date)?.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                </span>
                                            </div>
                                            <div className="flex flex-col gap-1 text-right">
                                                <span>Entrega</span>
                                                <span className="font-black text-slate-600 dark:text-slate-300">
                                                    {parseLocalDate(project.delivery_date)?.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Progress value={progress} className="h-2 bg-slate-100 dark:bg-slate-800" indicatorClassName={statusBg} />
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
                    visibilityConfig={LOGISTICA_CONFIG.table}
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
                config={LOGISTICA_CONFIG.details}
            />
        </div>
    );
}
