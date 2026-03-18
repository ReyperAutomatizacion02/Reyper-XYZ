"use client";

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <html lang="es">
            <body>
                <div style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: "100vh",
                    gap: "1rem",
                    fontFamily: "system-ui, sans-serif",
                    padding: "1rem",
                }}>
                    <h2 style={{ fontSize: "1.25rem", fontWeight: 600 }}>
                        Error crítico
                    </h2>
                    <p style={{ color: "#6b7280", textAlign: "center", maxWidth: "28rem" }}>
                        La aplicación encontró un error inesperado. Intenta recargar la página.
                    </p>
                    <button
                        onClick={reset}
                        style={{
                            padding: "0.5rem 1rem",
                            borderRadius: "0.375rem",
                            backgroundColor: "#0f172a",
                            color: "#fff",
                            border: "none",
                            cursor: "pointer",
                            fontSize: "0.875rem",
                        }}
                    >
                        Reintentar
                    </button>
                </div>
            </body>
        </html>
    );
}
