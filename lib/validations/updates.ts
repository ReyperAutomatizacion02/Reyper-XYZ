import { z } from "zod";

export const UpdateSystemUpdateSchema = z.object({
    id: z.string().uuid("ID inválido"),
    updates: z.object({
        title: z.string().min(1).max(500).optional(),
        summary: z.string().max(2000).nullable().optional(),
        content: z.string().max(10000).nullable().optional(),
        category: z.string().max(100).nullable().optional(),
        images: z.array(z.string()).nullable().optional(),
        image_captions: z.array(z.string()).nullable().optional(),
    }).refine(obj => Object.keys(obj).length > 0, "Debe proporcionar al menos un campo a actualizar"),
});
