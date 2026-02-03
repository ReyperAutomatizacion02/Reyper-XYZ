import Link from "next/link";
import { signup } from "../auth/actions";
import { SubmitButton } from "@/components/submit-button";
import { PasswordInput } from "@/components/password-input";
import { ArrowLeft } from "lucide-react";
import { GoogleSignIn } from "@/components/google-sign-in";
import { ThemeToggle } from "@/components/theme-toggle";

export default function RegisterPage({
    searchParams,
}: {
    searchParams: { message: string };
}) {
    return (
        <div className="min-h-screen w-full flex items-center justify-center p-4 bg-background relative overflow-hidden">
            {/* Background Gradients */}
            <div className="fixed inset-0 z-0">
                <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-orange-500/5 rounded-full blur-[100px] pointer-events-none" />
            </div>

            <Link
                href="/"
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
                        <h1 className="text-3xl font-bold tracking-tight">Crear Cuenta</h1>
                        <p className="text-sm text-muted-foreground">
                            Comienza a optimizar tu empresa hoy.
                        </p>
                    </div>

                    <form className="flex flex-col gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium leading-none" htmlFor="fullName">
                                Nombre Completo
                            </label>
                            <input
                                className="flex h-11 w-full rounded-xl border border-input bg-background/50 px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all"
                                name="fullName"
                                placeholder="Juan Pérez"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium leading-none" htmlFor="email">
                                Correo Electrónico
                            </label>
                            <input
                                className="flex h-11 w-full rounded-xl border border-input bg-background/50 px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all"
                                name="email"
                                placeholder="usuario@ejemplo.com"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium leading-none" htmlFor="username">
                                Usuario
                            </label>
                            <input
                                className="flex h-11 w-full rounded-xl border border-input bg-background/50 px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all"
                                name="username"
                                placeholder="juanperez"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium leading-none" htmlFor="password">
                                Contraseña
                            </label>
                            <PasswordInput
                                name="password"
                                placeholder="••••••••"
                                required
                                className="h-11 rounded-xl bg-background/50"
                            />
                            <p className="text-[10px] text-muted-foreground pl-1">
                                Mín. 10 caracteres, 1 mayúsucla, 1 número, 1 símbolo.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium leading-none" htmlFor="confirmPassword">
                                Confirmar Contraseña
                            </label>
                            <PasswordInput
                                name="confirmPassword"
                                placeholder="••••••••"
                                required
                                className="h-11 rounded-xl bg-background/50"
                            />
                        </div>

                        <SubmitButton
                            formAction={signup}
                            className="bg-primary text-primary-foreground h-11 rounded-xl px-4 py-2 mt-4 hover:opacity-90 transition-all font-semibold shadow-lg shadow-primary/20"
                            pendingText="Creando cuenta..."
                        >
                            Registrarse
                        </SubmitButton>

                        <div className="relative my-4">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t border-border" />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-background px-2 text-muted-foreground font-medium">O continúa con</span>
                            </div>
                        </div>

                        <GoogleSignIn />

                        {searchParams?.message && (
                            <div className="mt-4 p-4 bg-destructive/10 text-destructive text-center text-sm border border-destructive/20 rounded-xl animate-in fade-in slide-in-from-top-2">
                                {searchParams.message}
                            </div>
                        )}

                        <div className="text-center mt-6 text-sm text-muted-foreground">
                            ¿Ya tienes una cuenta?{" "}
                            <Link href="/login" className="font-bold text-foreground hover:text-primary transition-colors underline-offset-4 hover:underline">
                                Inicia Sesión
                            </Link>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
