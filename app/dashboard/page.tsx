import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const dynamic = 'force-dynamic';
import {
    FolderKanban,
    Package,
    CalendarClock,
    TrendingUp,
    AlertTriangle,
    Clock,
    CheckCircle2,
    BarChart3,
    LineChart,
    PieChart
} from "lucide-react";
import { UtilizationChart, ProjectsTrendChart, ItemsStatusChart } from "./charts";
import { RealtimeRefresher } from "@/components/realtime-refresher";
import { DashboardClientHeader } from "@/components/dashboard/dashboard-client-header";

// Helper to calculate days difference
function getDaysUntil(dateStr: string): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dateStr);
    target.setHours(0, 0, 0, 0);
    return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

// Badge component for urgency
function UrgencyBadge({ days }: { days: number }) {
    if (days < 0) {
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-500/10 text-red-500">
                <AlertTriangle className="w-3 h-3" />
                Vencido ({Math.abs(days)}d)
            </span>
        );
    }
    if (days <= 3) {
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-500/10 text-orange-500">
                <Clock className="w-3 h-3" />
                {days === 0 ? "Hoy" : `${days}d restantes`}
            </span>
        );
    }
    if (days <= 7) {
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-500/10 text-yellow-500">
                <Clock className="w-3 h-3" />
                {days}d restantes
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-500/10 text-green-500">
            <CheckCircle2 className="w-3 h-3" />
            {days}d restantes
        </span>
    );
}

// --- DATA PROCESSING HELPERS ---

// Calculate Machine Utilization (Strict Lane 1 Logic)
function calculateUtilization(tasks: any[]) {
    const SHIFT_START = 6;
    const SHIFT_END = 22;
    const SHIFT_HOURS = 16;
    const DAYS_TO_ANALYZE = 7;
    const TOTAL_CAPACITY = SHIFT_HOURS * DAYS_TO_ANALYZE;

    const machines: Record<string, { hours: number; efficiency: number }> = {};

    // Group by machine
    const tasksByMachine = tasks.reduce((acc, task) => {
        const m = task.machine || "Sin Máquina";
        if (!acc[m]) acc[m] = [];
        acc[m].push(task);
        return acc;
    }, {} as Record<string, any[]>);

    Object.entries(tasksByMachine).forEach(([machine, tasks]) => {
        const machineTasks = tasks as any[];
        let occupiedHours = 0;

        // Sort tasks strictly by time
        const sortedTasks = machineTasks.sort((a, b) =>
            new Date(a.planned_date).getTime() - new Date(b.planned_date).getTime()
        );

        // Iterate days (last 7 days)
        for (let i = 0; i < DAYS_TO_ANALYZE; i++) {
            const dayStart = new Date();
            dayStart.setDate(dayStart.getDate() - i);
            dayStart.setHours(SHIFT_START, 0, 0, 0);

            const dayEnd = new Date(dayStart);
            dayEnd.setHours(SHIFT_END, 0, 0, 0);

            let currentLaneEnd = 0;

            // Filter tasks for this day
            const dailyTasks = sortedTasks.filter((t: any) => {
                const tStart = new Date(t.planned_date);
                const tEnd = new Date(t.planned_end);
                return tStart < dayEnd && tEnd > dayStart;
            });

            dailyTasks.forEach((task: any) => {
                const tStart = new Date(task.planned_date);
                const tEnd = new Date(task.planned_end);
                const tStartTime = tStart.getTime();

                // Lane 1 Check: Must start after previous task ended
                if (tStartTime >= currentLaneEnd) {
                    // Clamp to shift window
                    const effectiveStart = tStart < dayStart ? dayStart : tStart;
                    const effectiveEnd = tEnd > dayEnd ? dayEnd : tEnd;

                    if (effectiveEnd > effectiveStart) {
                        const durationMs = effectiveEnd.getTime() - effectiveStart.getTime();
                        occupiedHours += durationMs / (1000 * 60 * 60);
                        currentLaneEnd = tEnd.getTime();
                    }
                }
            });
        }

        const efficiency = (occupiedHours / TOTAL_CAPACITY) * 100;
        machines[machine] = { hours: occupiedHours, efficiency: Math.min(efficiency, 100) };
    });

    return Object.entries(machines)
        .map(([name, data]: [string, any]) => ({
            machine: name,
            hours: data.hours,
            efficiency: data.efficiency
        }))
        .sort((a, b) => b.efficiency - a.efficiency);
}

export default async function DashboardPage() {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    // Date ranges for charts
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // --- FETCH DATA ---

    // 1. KPI Data
    const { data: rawProjects } = await supabase
        .from("projects")
        .select("*")
        .eq("status", "active")
        .order("delivery_date", { ascending: true });

    const rawProjectIds = rawProjects?.map(p => p.id) || [];

    // Fetch project ids from production_orders to know which projects have parts
    const { data: rawActiveParts } = await supabase
        .from("production_orders")
        .select("project_id, genral_status")
        .in("project_id", rawProjectIds.length > 0 ? rawProjectIds : ['none']);

    // Filter out delivered or cancelled parts
    const activeParts = rawActiveParts?.filter((part: any) => {
        const s = (part.genral_status || "").toUpperCase();
        return !s.includes("D7-ENTREGADA") && !s.includes("D8-CANCELADA");
    }) || [];

    // Get set of project IDs that actually have PENDING parts
    const projectIdsWithParts = new Set(activeParts.map(p => p.project_id));

    // Filter projects to only those that have PENDING parts
    const projects = rawProjects?.filter(p => projectIdsWithParts.has(p.id)) || [];
    const totalProjects = projects.length;
    const totalParts = activeParts.length;

    // --- AGGREGATION FOR TOOLTIPS ---
    const projectsByCompany: Record<string, number> = {};
    const projectCompanyMap = new Map<string, string>();
    let overdueProjects = 0;

    projects.forEach(p => {
        const company = p.company || "Sin Asignar";
        projectsByCompany[company] = (projectsByCompany[company] || 0) + 1;
        projectCompanyMap.set(p.id, company);

        if (p.delivery_date) {
            const days = getDaysUntil(p.delivery_date);
            if (days < 0) overdueProjects++;
        }
    });

    const partsByCompany: Record<string, number> = {};
    const statusCounts: Record<string, number> = {};

    activeParts?.forEach((part: any) => {
        // Company Stats
        const company = projectCompanyMap.get(part.project_id) || "Desconocido";
        partsByCompany[company] = (partsByCompany[company] || 0) + 1;

        // Status Stats & Grouping
        const rawStatus = (part.genral_status || "").toUpperCase();
        let group = "Otros";

        if (rawStatus.startsWith("A")) {
            group = "Material / Ing.";
        } else if (rawStatus.startsWith("B") || rawStatus.startsWith("C") || rawStatus.includes("CORTE") || rawStatus.includes("MAQUINADO")) {
            // Check for Tratamiento specific if needed, but for now Group into Proceso
            if (rawStatus.includes("TRATAMIENTO")) {
                group = "Tratamiento";
            } else {
                group = "Maquinado / Proceso";
            }
        } else if (rawStatus.startsWith("D")) {
            if (rawStatus.includes("D8") || rawStatus.includes("CANCELADA")) {
                group = "Cancelado";
            } else {
                group = "Terminado / Entrega";
            }
        } else if (rawStatus.startsWith("E")) {
            group = "Garantía";
        }

        statusCounts[group] = (statusCounts[group] || 0) + 1;
    });

    const statusDistribution = Object.entries(statusCounts)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

    const upcomingProjects = projects?.filter(p => {
        if (!p.delivery_date) return false;
        const days = getDaysUntil(p.delivery_date);
        return days >= 0 && days <= 7;
    }) || [];

    const { data: newProjectsData, count: newThisMonth } = await supabase
        .from("projects")
        .select("company", { count: "exact" }) // Fetch company for tooltip
        .gte("created_at", startOfMonth);

    // --- MORE AGGREGATION ---
    const upcomingByCompany: Record<string, number> = {};
    upcomingProjects.forEach(p => {
        const company = p.company || "Sin Asignar";
        upcomingByCompany[company] = (upcomingByCompany[company] || 0) + 1;
    });

    const newByCompany: Record<string, number> = {};
    newProjectsData?.forEach(p => {
        const company = p.company || "Sin Asignar";
        newByCompany[company] = (newByCompany[company] || 0) + 1;
    });

    // 2. Chart Data: Utilization (Planning)
    const { data: planningTasks } = await supabase
        .from("planning")
        .select("*")
        .gte("planned_date", sevenDaysAgo.toISOString());

    const utilizationData = calculateUtilization(planningTasks || []);

    // 3. Chart Data: Project Trends
    const { data: trendProjects } = await supabase
        .from("projects")
        .select("start_date, delivery_date, status")
        .limit(10000); // Fetch all for clientside filtering to avoid missing deliveries
    // .gte("created_at", thirtyDaysAgo.toISOString());

    // Group Projects by Date
    const trendMap: Record<string, { new: number, delivered: number }> = {};

    // Init last 30 days
    for (let i = 0; i < 30; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        trendMap[dateStr] = { new: 0, delivered: 0 };
    }

    trendProjects?.forEach(p => {
        const sDate = p.start_date; // Use start_date for new projects
        if (sDate && trendMap[sDate]) trendMap[sDate].new++;

        const dDate = p.delivery_date;
        // Only count as delivered if status is completed
        if (dDate && trendMap[dDate] && p.status === 'completed') {
            trendMap[dDate].delivered++;
        }
    });

    const trendData = Object.entries(trendMap)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, counts]) => {
            // Fix timezone offset: Parse manually (YYYY-MM-DD)
            const [y, m, d] = date.split('-').map(Number);
            const localDate = new Date(y, m - 1, d);
            return {
                date: localDate.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }),
                newProjects: counts.new,
                deliveredProjects: counts.delivered
            };
        });


    // 4. Delivery List
    const deliveryList = projects
        ?.filter(p => p.delivery_date)
        .sort((a, b) => new Date(a.delivery_date!).getTime() - new Date(b.delivery_date!).getTime())
        .slice(0, 50);

    return (
        <div className="space-y-6">
            <RealtimeRefresher table="projects" />
            <RealtimeRefresher table="production_orders" />
            <DashboardClientHeader />

            {/* KPI Cards */}
            <div id="dash-kpi-cards" className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                {/* Proyectos Vencidos (New) */}
                <div className="p-6 rounded-xl border bg-card shadow-sm border-l-4 border-l-red-500">
                    <div className="flex justify-between items-start">
                        <div className="flex gap-2 items-center">
                            <h3 className="text-sm font-medium text-red-500">Vencidos</h3>
                        </div>
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                    </div>
                    <div className="text-3xl font-bold mt-2 text-red-600">{overdueProjects}</div>
                </div>

                {/* Proyectos Activos */}
                <div className="p-6 rounded-xl border bg-card shadow-sm relative group">
                    <div className="flex justify-between items-start">
                        <div className="flex gap-2 items-center">
                            <h3 className="text-sm font-medium text-muted-foreground">Proyectos Activos</h3>
                            {/* Tooltip Trigger */}
                            <div className="hidden group-hover:block absolute top-full left-0 mt-2 z-50 w-full p-3 bg-popover text-popover-foreground border rounded-md shadow-lg text-xs animate-in fade-in zoom-in-95 duration-200">
                                <div className="font-semibold mb-2 border-b pb-1">Desglose por Empresa</div>
                                <div className="space-y-1 max-h-48 overflow-y-auto">
                                    {Object.entries(projectsByCompany)
                                        .sort(([, a], [, b]) => b - a)
                                        .map(([company, count]) => (
                                            <div key={company} className="flex justify-between items-center">
                                                <span className="truncate pr-2 text-muted-foreground">{company}</span>
                                                <span className="font-mono font-medium">{count}</span>
                                            </div>
                                        ))}
                                </div>
                            </div>
                        </div>
                        <FolderKanban className="w-4 h-4 text-primary" />
                    </div>
                    <div className="text-3xl font-bold mt-2">{totalProjects || 0}</div>
                </div>

                {/* Partidas Activas */}
                <div className="p-6 rounded-xl border bg-card shadow-sm relative group">
                    <div className="flex justify-between items-start">
                        <div className="flex gap-2 items-center">
                            <h3 className="text-sm font-medium text-muted-foreground">Partidas Activas</h3>
                            {/* Tooltip Trigger */}
                            <div className="hidden group-hover:block absolute top-full left-0 mt-2 z-50 w-full p-3 bg-popover text-popover-foreground border rounded-md shadow-lg text-xs animate-in fade-in zoom-in-95 duration-200">
                                <div className="font-semibold mb-2 border-b pb-1">Desglose por Empresa</div>
                                <div className="space-y-1 max-h-48 overflow-y-auto">
                                    {Object.entries(partsByCompany)
                                        .sort(([, a], [, b]) => b - a)
                                        .map(([company, count]) => (
                                            <div key={company} className="flex justify-between items-center">
                                                <span className="truncate pr-2 text-muted-foreground">{company}</span>
                                                <span className="font-mono font-medium">{count}</span>
                                            </div>
                                        ))}
                                </div>
                            </div>
                        </div>
                        <Package className="w-4 h-4 text-blue-500" />
                    </div>
                    <div className="text-3xl font-bold mt-2">{totalParts || 0}</div>
                </div>

                {/* Entregas Próximas */}
                <div className="p-6 rounded-xl border bg-card shadow-sm relative group">
                    <div className="flex justify-between items-start">
                        <div className="flex gap-2 items-center">
                            <h3 className="text-sm font-medium text-muted-foreground">Entregas (7 días)</h3>
                            {/* Tooltip Trigger */}
                            <div className="hidden group-hover:block absolute top-full left-0 mt-2 z-50 w-full p-3 bg-popover text-popover-foreground border rounded-md shadow-lg text-xs animate-in fade-in zoom-in-95 duration-200">
                                <div className="font-semibold mb-2 border-b pb-1">Desglose por Empresa</div>
                                <div className="space-y-1 max-h-48 overflow-y-auto">
                                    {Object.entries(upcomingByCompany)
                                        .sort(([, a], [, b]) => b - a)
                                        .map(([company, count]) => (
                                            <div key={company} className="flex justify-between items-center">
                                                <span className="truncate pr-2 text-muted-foreground">{company}</span>
                                                <span className="font-mono font-medium">{count}</span>
                                            </div>
                                        ))}
                                </div>
                            </div>
                        </div>
                        <CalendarClock className="w-4 h-4 text-orange-500" />
                    </div>
                    <div className="text-3xl font-bold mt-2">{upcomingProjects.length}</div>
                </div>

                {/* Nuevos (Mes) */}
                <div className="p-6 rounded-xl border bg-card shadow-sm relative group">
                    <div className="flex justify-between items-start">
                        <div className="flex gap-2 items-center">
                            <h3 className="text-sm font-medium text-muted-foreground">Nuevos (Mes)</h3>
                            {/* Tooltip Trigger */}
                            <div className="hidden group-hover:block absolute top-full left-0 mt-2 z-50 w-full p-3 bg-popover text-popover-foreground border rounded-md shadow-lg text-xs animate-in fade-in zoom-in-95 duration-200">
                                <div className="font-semibold mb-2 border-b pb-1">Desglose por Empresa</div>
                                <div className="space-y-1 max-h-48 overflow-y-auto">
                                    {Object.entries(newByCompany)
                                        .sort(([, a], [, b]) => b - a)
                                        .map(([company, count]) => (
                                            <div key={company} className="flex justify-between items-center">
                                                <span className="truncate pr-2 text-muted-foreground">{company}</span>
                                                <span className="font-mono font-medium">{count}</span>
                                            </div>
                                        ))}
                                </div>
                            </div>
                        </div>
                        <TrendingUp className="w-4 h-4 text-green-500" />
                    </div>
                    <div className="text-3xl font-bold mt-2">{newThisMonth || 0}</div>
                </div>
            </div>

            {/* CHARTS SECTION */}
            <div className="grid gap-6 md:grid-cols-2">
                {/* Utilization Chart */}
                <div id="dash-chart-utilization" className="rounded-xl border bg-card shadow-sm p-6">
                    <div className="flex items-center gap-2 mb-6">
                        <BarChart3 className="w-5 h-5 text-muted-foreground" />
                        <div>
                            <h3 className="text-lg font-semibold">Utilización</h3>
                            <p className="text-xs text-muted-foreground">Últimos 7 días • Turno 16h</p>
                        </div>
                    </div>
                    <UtilizationChart data={utilizationData} />
                </div>

                {/* Status Distribution Chart (New) */}
                <div id="dash-chart-status" className="rounded-xl border bg-card shadow-sm p-6">
                    <div className="flex items-center gap-2 mb-6">
                        <PieChart className="w-5 h-5 text-muted-foreground" />
                        <div>
                            <h3 className="text-lg font-semibold">Estatus Partidas</h3>
                            <p className="text-xs text-muted-foreground">Distribución actual</p>
                        </div>
                    </div>
                    <ItemsStatusChart data={statusDistribution} />
                </div>

                {/* Trends Chart */}
                <div id="dash-chart-trends" className="rounded-xl border bg-card shadow-sm p-6 md:col-span-2">
                    <div className="flex items-center gap-2 mb-6">
                        <LineChart className="w-5 h-5 text-muted-foreground" />
                        <div>
                            <h3 className="text-lg font-semibold">Flujo</h3>
                            <p className="text-xs text-muted-foreground">30 días</p>
                        </div>
                    </div>
                    <ProjectsTrendChart data={trendData} />
                </div>
            </div>

            {/* Upcoming Deliveries List */}
            <div id="dash-deliveries-list" className="rounded-xl border bg-card shadow-sm">
                <div className="p-6 border-b">
                    <h3 className="text-lg font-semibold">Próximas Entregas</h3>
                </div>
                {deliveryList && deliveryList.length > 0 ? (
                    <div className="divide-y">
                        {deliveryList.map((project) => {
                            const daysUntil = project.delivery_date ? getDaysUntil(project.delivery_date) : null;
                            return (
                                <div key={project.id} className="p-4 hover:bg-muted/50 transition-colors">
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono text-sm font-semibold text-primary">
                                                    {project.code}
                                                </span>
                                                <span className="text-sm text-muted-foreground truncate">
                                                    {project.name}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                                <span>{project.company}</span>
                                                <span>•</span>
                                                <span>
                                                    {new Date(project.delivery_date!).toLocaleDateString('es-MX', {
                                                        day: 'numeric', month: 'short'
                                                    })}
                                                </span>
                                            </div>
                                        </div>
                                        {daysUntil !== null && <UrgencyBadge days={daysUntil} />}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="p-8 text-center text-muted-foreground">No hay entregas próximas</div>
                )}
            </div>
        </div>
    );
}
