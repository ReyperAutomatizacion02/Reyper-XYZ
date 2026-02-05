"use client";

import React from "react";
import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTour } from "@/hooks/use-tour";
import { usePathname, useRouter } from "next/navigation";

export function GeneralTour() {
    const { startTour } = useTour();
    const pathname = usePathname();
    const router = useRouter();

    const handleStartGeneralTour = () => {
        // Steps for the general tour
        const steps = [
            {
                element: "#app-sidebar",
                popover: {
                    title: "Panel de Navegación",
                    description: "Esta es la barra lateral principal. Desde aquí puedes moverte entre los diferentes departamentos de la empresa.",
                    side: "right" as const,
                    align: "start" as const
                }
            },
            {
                element: "#sidebar-nav",
                popover: {
                    title: "Áreas de la Empresa",
                    description: "Accede a Producción, Ventas, Almacén, Diseño y más. Cada área tiene sus propias herramientas especializadas.",
                    side: "right" as const,
                    align: "center" as const
                }
            },
            {
                element: "#page-header",
                popover: {
                    title: "Título de la Sección",
                    description: "Aquí verás siempre dónde te encuentras. Este título y su descripción cambian dinámicamente según el módulo que estés usando.",
                    side: "bottom" as const,
                    align: "start" as const
                }
            },
            {
                element: "#navbar-user-info",
                popover: {
                    title: "Identidad",
                    description: "Para tu seguridad, aquí siempre podrás confirmar qué usuario está operando la plataforma en este momento.",
                    side: "bottom" as const,
                    align: "end" as const
                }
            },
            {
                element: ".lucide-sun, .lucide-moon",
                popover: {
                    title: "Apariencia",
                    description: "Cambia entre el modo claro y oscuro en cualquier momento para trabajar con mayor comodidad.",
                    side: "bottom" as const,
                    align: "end" as const
                }
            },
            {
                popover: {
                    title: "Sincronización Total ⚡",
                    description: "Lo más importante: Reyper XYZ vive en tiempo real. Cualquier cambio realizado por tus compañeros aparecerá en tu pantalla al instante, sin necesidad de refrescar la página.",
                    side: "bottom" as const,
                    align: "center" as const
                }
            }
        ];

        // If not on dashboard, we might want to suggest going there for a better experience
        // but for now let's keep it universal as IDs are present everywhere layout is used.
        startTour(steps);
    };

    return (
        <Button
            variant="ghost"
            size="icon"
            onClick={handleStartGeneralTour}
            className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
            title="Tour General de la Plataforma"
        >
            <HelpCircle className="w-5 h-5" />
            <span className="sr-only">Ayuda General</span>
        </Button>
    );
}
