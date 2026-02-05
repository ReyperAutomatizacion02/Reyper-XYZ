"use client";

import React from "react";
import { DashboardHeader } from "@/components/dashboard-header";
import { LayoutDashboard } from "lucide-react";
import { useTour } from "@/hooks/use-tour";

export function DashboardClientHeader() {
    const { startTour } = useTour();

    const handleStartTour = () => {
        startTour([
            {
                element: "#dash-header",
                popover: {
                    title: "Dashboard Principal",
                    description: "Bienvenido al centro de control de Reyper XYZ. Aquí encontrarás un resumen de la productividad y el estado global de los proyectos.",
                    side: "bottom",
                    align: "start"
                }
            },
            {
                element: "#dash-kpi-cards",
                popover: {
                    title: "Indicadores Clave (KPIs)",
                    description: "Monitorea proyectos vencidos, partidas en curso y las metas del mes actual de un vistazo.",
                    side: "bottom",
                    align: "center"
                }
            },
            {
                element: "#dash-chart-utilization",
                popover: {
                    title: "Utilización de Máquinas",
                    description: "Visualiza la eficiencia de cada máquina en los últimos 7 días. Los datos se calculan automáticamente basados en la planeación.",
                    side: "top",
                    align: "center"
                }
            },
            {
                element: "#dash-chart-status",
                popover: {
                    title: "Estatus de Partidas",
                    description: "Distribución actual de todas las piezas en proceso, desde ingeniería hasta entrega.",
                    side: "top",
                    align: "center"
                }
            },
            {
                element: "#dash-chart-trends",
                popover: {
                    title: "Flujo de Proyectos",
                    description: "Tendencia histórica (30 días) de proyectos nuevos vs. entregados para medir el ritmo de trabajo.",
                    side: "top",
                    align: "center"
                }
            },
            {
                element: "#dash-deliveries-list",
                popover: {
                    title: "Próximas Entregas",
                    description: "Listado prioritario de proyectos con fecha de entrega cercana. Los colores indican el nivel de urgencia.",
                    side: "top",
                    align: "center"
                }
            }
        ]);
    };

    return (
        <div id="dash-header">
            <DashboardHeader
                title="Dashboard"
                description="Resumen general de productividad y proyectos"
                icon={<LayoutDashboard className="w-8 h-8 text-primary" />}
                bgClass="bg-primary/10"
                onHelp={handleStartTour}
            />
        </div>
    );
}
