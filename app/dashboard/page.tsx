import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import {
    FolderKanban,
    Package,
    CalendarClock,
    TrendingUp,
    AlertTriangle,
    Clock,
    CheckCircle2,
    BarChart3,
    LineChart
} from "lucide-react";
import { UtilizationChart, ProjectsTrendChart } from "./charts";

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
    const { data: projects, count: totalProjects } = await supabase
        .from("projects")
        .select("*", { count: "exact" })
        .eq("status", "active")
        .order("delivery_date", { ascending: true });

    const projectIds = projects?.map(p => p.id) || [];
    const { count: totalParts } = await supabase
        .from("production_orders")
        .select("*", { count: "exact", head: true })
        .in("project_id", projectIds.length > 0 ? projectIds : ['none']);

    const upcomingProjects = projects?.filter(p => {
        if (!p.delivery_date) return false;
        const days = getDaysUntil(p.delivery_date);
        return days >= 0 && days <= 7;
    }) || [];

    const { count: newThisMonth } = await supabase
        .from("projects")
        .select("*", { count: "exact", head: true })
        .gte("created_at", startOfMonth);

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
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
                <p className="text-muted-foreground">Resumen general de productividad y proyectos</p>
            </div>

            {/* KPI Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="p-6 rounded-xl border bg-card shadow-sm">
                    <div className="flex justify-between">
                        <h3 className="text-sm font-medium text-muted-foreground">Proyectos Activos</h3>
                        <FolderKanban className="w-4 h-4 text-primary" />
                    </div>
                    <div className="text-3xl font-bold mt-2">{totalProjects || 0}</div>
                </div>
                <div className="p-6 rounded-xl border bg-card shadow-sm">
                    <div className="flex justify-between">
                        <h3 className="text-sm font-medium text-muted-foreground">Partidas Totales</h3>
                        <Package className="w-4 h-4 text-blue-500" />
                    </div>
                    <div className="text-3xl font-bold mt-2">{totalParts || 0}</div>
                </div>
                <div className="p-6 rounded-xl border bg-card shadow-sm">
                    <div className="flex justify-between">
                        <h3 className="text-sm font-medium text-muted-foreground">Entregas Próximas</h3>
                        <CalendarClock className="w-4 h-4 text-orange-500" />
                    </div>
                    <div className="text-3xl font-bold mt-2">{upcomingProjects.length}</div>
                </div>
                <div className="p-6 rounded-xl border bg-card shadow-sm">
                    <div className="flex justify-between">
                        <h3 className="text-sm font-medium text-muted-foreground">Nuevos (Mes)</h3>
                        <TrendingUp className="w-4 h-4 text-green-500" />
                    </div>
                    <div className="text-3xl font-bold mt-2">{newThisMonth || 0}</div>
                </div>
            </div>

            {/* CHARTS SECTION */}
            <div className="grid gap-6 md:grid-cols-2">
                {/* Utilization Chart */}
                <div className="rounded-xl border bg-card shadow-sm p-6">
                    <div className="flex items-center gap-2 mb-6">
                        <BarChart3 className="w-5 h-5 text-muted-foreground" />
                        <div>
                            <h3 className="text-lg font-semibold">Utilización de Maquinaria</h3>
                            <p className="text-xs text-muted-foreground">Últimos 7 días • Turno 16h</p>
                        </div>
                    </div>
                    <UtilizationChart data={utilizationData} />
                </div>

                {/* Trends Chart */}
                <div className="rounded-xl border bg-card shadow-sm p-6">
                    <div className="flex items-center gap-2 mb-6">
                        <LineChart className="w-5 h-5 text-muted-foreground" />
                        <div>
                            <h3 className="text-lg font-semibold">Flujo de Proyectos</h3>
                            <p className="text-xs text-muted-foreground">Entradas vs Salidas (30 días)</p>
                        </div>
                    </div>
                    <ProjectsTrendChart data={trendData} />
                </div>
            </div>

            {/* Upcoming Deliveries List */}
            <div className="rounded-xl border bg-card shadow-sm">
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
