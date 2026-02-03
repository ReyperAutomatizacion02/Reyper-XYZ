import Link from "next/link";
import { forgotPassword } from "../auth/actions";
import { SubmitButton } from "@/components/submit-button";
import { ArrowLeft } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export default function ForgotPasswordPage({
    searchParams,
}: {
    searchParams: { message: string; error: string };
}) {
    return (
        <div className="min-h-screen w-full flex items-center justify-center p-4 bg-background relative overflow-hidden">
            {/* Background Gradients */}
            <div className="fixed inset-0 z-0">
                <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
            </div>

            <Link
                href="/login"
                className="absolute left-8 top-8 py-2 px-4 rounded-full text-foreground/80 hover:text-primary hover:bg-primary/5 transition-all flex items-center group text-sm font-medium z-20 backdrop-blur-sm border border-transparent hover:border-primary/10"
            >
                <ArrowLeft className="w-4 h-4 mr-2 transition-transform group-hover:-translate-x-1" />
                Regresar
            </Link>

            <div className="absolute right-8 top-8 z-20">
                <ThemeToggle />
            </div>

            <div className="w-full max-w-md z-10 animate-in fade-in zoom-in-95 duration-500">
                <div className="glass-card p-8 sm:p-10 rounded-3xl border-border/50">
                    <div className="flex flex-col gap-2 mb-8 text-center">
                        <h1 className="text-2xl font-bold tracking-tight">Recuperar Contraseña</h1>
                        <p className="text-sm text-muted-foreground">
                            Ingresa tu correo para recibir instrucciones
                        </p>
                    </div>

                    <form className="flex flex-col gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium leading-none" htmlFor="email">
                                Correo Electrónico
                            </label>
                            <input
                                className="flex h-11 w-full rounded-xl border border-input bg-background/50 px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all"
                                name="email"
                                placeholder="tucorreo@ejemplo.com"
                                required
                            />
                        </div>

                        <SubmitButton
                            formAction={forgotPassword}
                            className="bg-primary text-primary-foreground h-11 rounded-xl px-4 py-2 mt-4 hover:opacity-90 transition-all font-semibold shadow-lg shadow-primary/20"
                            pendingText="Enviando..."
                        >
                            Enviar Correo
                        </SubmitButton>

                        {searchParams?.message && (
                            <div className="mt-4 p-4 bg-green-500/10 text-green-500 text-center text-sm border border-green-500/20 rounded-xl animate-in fade-in">
                                {searchParams.message}
                            </div>
                        )}
                        {searchParams?.error && (
                            <div className="mt-4 p-4 bg-destructive/10 text-destructive text-center text-sm border border-destructive/20 rounded-xl animate-in fade-in">
                                {searchParams.error}
                            </div>
                        )}
                    </form>
                </div>
            </div>
        </div>
    );
}
