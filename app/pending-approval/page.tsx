import Link from "next/link";
import { ArrowLeft, Clock, LogOut } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export default function PendingApprovalPage() {
    return (
        <div className="min-h-screen w-full flex items-center justify-center p-4 bg-background relative overflow-hidden">
            {/* Background Gradients */}
            <div className="fixed inset-0 z-0">
                <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] bg-orange-500/10 rounded-full blur-[100px] pointer-events-none" />
                <div className="absolute bottom-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/5 rounded-full blur-[100px] pointer-events-none" />
            </div>

            <div className="absolute right-8 top-8 z-20">
                <ThemeToggle />
            </div>

            <div className="w-full max-w-md z-10 animate-in fade-in zoom-in-95 duration-500">
                <div className="glass-card p-8 sm:p-10 rounded-3xl border-border/50 text-center">
                    <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-orange-500/10 flex items-center justify-center">
                        <Clock className="w-10 h-10 text-orange-500" />
                    </div>

                    <h1 className="text-2xl font-bold tracking-tight mb-2">
                        Cuenta Pendiente de Aprobación
                    </h1>

                    <p className="text-muted-foreground mb-8">
                        Tu cuenta ha sido creada exitosamente. Un administrador
                        revisará tu solicitud y te asignará un rol de acceso.
                    </p>

                    <div className="p-4 bg-muted/30 rounded-xl mb-6 text-sm text-muted-foreground">
                        <p>📧 Recibirás un correo cuando tu cuenta sea aprobada.</p>
                    </div>

                    <div className="flex flex-col gap-3">
                        <Link
                            href="/login"
                            className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-all shadow-lg shadow-primary/20"
                        >
                            <LogOut className="w-4 h-4" />
                            Cerrar Sesión
                        </Link>

                        <Link
                            href="/"
                            className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Volver al Inicio
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
