"use client";

import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";

export interface TourStep {
    element: string;
    popover: {
        title: string;
        description: string;
        side?: "left" | "right" | "top" | "bottom";
        align?: "start" | "center" | "end";
    };
    padding?: number;
    onHighlightStarted?: (element?: Element, step?: any) => void;
    onDeselected?: (element?: Element, step?: any) => void;
    [key: string]: any;
}

export function useTour() {
    const { theme } = useTheme();
    const driverObj = useRef<any>(null);

    const startTour = (steps: TourStep[], onFinish?: () => void) => {
        const isDark = theme === 'dark';

        driverObj.current = driver({
            showProgress: true,
            animate: true,
            steps: steps.map(step => ({
                element: step.element,
                padding: step.padding,
                popover: {
                    title: step.popover.title,
                    description: step.popover.description,
                    side: step.popover.side,
                    align: step.popover.align,
                },
                onHighlightStarted: step.onHighlightStarted,
                onDeselected: step.onDeselected,
            })),
            prevBtnText: "Anterior",
            nextBtnText: "Siguiente",
            doneBtnText: "Finalizar",
            progressText: "Paso {{current}} de {{total}}",

            popoverClass: isDark ? "driverjs-theme-dark" : "driverjs-theme-light",

            onDestroyed: () => {
                if (onFinish) onFinish();
            }
        });

        driverObj.current.drive();
    };

    return { startTour, driverObj };
}
