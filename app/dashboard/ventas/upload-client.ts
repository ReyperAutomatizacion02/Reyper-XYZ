"use client";

import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";

/**
 * Sube un archivo al bucket de Supabase y devuelve la URL pública.
 * @param file El archivo a subir.
 * @param path El subdirectorio dentro del bucket (ej. 'images' o 'drawings').
 * @returns La URL pública del archivo cargado.
 */
export async function uploadPartAsset(file: File, path: string): Promise<string | null> {
    try {
        const supabase = createClient();

        // Validar tamaño (máx 5MB)
        if (file.size > 5 * 1024 * 1024) {
            toast.error("El archivo excede el límite de 5MB");
            return null;
        }

        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
        const filePath = `${path}/${fileName}`;

        const { data, error } = await supabase.storage
            .from('partidas')
            .upload(filePath, file);

        if (error) {
            console.error("Storage upload error:", error);
            toast.error("Error al subir el archivo al servidor");
            return null;
        }

        const { data: { publicUrl } } = supabase.storage
            .from('partidas')
            .getPublicUrl(filePath);

        return publicUrl;
    } catch (error) {
        console.error("Upload process error:", error);
        toast.error("Error inesperado durante la subida");
        return null;
    }
}
