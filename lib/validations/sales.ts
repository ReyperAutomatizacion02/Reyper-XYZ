import { z } from "zod";

// Base item schema for quotes and production orders
export const ItemSchema = z.object({
    id: z.string().optional(),
    part_code: z.string().min(1, "El código de partida es obligatorio"),
    description: z.string().min(1, "La descripción es obligatoria"), // Added for quote items
    part_name: z.string().optional().nullable(),
    quantity: z.number().int().positive("La cantidad debe ser mayor a 0"),
    material: z.string().optional().nullable(),
    treatment_id: z.string().optional().nullable(),
    treatment_name: z.string().optional().nullable(),
    genral_status: z.string().min(1, "El estatus general es obligatorio"),
});

// Used when creating a new quote from the sales dashboard
export const CreateQuoteSchema = z.object({
    quote_number: z.string().min(1, "El número de cotización es obligatorio"),
    // If it's optional in the DB, we can use nullish() or optional()
    requisition_number: z.string().nullable().optional(),
    part_number: z.string().nullable().optional(),
    issue_date: z.string().min(1, "La fecha de emisión es obligatoria"), // You can refine to z.date() if passing real dates
    delivery_date: z.string().min(1, "La fecha de entrega es obligatoria"),
    currency: z.string().min(1, "La moneda es obligatoria"),
    client_id: z.string().min(1, "El cliente es obligatorio"),
    contact_id: z.string().nullable().optional(),
    user_id: z.string().min(1, "El usuario es obligatorio"),
    payment_terms: z.string().nullable().optional(),
    validity_days: z.number().int().nonnegative().default(0),
    items: z.array(ItemSchema).min(1, "Debe agregar al menos una partida"),
});

// Schemas for converting a quote to a project
export const ConvertQuoteToProjectSchema = z.object({
    quote_id: z.string().uuid("ID de cotización inválido"),
    client_prefix: z.string().min(1, "El prefijo del cliente es obligatorio"),
    company_name: z.string().min(1, "El nombre de la empresa es obligatorio"), // This might be dynamically matched, but good to validate
    partNames: z.array(z.object({
        quoteItemId: z.string(),
        name: z.string()
    })).optional(),
});

// Schema for updating a project's global info
export const UpdateProjectSchema = z.object({
    id: z.string().uuid("ID de proyecto inválido"),
    name: z.string().min(1, "El nombre del proyecto es obligatorio"),
    company: z.string().min(1, "La empresa es obligatoria"),
    requestor: z.string().min(1, "El solicitante es obligatorio"),
    start_date: z.string(), // Consider ISO date validation
    delivery_date: z.string(), // Consider ISO date validation
});

// Schema for updating a single production order (item)
export const UpdateProductionOrderSchema = z.object({
    id: z.string().uuid("ID de orden de producción inválido"),
    part_name: z.string().min(1, "El nombre de partida es obligatorio"),
    material: z.string().min(1, "El material es obligatorio"),
    quantity: z.number().int().positive("La cantidad debe ser mayor a 0"),
    genral_status: z.string().min(1, "El estatus es obligatorio"),
    treatment_id: z.string().nullable().optional(), // Treatment can be null if not selected
    treatment_name: z.string().nullable().optional(),
    urgency_level: z.string().nullable().optional(), // Eg. 'Normal', 'Urgente'
});
