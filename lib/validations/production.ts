import { z } from "zod";

// --- Planning task schemas ---

export const UpdateTaskScheduleSchema = z.object({
    taskId: z.string().uuid("ID de tarea inválido"),
    start: z.string().min(1, "La fecha de inicio es obligatoria"),
    end: z.string().min(1, "La fecha de fin es obligatoria"),
});

export const ScheduleNewTaskSchema = z.object({
    orderId: z.string().uuid("ID de orden inválido"),
    machineId: z.string().uuid("ID de máquina inválido"),
    start: z.string().min(1, "La fecha de inicio es obligatoria"),
    durationHours: z.number().positive("La duración debe ser mayor a 0").default(2),
});

export const CreatePlanningTaskSchema = z.object({
    orderId: z.string().uuid("ID de orden inválido"),
    machine: z.string().min(1, "La máquina es obligatoria"),
    start: z.string().min(1, "La fecha de inicio es obligatoria"),
    end: z.string().min(1, "La fecha de fin es obligatoria"),
    operator: z.string().max(200).optional(),
});

export const UpdateTaskDetailsSchema = z.object({
    taskId: z.string().uuid("ID de tarea inválido"),
    orderId: z.string().uuid("ID de orden inválido"),
    machine: z.string().min(1, "La máquina es obligatoria"),
    start: z.string().min(1, "La fecha de inicio es obligatoria"),
    end: z.string().min(1, "La fecha de fin es obligatoria"),
    operator: z.string().max(200).optional(),
});

export const TaskIdSchema = z.object({
    taskId: z.string().uuid("ID de tarea inválido"),
});

export const ToggleTaskLockedSchema = z.object({
    taskId: z.string().uuid("ID de tarea inválido"),
    locked: z.boolean(),
});

export const OrderIdSchema = z.object({
    orderId: z.string().uuid("ID de orden inválido"),
});

// --- Batch planning schemas ---

const PlanningTaskPayload = z.object({
    order_id: z.string().uuid(),
    machine: z.string().min(1),
    planned_date: z.string().min(1),
    planned_end: z.string().min(1),
    operator: z.string().nullable().optional(),
});

const PlanningTaskUpdatePayload = PlanningTaskPayload.extend({
    id: z.string().uuid(),
});

export const BatchSavePlanningSchema = z.object({
    draftTasks: z.array(PlanningTaskPayload),
    changedTasks: z.array(PlanningTaskUpdatePayload),
});

// --- Scenario schemas ---

export const SaveScenarioSchema = z.object({
    name: z.string().min(1, "El nombre es obligatorio").max(200),
    strategy: z.string().min(1, "La estrategia es obligatoria"),
    config: z.record(z.string(), z.unknown()),
    tasks: z.array(z.record(z.string(), z.unknown())),
    skipped: z.array(z.record(z.string(), z.unknown())),
    metrics: z.record(z.string(), z.unknown()),
});

export const ScenarioIdSchema = z.object({
    scenarioId: z.string().uuid("ID de escenario inválido"),
});

// --- Machine schemas ---

export const UpsertMachineSchema = z.object({
    id: z.string().uuid().optional(),
    name: z.string().min(1, "El nombre es obligatorio").max(200).trim(),
    brand: z.string().max(200).trim().nullable().optional(),
    model: z.string().max(200).trim().nullable().optional(),
    serial_number: z.string().max(100).trim().nullable().optional(),
    location: z.string().max(200).trim().nullable().optional(),
    is_active: z.boolean().default(true),
    cover_image_url: z.string().url().nullable().optional(),
});

export const MachineIdSchema = z.object({
    id: z.string().uuid("ID de máquina inválido"),
});

export const SetMachineCoverImageSchema = z.object({
    machineId: z.string().uuid("ID de máquina inválido"),
    imageUrl: z.string().url("URL inválida").nullable(),
});
