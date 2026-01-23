import Link from "next/link";
import { login } from "../auth/actions";
import { SubmitButton } from "@/components/submit-button";
import { ArrowLeft } from "lucide-react";
import { GoogleSignIn } from "@/components/google-sign-in";

export default async function LoginPage({
    searchParams,
}: {
    searchParams: Promise<{ message?: string }>;
}) {
    const params = await searchParams;
    return (
        <div className="min-h-screen w-full flex items-center justify-center p-4 bg-background relative overflow-hidden">
            {/* Background Gradients */}
            <div className="fixed inset-0 z-0">
                <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
                <div className="absolute bottom-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-500/5 rounded-full blur-[100px] pointer-events-none" />
            </div>

            <Link
                href="/"
                className="absolute left-8 top-8 py-2 px-4 rounded-full text-foreground/80 hover:text-primary hover:bg-primary/5 transition-all flex items-center group text-sm font-medium z-20 backdrop-blur-sm border border-transparent hover:border-primary/10"
            >
                <ArrowLeft className="w-4 h-4 mr-2 transition-transform group-hover:-translate-x-1" />
                Regresar
            </Link>

            <div className="w-full max-w-md z-10 animate-in fade-in zoom-in-95 duration-500">
                <div className="glass-card p-8 sm:p-10 rounded-3xl border-border/50">
                    <div className="flex flex-col gap-2 mb-8 text-center">
                        <h1 className="text-3xl font-bold tracking-tight">Bienvenido</h1>
                        <p className="text-sm text-muted-foreground">
                            Ingresa tus credenciales para acceder al sistema.
                        </p>
                    </div>

                    <form className="flex flex-col gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70" htmlFor="email">
                                Correo / Usuario
                            </label>
                            <input
                                className="flex h-11 w-full rounded-xl border border-input bg-background/50 px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all"
                                name="email"
                                placeholder="nombre@ejemplo.com"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70" htmlFor="password">
                                    Contraseña
                                </label>
                                <Link href="/forgot-password" className="text-xs text-primary hover:underline font-medium">
                                    ¿Olvidaste tu contraseña?
                                </Link>
                            </div>
                            <input
                                className="flex h-11 w-full rounded-xl border border-input bg-background/50 px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all"
                                type="password"
                                name="password"
                                placeholder="••••••••"
                                required
                            />
                        </div>

                        <SubmitButton
                            formAction={login}
                            className="bg-primary text-primary-foreground h-11 rounded-xl px-4 py-2 mt-2 hover:opacity-90 transition-all font-semibold shadow-lg shadow-primary/20"
                            pendingText="Autenticando..."
                        >
                            Iniciar Sesión
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

                        {params?.message && (
                            <div className="mt-4 p-4 bg-destructive/10 text-destructive text-center text-sm border border-destructive/20 rounded-xl animate-in fade-in slide-in-from-top-2">
                                {params.message}
                            </div>
                        )}

                        <div className="text-center mt-6 text-sm text-muted-foreground">
                            ¿No tienes una cuenta?{" "}
                            <Link href="/register" className="font-bold text-foreground hover:text-primary transition-colors underline-offset-4 hover:underline">
                                Regístrate ahora
                            </Link>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
