/**
 * Extrae el ID de archivo de una URL de Google Drive.
 * Soporta formatos:
 * - https://drive.google.com/file/d/[FILE_ID]/view
 * - https://drive.google.com/open?id=[FILE_ID]
 * - https://drive.google.com/uc?id=[FILE_ID]
 */
export function extractDriveFileId(url: string | null | undefined): string | null {
    if (!url) return null;

    // Pattern for /file/d/[ID]/
    const fileDMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (fileDMatch && fileDMatch[1]) return fileDMatch[1];

    // Pattern for ?id=[ID] or &id=[ID]
    const idParamMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (idParamMatch && idParamMatch[1]) return idParamMatch[1];

    return null;
}
