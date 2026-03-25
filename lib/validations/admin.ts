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
