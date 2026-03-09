"use client";

import { useEffect, useState } from "react";
import { DashboardHeader } from "@/components/dashboard-header";
import { ShieldCheck, Search, Filter, RefreshCcw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { getAuditData, getCatalogData } from "../actions";
import { ProjectDetailsPanel } from "@/components/sales/project-details-panel";
import { DataAuditTable } from "@/components/sales/data-audit-table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export default function DataAuditPage() {
    const [loading, setLoading] = useState(true);
    const [rawProjects, setRawProjects] = useState<any[]>([]);
    const [projects, setProjects] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedProject, setSelectedProject] = useState<any | null>(null);

    // Catalog data for ProjectDetailsPanel
    const [catalog, setCatalog] = useState<{
        clients: any[],
        contacts: any[],
        materials: any[],
        statuses: any[],
        treatments: any[]
    }>({ clients: [], contacts: [], materials: [], statuses: [], treatments: [] });

    // Lógica de cálculo de integridad
    const calculateIntegrity = (project: any) => {
        let score = 0;

        // Proyecto (50 puntos base)
        if (project.name && project.name.trim() !== "" && project.name !== "SIN NOMBRE") score += 10;
        
        // Cliente (15 pts): 5 por texto, 10 por ID vinculado
        if (project.company && project.company.trim() !== "" && project.company !== "SIN CLIENTE" && project.company !== "POR DEFINIR") {
            score += 5;
            if (project.company_id) score += 10;
        }

        // Solicitante (5 pts): 2 por texto, 3 por ID vinculado
        if (project.requestor && project.requestor.trim() !== "" && project.requestor !== "SIN SOLICITANTE") {
            score += 2;
            if (project.requestor_id) score += 3;
        }

        if (project.start_date) score += 10;
        if (project.delivery_date) score += 10;

        // Partidas (50 puntos base)
        const items = project.production_orders || [];
        if (items.length > 0) {
            let itemsTotalScore = 0;
            items.forEach((item: any) => {
                let itemScore = 0;
                if (item.part_name && item.part_name.trim() !== "" && item.part_name !== "SIN NOMBRE") itemScore += 10;
                if (item.quantity && item.quantity > 0) itemScore += 15;
                
                // Material (15 pts): 5 por texto, 10 por ID vinculado
                if (item.material && item.material.trim() !== "" && item.material !== "POR DEFINIR") {
                    itemScore += 5;
                    if (item.material_id) itemScore += 10;
                }
                
                if (item.design_no && item.design_no.trim() !== "") itemScore += 5;
                if (item.unit && item.unit.trim() !== "") itemScore += 5;

                // Tratamiento (5 pts): 2 por texto, 3 por ID vinculado o 5 si es "none"
                if (item.treatment_id && item.treatment_id !== "none") {
                    itemScore += 5;
                } else if (item.treatment && item.treatment.trim() !== "" && item.treatment !== "SIN TRATAMIENTO") {
                    itemScore += 2;
                    if (item.treatment_id) itemScore += 3;
                } else {
                    itemScore += 5; // Default case (none or empty is usually ok if not required)
                }

                itemsTotalScore += itemScore;
            });
            score += (itemsTotalScore / items.length);
        }

        return Math.min(100, score);
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const [auditData, catalogData] = await Promise.all([
                getAuditData(),
                getCatalogData()
            ]);

            const projectsWithScore = (auditData as any[]).map(p => ({
                ...p,
                integrityScore: calculateIntegrity(p)
            })).sort((a, b) => a.integrityScore - b.integrityScore); // Los más incompletos primero

            setRawProjects(projectsWithScore);
            setProjects(projectsWithScore);
            setCatalog(catalogData as any);

            // Sync selected project if open
            if (selectedProject) {
                const updated = projectsWithScore.find(p => p.id === selectedProject.id);
                if (updated) setSelectedProject(updated);
            }
        } catch (error: any) {
            toast.error("Error al cargar auditoría: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Filter Logic
    useEffect(() => {
        const filtered = rawProjects.filter(p =>
            p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.company?.toLowerCase().includes(searchTerm.toLowerCase())
        );
        setProjects(filtered);
    }, [searchTerm, rawProjects]);

    if (loading && rawProjects.length === 0) {
        return <div className="p-8 text-center text-muted-foreground animate-pulse">Generando reporte de auditoría...</div>;
    }

    const criticalCount = rawProjects.filter(p => p.integrityScore < 60).length;

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-20">
            <DashboardHeader
                title="Auditoría de Datos"
                description="Control de integridad y calidad administrativa de proyectos"
                icon={<ShieldCheck className="w-8 h-8" />}
                backUrl="/dashboard/ventas"
                colorClass="text-emerald-500"
                bgClass="bg-emerald-500/10"
            />

            {/* Stats Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-border shadow-sm flex flex-col items-center justify-center text-center">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Proyectos</span>
                    <span className="text-2xl font-black text-slate-800 dark:text-white">{rawProjects.length}</span>
                </div>
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-border shadow-sm flex flex-col items-center justify-center text-center ring-2 ring-red-500/10">
                    <span className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-1">Datos Críticos Faltantes</span>
                    <span className="text-2xl font-black text-red-600">{criticalCount}</span>
                </div>
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-border shadow-sm flex flex-col items-center justify-center text-center">
                    <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">Integridad General</span>
                    <span className="text-2xl font-black text-emerald-600">
                        {Math.round(rawProjects.reduce((acc, p) => acc + p.integrityScore, 0) / (rawProjects.length || 1))}%
                    </span>
                </div>
            </div>

            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por Código, Nombre o Cliente..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 bg-background/50 border-border focus:border-emerald-500 transition-all shadow-sm"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={fetchData}
                        className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 border border-border rounded-xl hover:bg-slate-50 transition-colors text-xs font-bold"
                    >
                        <RefreshCcw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
                        Actualizar
                    </button>
                    <Badge variant="outline" className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 border-emerald-200">
                        {projects.length} resultados
                    </Badge>
                </div>
            </div>

            {/* Table Area */}
            {projects.length === 0 ? (
                <div className="text-center py-20 bg-muted/20 rounded-xl border border-dashed border-border">
                    <p className="text-muted-foreground font-medium">No se encontraron proyectos para auditar.</p>
                </div>
            ) : (
                <DataAuditTable
                    projects={projects}
                    onSelectProject={setSelectedProject}
                />
            )}

            {/* Editing Panel (Reusing existing component) */}
            <ProjectDetailsPanel
                project={selectedProject}
                isOpen={!!selectedProject}
                onClose={() => setSelectedProject(null)}
                onProjectUpdated={fetchData}
                clients={catalog.clients}
                contacts={catalog.contacts}
                materials={catalog.materials}
                statuses={catalog.statuses}
                treatments={catalog.treatments}
            />
        </div>
    );
}
