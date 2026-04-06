export type ActionResult<T = void> = { success: true; data: T } | { success: false; error: ActionError };

export type ActionError =
    | { code: "VALIDATION_ERROR"; fields: Record<string, string> }
    | { code: "NOT_FOUND"; resource: string }
    | { code: "PERMISSION_DENIED" }
    | { code: "CONFLICT"; message: string }
    | { code: "NETWORK_ERROR" };

export function getErrorMessage(error: ActionError): string {
    switch (error.code) {
        case "VALIDATION_ERROR":
            return Object.values(error.fields).flat().join(", ") || "Datos inválidos.";
        case "NOT_FOUND":
            return `${error.resource} no encontrado.`;
        case "PERMISSION_DENIED":
            return "No tienes permisos para realizar esta acción.";
        case "CONFLICT":
            return error.message;
        case "NETWORK_ERROR":
            return "Error de conexión. Intenta de nuevo.";
    }
}
