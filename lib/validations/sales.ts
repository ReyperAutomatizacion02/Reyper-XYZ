import { z } from "zod";

// Base item schema for quotes and production orders
export const ItemSchema = z.object({
    id: z.string().optional(),
    part_code: z.string().min(1, "El código de partida es obligatorio"),
    description: z.string().min(1, "La descripción es obligatoria"),
    part_name: z.string().optional().nullable(),
    quantity: z.number().int().positive("La cantidad debe ser mayor a 0"),
    material: z.string().optional().nullable(),
    treatment_id: z.string().optional().nullable(),
    treatment_name: z.string().optional().nullable(),
    general_status: z.string().min(1, "El estatus general es obligatorio"),
    drawing_url: z.string().optional().nullable(),
    is_sub_item: z.boolean().optional(),
    design_no: z.string().optional().nullable(),
    unit: z.string().optional().nullable(),
}).passthrough();

// Used when creating a new quote from the sales dashboard
export const CreateQuoteSchema = z.object({
    quote_number: z.number().int().positive("El número de cotización es obligatorio"),
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
    general_status: z.string().min(1, "El estatus es obligatorio"),
    treatment_id: z.string().nullable().optional(), // Treatment can be null if not selected
    treatment_name: z.string().nullable().optional(),
    urgencia: z.boolean().optional(),
    model_url: z.string().nullable().optional(),
    render_url: z.string().nullable().optional(),
    material_confirmation: z.string().nullable().optional(),
});

// --- Catalog entry schemas ---

export const CatalogEntrySchema = z.object({
    name: z.string().min(1, "El nombre es obligatorio").max(200, "Máximo 200 caracteres").trim(),
});

export const ClientEntrySchema = z.object({
    name: z.string().min(1, "El nombre es obligatorio").max(200).trim(),
    prefix: z.string().max(20, "Máximo 20 caracteres").trim().optional(),
    business_name: z.string().max(300).trim().optional(),
    is_active: z.boolean().default(true),
});

export const UpdateClientSchema = ClientEntrySchema.extend({
    id: z.string().uuid("ID de cliente inválido"),
    prefix: z.string().max(20).trim().nullable().optional(),
    business_name: z.string().max(300).trim().nullable().optional(),
});

export const ContactEntrySchema = z.object({
    name: z.string().min(1, "El nombre es obligatorio").max(200).trim(),
    client_id: z.string().uuid("ID de cliente inválido").optional(),
    is_active: z.boolean().default(true),
});

export const UpdateContactSchema = ContactEntrySchema.extend({
    id: z.string().uuid("ID de contacto inválido"),
    client_id: z.string().uuid().nullable().optional(),
});

export const ContactBatchSchema = z.object({
    names: z.array(z.string().min(1).max(200).trim()).min(1, "Debe proporcionar al menos un nombre"),
    client_id: z.string().uuid("ID de cliente inválido").optional(),
    is_active: z.boolean().default(true),
});

export const IdSchema = z.object({
    id: z.string().uuid("ID inválido"),
});

export const SaveQuoteSchema = z.object({
    quoteData: CreateQuoteSchema.omit({ items: true }).passthrough(),
    items: z.array(ItemSchema).min(1, "Debe agregar al menos una partida"),
});

export const UpdateQuoteSchema = z.object({
    id: z.string().uuid("ID de cotización inválido"),
    quoteData: CreateQuoteSchema.omit({ items: true }).partial().passthrough(),
    items: z.array(ItemSchema).min(1, "Debe agregar al menos una partida"),
});

export const DeleteQuoteSchema = z.object({
    id: z.string().uuid("ID de cotización inválido"),
    reason: z.string().min(1, "La razón es obligatoria").max(500).trim(),
});

export const QuoteStatusSchema = z.object({
    id: z.string().uuid("ID de cotización inválido"),
    status: z.enum(["active", "approved", "cancelled", "deleted"], { message: "Estatus inválido" }),
});

// --- Project actions schemas ---

export const ClientPrefixSchema = z.object({
    clientPrefix: z.string().min(1, "El prefijo es obligatorio").max(20).trim(),
});

export const CreateProjectSchema = z.object({
    code: z.string().min(1, "El código es obligatorio"),
    name: z.string().min(1, "El nombre es obligatorio").max(300),
    client_id: z.string().uuid("ID de cliente inválido"),
    company_name: z.string().min(1, "La empresa es obligatoria"),
    requestor: z.string().min(1, "El solicitante es obligatorio"),
    requestor_id: z.string().uuid().optional(),
    start_date: z.string().min(1, "La fecha de inicio es obligatoria"),
    delivery_date: z.string().min(1, "La fecha de entrega es obligatoria"),
    status: z.string().min(1),
    source_quote_id: z.string().uuid().optional(),
});

export const CreateProjectItemSchema = z.object({
    part_code: z.string().min(1, "El código de partida es obligatorio"),
    part_name: z.string().min(1, "El nombre de partida es obligatorio"),
    quantity: z.number().int().positive("La cantidad debe ser mayor a 0"),
    unit: z.string().optional(),
    design_no: z.string().optional(),
    material: z.string().optional(),
    material_id: z.string().optional(),
    treatment_id: z.string().optional(),
    treatment_name: z.string().optional(),
    treatment: z.string().optional(),
    image: z.string().optional(),
    drawing_url: z.string().optional(),
    is_sub_item: z.boolean().optional(),
    description: z.string().optional(),
});

// --- Drive actions schema ---

export const DriveFolderSchema = z.object({
    folderUrl: z.string().min(1, "La URL es obligatoria").url("URL inválida"),
});
