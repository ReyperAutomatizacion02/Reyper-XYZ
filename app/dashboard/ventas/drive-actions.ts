"use server";

import { google } from "googleapis";
import { logger } from "@/utils/logger";

export async function scanDriveFolder(folderUrl: string) {
    logger.debug("Iniciando scan Drive folder", { folderUrl });

    if (!process.env.GOOGLE_API_KEY) {
        logger.error("No se encontró GOOGLE_API_KEY en las variables de entorno");
        return { success: false, error: "No se ha configurado la API Key de Google (GOOGLE_API_KEY)." };
    }

    try {
        // 1. Extract Folder ID
        const idMatch = folderUrl.match(/[-\w]{25,}/);
        const folderId = idMatch ? idMatch[0] : null;
        logger.debug("ID extraído de URL", { folderId });

        if (!folderId) {
            return { success: false, error: "URL de carpeta inválida. No se encontró un ID válido." };
        }

        // 2. Setup Client
        const drive = google.drive({
            version: "v3",
            auth: process.env.GOOGLE_API_KEY
        });

        logger.debug("Intentando listar archivos", { folderId });

        // 3. List Files (All non-folder types: PDF, PNG, JPG, TIF, etc.)
        const response = await drive.files.list({
            q: `'${folderId}' in parents and trashed = false and mimeType != 'application/vnd.google-apps.folder'`,
            fields: "files(id, name, webViewLink, thumbnailLink, mimeType)",
            orderBy: "name"
        });

        logger.debug("Respuesta Drive recibida", {
            status: response.status,
            filesCount: response.data.files?.length
        });

        const files = response.data.files || [];

        // 4. Transform to usable format
        const items = files.map(file => ({
            name: file.name?.replace(/\.[^/.]+$/, "") || "Sin Nombre", // Remove extension
            link: file.webViewLink || "",
            fileId: file.id || "",
            // Hack to get a larger thumbnail from Drive. Default is usually small (=s220).
            // Replacing it with =s16383 requests the largest possible version (original dimensions).
            thumbnail: file.thumbnailLink ? file.thumbnailLink.replace(/=s\d+$/, "=s16383") : "",
            mimeType: file.mimeType
        }));

        if (items.length === 0) {
            return { success: true, warning: "La carpeta parece estar vacía (o no es pública/accesible).", items: [] };
        }

        return { success: true, items };

    } catch (error: any) {
        logger.error("Error en Drive API", error);

        let errorMessage = `Error al conectar con Drive: ${error.message || "Desconocido"}`;

        // Handle common errors
        if (error.code === 403) errorMessage = "Error 403: Permiso denegado. Verifica que la API Key sea válida o que la carpeta sea pública.";
        if (error.code === 404) errorMessage = "Error 404: Carpeta no encontrada. Verifica el Link.";

        return { success: false, error: errorMessage };
    }
}
