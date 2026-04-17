import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Database } from "@/utils/supabase/types";

type PlanningRow = Database["public"]["Tables"]["planning"]["Row"];

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
    PieChart,
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
            <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-semibold text-red-500">
                <AlertTriangle className="h-3 w-3" />
                Vencido ({Math.abs(days)}d)
            </span>
        );
    }
    if (days <= 3) {
        return (
            <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/10 px-2 py-0.5 text-xs font-semibold text-orange-500">
                <Clock className="h-3 w-3" />
                {days === 0 ? "Hoy" : `${days}d restantes`}
            </span>
        );
    }
    if (days <= 7) {
        return (
            <span className="inline-flex items-center gap-1 rounded-full bg-yellow-500/10 px-2 py-0.5 text-xs font-semibold text-yellow-500">
                <Clock className="h-3 w-3" />
                {days}d restantes
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-semibold text-green-500">
            <CheckCircle2 className="h-3 w-3" />
            {days}d restantes
        </span>
    );
}

// --- DATA PROCESSING HELPERS ---

// Calculate Machine Utilization (Strict Lane 1 Logic)
type UtilizationTask = Pick<PlanningRow, "machine" | "planned_date" | "planned_end">;

function calculateUtilization(tasks: UtilizationTask[]) {
    const SHIFT_START = 6;
    const SHIFT_END = 22;
    const SHIFT_HOURS = 16;
    const DAYS_TO_ANALYZE = 7;
    const TOTAL_CAPACITY = SHIFT_HOURS * DAYS_TO_ANALYZE;

    const machines: Record<string, { hours: number; efficiency: number }> = {};

    // Group by machine
    const tasksByMachine = tasks.reduce(
        (acc, task) => {
            const m = task.machine || "Sin Máquina";
            if (!acc[m]) acc[m] = [];
            acc[m].push(task);
            return acc;
        },
        {} as Record<string, UtilizationTask[]>
    );

    Object.entries(tasksByMachine).forEach(([machine, tasks]) => {
        const machineTasks = tasks;
        let occupiedHours = 0;

        // Sort tasks strictly by time
        const sortedTasks = machineTasks.sort(
            (a, b) => new Date(a.planned_date ?? "").getTime() - new Date(b.planned_date ?? "").getTime()
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
            const dailyTasks = sortedTasks.filter((t) => {
                const tStart = new Date(t.planned_date ?? "");
                const tEnd = new Date(t.planned_end ?? "");
                return tStart < dayEnd && tEnd > dayStart;
            });

            dailyTasks.forEach((task) => {
                const tStart = new Date(task.planned_date ?? "");
                const tEnd = new Date(task.planned_end ?? "");
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
            efficiency: data.efficiency,
        }))
        .sort((a, b) => b.efficiency - a.efficiency);
}

export default async function DashboardPage() {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    // Date ranges for charts
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // --- FETCH DATA ---

    // 1. KPI Data - Optimized combined query
    const { data: projectsWithOrders } = await supabase
        .from("projects")
        .select(
            `
            *,
            production_orders(project_id, general_status)
        `
        )
        .eq("status", "active")
        .order("delivery_date", { ascending: true });

    // Filter projects and extract active parts in one pass
    const projects = [];
    const activeParts: { project_id: string | null; general_status: string | null }[] = [];

    if (projectsWithOrders) {
        for (const pj of projectsWithOrders) {
            const parts = pj.production_orders || [];
            const pjActiveParts = parts.filter((part) => {
                const s = (part.general_status || "").toUpperCase();
                return !s.includes("D7-ENTREGADA") && !s.includes("D8-CANCELADA");
            });

            if (pjActiveParts.length > 0) {
                projects.push(pj);
                activeParts.push(...pjActiveParts);
            }
        }
    }

    const totalProjects = projects.length;
    const totalParts = activeParts.length;

    // --- AGGREGATION FOR TOOLTIPS ---
    const projectsByCompany: Record<string, number> = {};
    const projectCompanyMap = new Map<string, string>();
    let overdueProjects = 0;

    projects.forEach((p) => {
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
        const rawStatus = (part.general_status || "").toUpperCase();
        let group = "Otros";

        if (rawStatus.startsWith("A")) {
            group = "Material / Ing.";
        } else if (
            rawStatus.startsWith("B") ||
            rawStatus.startsWith("C") ||
            rawStatus.includes("CORTE") ||
            rawStatus.includes("MAQUINADO")
        ) {
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

    const upcomingProjects =
        projects?.filter((p) => {
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
    upcomingProjects.forEach((p) => {
        const company = p.company || "Sin Asignar";
        upcomingByCompany[company] = (upcomingByCompany[company] || 0) + 1;
    });

    const newByCompany: Record<string, number> = {};
    newProjectsData?.forEach((p) => {
        const company = p.company || "Sin Asignar";
        newByCompany[company] = (newByCompany[company] || 0) + 1;
    });

    // 2. Chart Data: Utilization (Planning)
    const { data: planningTasks } = await supabase
        .from("planning")
        .select("machine, planned_date, planned_end")
        .gte("planned_date", sevenDaysAgo.toISOString());

    const utilizationData = calculateUtilization(planningTasks || []);

    // 3. Chart Data: Project Trends
    // We want the last 30 days including today in local time
    const trendMap: Record<string, { new: number; delivered: number }> = {};
    const nowLocal = new Date();
    // Start at today at 00:00:00 local
    const baseDate = new Date(nowLocal.getFullYear(), nowLocal.getMonth(), nowLocal.getDate());

    const getFormatted = (d: Date) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
    };

    for (let i = 0; i < 30; i++) {
        const d = new Date(baseDate.getTime());
        d.setDate(d.getDate() - i);
        trendMap[getFormatted(d)] = { new: 0, delivered: 0 };
    }

    const thirtyDaysAgoStr = getFormatted(new Date(baseDate.getTime() - 31 * 24 * 60 * 60 * 1000));

    const { data: trendProjects } = await supabase
        .from("projects")
        .select("start_date, delivery_date, status")
        .or(`start_date.gte.${thirtyDaysAgoStr},delivery_date.gte.${thirtyDaysAgoStr}`);

    trendProjects?.forEach((p) => {
        // start_date and delivery_date from Supabase's DATE column are 'YYYY-MM-DD' strings
        if (p.start_date && trendMap[p.start_date] !== undefined) {
            trendMap[p.start_date].new++;
        }

        if (p.delivery_date && p.status === "completed" && trendMap[p.delivery_date] !== undefined) {
            trendMap[p.delivery_date].delivered++;
        }
    });

    const trendData = Object.entries(trendMap)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([dateKey, counts]) => {
            const [y, m, d] = dateKey.split("-").map(Number);
            const localDate = new Date(y, m - 1, d);
            return {
                date: localDate.toLocaleDateString("es-MX", { day: "2-digit", month: "short" }),
                newProjects: counts.new,
                deliveredProjects: counts.delivered,
            };
        });

    // 4. Delivery List
    const deliveryList = projects
        ?.filter((p) => p.delivery_date)
        .sort((a, b) => new Date(a.delivery_date!).getTime() - new Date(b.delivery_date!).getTime())
        .slice(0, 50);

    return (
        <div className="space-y-6">
            <RealtimeRefresher tables={["projects", "production_orders"]} />
            <DashboardClientHeader />

            {/* KPI Cards */}
            <div id="dash-kpi-cards" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                {/* Proyectos Vencidos (New) */}
                <div className="rounded-xl border border-l-4 border-l-red-500 bg-card p-6 shadow-sm">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                            <h3 className="text-sm font-medium text-red-500">Vencidos</h3>
                        </div>
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                    </div>
                    <div className="mt-2 text-3xl font-bold text-red-600">{overdueProjects}</div>
                </div>

                {/* Proyectos Activos */}
                <div className="group relative rounded-xl border bg-card p-6 shadow-sm">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                            <h3 className="text-sm font-medium text-muted-foreground">Proyectos Activos</h3>
                            {/* Tooltip Trigger */}
                            <div className="absolute left-0 top-full z-50 mt-2 hidden w-full rounded-md border bg-popover p-3 text-xs text-popover-foreground shadow-lg duration-200 animate-in fade-in zoom-in-95 group-hover:block">
                                <div className="mb-2 border-b pb-1 font-semibold">Desglose por Empresa</div>
                                <div className="max-h-48 space-y-1 overflow-y-auto">
                                    {Object.entries(projectsByCompany)
                                        .sort(([, a], [, b]) => b - a)
                                        .map(([company, count]) => (
                                            <div key={company} className="flex items-center justify-between">
                                                <span className="truncate pr-2 text-muted-foreground">{company}</span>
                                                <span className="font-mono font-medium">{count}</span>
                                            </div>
                                        ))}
                                </div>
                            </div>
                        </div>
                        <FolderKanban className="h-4 w-4 text-primary" />
                    </div>
                    <div className="mt-2 text-3xl font-bold">{totalProjects || 0}</div>
                </div>

                {/* Partidas Activas */}
                <div className="group relative rounded-xl border bg-card p-6 shadow-sm">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                            <h3 className="text-sm font-medium text-muted-foreground">Partidas Activas</h3>
                            {/* Tooltip Trigger */}
                            <div className="absolute left-0 top-full z-50 mt-2 hidden w-full rounded-md border bg-popover p-3 text-xs text-popover-foreground shadow-lg duration-200 animate-in fade-in zoom-in-95 group-hover:block">
                                <div className="mb-2 border-b pb-1 font-semibold">Desglose por Empresa</div>
                                <div className="max-h-48 space-y-1 overflow-y-auto">
                                    {Object.entries(partsByCompany)
                                        .sort(([, a], [, b]) => b - a)
                                        .map(([company, count]) => (
                                            <div key={company} className="flex items-center justify-between">
                                                <span className="truncate pr-2 text-muted-foreground">{company}</span>
                                                <span className="font-mono font-medium">{count}</span>
                                            </div>
                                        ))}
                                </div>
                            </div>
                        </div>
                        <Package className="h-4 w-4 text-blue-500" />
                    </div>
                    <div className="mt-2 text-3xl font-bold">{totalParts || 0}</div>
                </div>

                {/* Entregas Próximas */}
                <div className="group relative rounded-xl border bg-card p-6 shadow-sm">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                            <h3 className="text-sm font-medium text-muted-foreground">Entregas (7 días)</h3>
                            {/* Tooltip Trigger */}
                            <div className="absolute left-0 top-full z-50 mt-2 hidden w-full rounded-md border bg-popover p-3 text-xs text-popover-foreground shadow-lg duration-200 animate-in fade-in zoom-in-95 group-hover:block">
                                <div className="mb-2 border-b pb-1 font-semibold">Desglose por Empresa</div>
                                <div className="max-h-48 space-y-1 overflow-y-auto">
                                    {Object.entries(upcomingByCompany)
                                        .sort(([, a], [, b]) => b - a)
                                        .map(([company, count]) => (
                                            <div key={company} className="flex items-center justify-between">
                                                <span className="truncate pr-2 text-muted-foreground">{company}</span>
                                                <span className="font-mono font-medium">{count}</span>
                                            </div>
                                        ))}
                                </div>
                            </div>
                        </div>
                        <CalendarClock className="h-4 w-4 text-orange-500" />
                    </div>
                    <div className="mt-2 text-3xl font-bold">{upcomingProjects.length}</div>
                </div>

                {/* Nuevos (Mes) */}
                <div className="group relative rounded-xl border bg-card p-6 shadow-sm">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                            <h3 className="text-sm font-medium text-muted-foreground">Nuevos (Mes)</h3>
                            {/* Tooltip Trigger */}
                            <div className="absolute left-0 top-full z-50 mt-2 hidden w-full rounded-md border bg-popover p-3 text-xs text-popover-foreground shadow-lg duration-200 animate-in fade-in zoom-in-95 group-hover:block">
                                <div className="mb-2 border-b pb-1 font-semibold">Desglose por Empresa</div>
                                <div className="max-h-48 space-y-1 overflow-y-auto">
                                    {Object.entries(newByCompany)
                                        .sort(([, a], [, b]) => b - a)
                                        .map(([company, count]) => (
                                            <div key={company} className="flex items-center justify-between">
                                                <span className="truncate pr-2 text-muted-foreground">{company}</span>
                                                <span className="font-mono font-medium">{count}</span>
                                            </div>
                                        ))}
                                </div>
                            </div>
                        </div>
                        <TrendingUp className="h-4 w-4 text-green-500" />
                    </div>
                    <div className="mt-2 text-3xl font-bold">{newThisMonth || 0}</div>
                </div>
            </div>

            {/* CHARTS SECTION */}
            <div className="grid gap-6 md:grid-cols-2">
                {/* Utilization Chart */}
                <div id="dash-chart-utilization" className="rounded-xl border bg-card p-6 shadow-sm">
                    <div className="mb-6 flex items-center gap-2">
                        <BarChart3 className="h-5 w-5 text-muted-foreground" />
                        <div>
                            <h3 className="text-lg font-semibold">Utilización</h3>
                            <p className="text-xs text-muted-foreground">Últimos 7 días • Turno 16h</p>
                        </div>
                    </div>
                    <UtilizationChart data={utilizationData} />
                </div>

                {/* Status Distribution Chart (New) */}
                <div id="dash-chart-status" className="rounded-xl border bg-card p-6 shadow-sm">
                    <div className="mb-6 flex items-center gap-2">
                        <PieChart className="h-5 w-5 text-muted-foreground" />
                        <div>
                            <h3 className="text-lg font-semibold">Estatus Partidas</h3>
                            <p className="text-xs text-muted-foreground">Distribución actual</p>
                        </div>
                    </div>
                    <ItemsStatusChart data={statusDistribution} />
                </div>

                {/* Trends Chart */}
                <div id="dash-chart-trends" className="rounded-xl border bg-card p-6 shadow-sm md:col-span-2">
                    <div className="mb-6 flex items-center gap-2">
                        <LineChart className="h-5 w-5 text-muted-foreground" />
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
                <div className="border-b p-6">
                    <h3 className="text-lg font-semibold">Próximas Entregas</h3>
                </div>
                {deliveryList && deliveryList.length > 0 ? (
                    <div className="divide-y">
                        {deliveryList.map((project) => {
                            const daysUntil = project.delivery_date ? getDaysUntil(project.delivery_date) : null;
                            return (
                                <div key={project.id} className="p-4 transition-colors hover:bg-muted/50">
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono text-sm font-semibold text-primary">
                                                    {project.code}
                                                </span>
                                                <span className="truncate text-sm text-muted-foreground">
                                                    {project.name}
                                                </span>
                                            </div>
                                            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                                                <span>{project.company}</span>
                                                <span>•</span>
                                                <span>
                                                    {new Date(project.delivery_date!).toLocaleDateString("es-MX", {
                                                        day: "numeric",
                                                        month: "short",
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
