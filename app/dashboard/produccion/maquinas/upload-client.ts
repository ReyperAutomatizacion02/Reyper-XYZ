"use client";

import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";

const BUCKET = "partidas";
const MACHINE_IMG_PATH = (machineId: string) => `machines/${machineId}`;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_SIZE_BYTES = 15 * 1024 * 1024;

/**
 * Uploads an image for a machine and returns its public URL.
 * Files are stored at: partidas/machines/{machineId}/{uuid}.{ext}
 */
export async function uploadMachineImage(file: File, machineId: string): Promise<string | null> {
    try {
        const supabase = createClient();

        if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
            toast.error("Tipo de archivo no permitido. Solo se aceptan imágenes (JPG, PNG, WebP, GIF).");
            return null;
        }

        if (file.size > MAX_SIZE_BYTES) {
            toast.error("El archivo excede el límite de 15MB");
            return null;
        }

        const ext = file.name.split(".").pop();
        const fileName = `${crypto.randomUUID()}.${ext}`;
        const filePath = `${MACHINE_IMG_PATH(machineId)}/${fileName}`;

        const { error } = await supabase.storage.from(BUCKET).upload(filePath, file);

        if (error) {
            console.error("Storage upload error:", error);
            toast.error("Error al subir la imagen");
            return null;
        }

        const {
            data: { publicUrl },
        } = supabase.storage.from(BUCKET).getPublicUrl(filePath);

        return publicUrl;
    } catch (err) {
        console.error("Upload error:", err);
        toast.error("Error inesperado durante la subida");
        return null;
    }
}

/**
 * Lists all images stored for a machine.
 * Returns an array of public URLs.
 */
export async function listMachineImages(machineId: string): Promise<{ name: string; url: string }[]> {
    try {
        const supabase = createClient();
        const folder = MACHINE_IMG_PATH(machineId);

        const { data: files, error } = await supabase.storage.from(BUCKET).list(folder, {
            sortBy: { column: "created_at", order: "desc" },
        });

        if (error || !files) return [];

        return files
            .filter((f) => f.name !== ".emptyFolderPlaceholder")
            .map((f) => ({
                name: f.name,
                url: supabase.storage.from(BUCKET).getPublicUrl(`${folder}/${f.name}`).data.publicUrl,
            }));
    } catch {
        return [];
    }
}

/**
 * Deletes a single machine image from storage.
 * Returns true on success.
 */
export async function deleteMachineImageFromStorage(machineId: string, fileName: string): Promise<boolean> {
    try {
        const supabase = createClient();
        const filePath = `${MACHINE_IMG_PATH(machineId)}/${fileName}`;

        const { error } = await supabase.storage.from(BUCKET).remove([filePath]);

        if (error) {
            console.error("Storage delete error:", error);
            toast.error("Error al eliminar la imagen");
            return false;
        }

        return true;
    } catch {
        toast.error("Error inesperado al eliminar");
        return false;
    }
}
