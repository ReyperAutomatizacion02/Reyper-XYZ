import { type GanttPlanningTask } from "../types";

export interface PlanningAlert {
    type: "OVERLAP" | "MISSING_OPERATOR";
    task: GanttPlanningTask;
    details: string;
}

export interface OrderStatus {
    order: import("@/lib/scheduling-utils").OrderWithRelations;
    isLate: boolean;
    lastEnd: Date;
    deliveryDate: Date | null;
    diffDays: number | null;
}
