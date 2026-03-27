import { z } from "zod";

const VALID_ROLES = [
    "admin",
    "administracion",
    "recursos_humanos",
    "contabilidad",
    "compras",
    "ventas",
    "automatizacion",
    "diseno",
    "produccion",
    "operador",
    "calidad",
    "almacen",
    "logistica",
] as const;

export const ApproveUserSchema = z.object({
    userId: z.string().uuid("ID de usuario inválido"),
    roles: z.array(z.enum(VALID_ROLES, { message: "Rol inválido" })).min(1, "Debe seleccionar al menos un rol"),
    permissions: z.array(z.string().min(1)).default([]),
    operatorName: z.string().max(200).optional(),
});

export const RejectUserSchema = z.object({
    userId: z.string().uuid("ID de usuario inválido"),
});

export const UpdateUserRolesSchema = z.object({
    userId: z.string().uuid("ID de usuario inválido"),
    newRoles: z.array(z.enum(VALID_ROLES, { message: "Rol inválido" })).min(1, "Debe seleccionar al menos un rol"),
    permissions: z.array(z.string().min(1)).default([]),
    operatorName: z.string().max(200).optional(),
});

export const UpsertEmployeeSchema = z.object({
    id: z.string().uuid().optional(),
    full_name: z.string().min(1, "El nombre es obligatorio").max(200).trim(),
    employee_number: z.string().max(50).trim().nullable().optional(),
    department: z.string().max(100).trim().nullable().optional(),
    position: z.string().max(100).trim().nullable().optional(),
    is_operator: z.boolean().default(false),
    is_active: z.boolean().default(true),
});

export const DeleteEmployeeSchema = z.object({
    id: z.string().uuid("ID de empleado inválido"),
});

/** Validates HH:MM or HH:MM:SS time strings */
const timeString = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Formato de hora inválido (HH:MM)");

export const UpsertWorkShiftSchema = z.object({
    id: z.string().uuid().optional(),
    name: z.string().min(1, "El nombre es obligatorio").max(100).trim(),
    start_time: timeString,
    end_time: timeString,
    days_of_week: z.array(z.number().int().min(0).max(6)).min(1, "Selecciona al menos un día"),
    active: z.boolean().default(true),
    sort_order: z.number().int().min(0).default(0),
});

export const DeleteWorkShiftSchema = z.object({
    id: z.string().uuid("ID de turno inválido"),
});
