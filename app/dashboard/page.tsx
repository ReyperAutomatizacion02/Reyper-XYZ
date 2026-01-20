export default function DashboardPage() {
    return (
        <div className="space-y-6">
            <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="p-6 rounded-xl border bg-card text-card-foreground shadow-sm">
                    <h3 className="tracking-tight text-sm font-medium">Proyectos Activos</h3>
                    <div className="text-2xl font-bold mt-2">12</div>
                    <p className="text-xs text-muted-foreground mt-1">+2 desde el mes pasado</p>
                </div>
                <div className="p-6 rounded-xl border bg-card text-card-foreground shadow-sm">
                    <h3 className="tracking-tight text-sm font-medium">Cotizaciones Pendientes</h3>
                    <div className="text-2xl font-bold mt-2">5</div>
                    <p className="text-xs text-muted-foreground mt-1">Requieren atención</p>
                </div>
                {/* More placeholders */}
            </div>

            <div className="h-[400px] rounded-xl border bg-card shadow-sm flex items-center justify-center text-muted-foreground">
                Área para gráficos de productividad
            </div>
        </div>
    );
}
