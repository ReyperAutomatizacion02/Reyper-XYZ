"use client";

import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";

/**
 * Sube un archivo al bucket de Supabase y devuelve la URL pública.
 * @param file El archivo a subir.
 * @param path El subdirectorio dentro del bucket (ej. 'images' o 'drawings').
 * @returns La URL pública del archivo cargado.
 */
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];
const MAX_SIZE_BYTES = 15 * 1024 * 1024;

export async function uploadPartAsset(file: File, path: string): Promise<string | null> {
    try {
        const supabase = createClient();

        if (!ALLOWED_TYPES.includes(file.type)) {
            toast.error("Tipo de archivo no permitido. Solo se aceptan imágenes y PDF.");
            return null;
        }

        if (file.size > MAX_SIZE_BYTES) {
            toast.error("El archivo excede el límite de 15MB");
            return null;
        }

        const fileExt = file.name.split(".").pop();
        const fileName = `${crypto.randomUUID()}.${fileExt}`;
        const filePath = `${path}/${fileName}`;

        const { data, error } = await supabase.storage.from("partidas").upload(filePath, file);

        if (error) {
            console.error("Storage upload error:", error);
            toast.error("Error al subir el archivo al servidor");
            return null;
        }

        const {
            data: { publicUrl },
        } = supabase.storage.from("partidas").getPublicUrl(filePath);

        return publicUrl;
    } catch (error) {
        console.error("Upload process error:", error);
        toast.error("Error inesperado durante la subida");
        return null;
    }
}
