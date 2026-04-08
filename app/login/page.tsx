"use client";

import { useActionState } from "react";
import Link from "next/link";
import { login } from "../auth/actions";
import { SubmitButton } from "@/components/submit-button";
import { ArrowLeft } from "lucide-react";
import { GoogleSignIn } from "@/components/google-sign-in";
import { ThemeToggle } from "@/components/theme-toggle";
import { Logo } from "@/components/logo";

export default function LoginPage() {
    const [state, action] = useActionState(login, null);

    return (
        <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-background p-4">
            {/* Background Gradients */}
            <div className="fixed inset-0 z-0">
                <div className="pointer-events-none absolute right-[-10%] top-[-20%] h-[50%] w-[50%] rounded-full bg-primary/10 blur-[100px]" />
                <div className="pointer-events-none absolute bottom-[-20%] left-[-10%] h-[50%] w-[50%] rounded-full bg-blue-500/5 blur-[100px]" />
            </div>

            <Link
                href="/"
                className="group absolute left-8 top-8 z-20 flex items-center rounded-full border border-transparent px-4 py-2 text-sm font-medium text-foreground/80 backdrop-blur-sm transition-all hover:border-primary/10 hover:bg-primary/5 hover:text-primary"
            >
                <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
                Regresar
            </Link>

            <div className="absolute right-8 top-8 z-20">
                <ThemeToggle />
            </div>

            <div className="z-10 w-full max-w-md duration-500 animate-in fade-in zoom-in-95">
                <div className="glass-card rounded-3xl border-border/50 p-8 sm:p-10">
                    <div className="mb-8 flex flex-col items-center gap-4 text-center">
                        <Logo className="h-16 w-auto" />
                        <div className="flex flex-col gap-1">
                            <h1 className="text-3xl font-bold tracking-tight">Bienvenido</h1>
                            <p className="text-sm text-muted-foreground">
                                Ingresa tus credenciales para acceder al sistema.
                            </p>
                        </div>
                    </div>

                    <form className="flex flex-col gap-4" action={action}>
                        <div className="space-y-2">
                            <label
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                htmlFor="email"
                            >
                                Correo / Usuario
                            </label>
                            <input
                                id="email"
                                className="flex h-11 w-full rounded-xl border border-input bg-background/50 px-3 py-2 text-sm ring-offset-background transition-all file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                name="email"
                                placeholder="nombre@ejemplo.com"
                                required
                                aria-describedby={state?.error ? "login-error" : undefined}
                                aria-invalid={state?.error ? true : undefined}
                            />
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label
                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                    htmlFor="password"
                                >
                                    Contraseña
                                </label>
                                <Link
                                    href="/forgot-password"
                                    className="text-xs font-medium text-primary hover:underline"
                                >
                                    ¿Olvidaste tu contraseña?
                                </Link>
                            </div>
                            <input
                                id="password"
                                className="flex h-11 w-full rounded-xl border border-input bg-background/50 px-3 py-2 text-sm ring-offset-background transition-all file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                type="password"
                                name="password"
                                placeholder="••••••••"
                                required
                                aria-describedby={state?.error ? "login-error" : undefined}
                                aria-invalid={state?.error ? true : undefined}
                            />
                        </div>

                        <SubmitButton
                            className="mt-2 h-11 rounded-xl bg-primary px-4 py-2 font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:opacity-90"
                            pendingText="Autenticando..."
                        >
                            Iniciar Sesión
                        </SubmitButton>

                        <div className="relative my-4">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t border-border" />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-background px-2 font-medium text-muted-foreground">
                                    O continúa con
                                </span>
                            </div>
                        </div>

                        <GoogleSignIn />

                        {state?.error && (
                            <div
                                id="login-error"
                                role="alert"
                                className="mt-4 rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-center text-sm text-destructive animate-in fade-in slide-in-from-top-2"
                            >
                                {state.error}
                            </div>
                        )}

                        <div className="mt-6 text-center text-sm text-muted-foreground">
                            ¿No tienes una cuenta?{" "}
                            <Link
                                href="/register"
                                className="font-bold text-foreground underline-offset-4 transition-colors hover:text-primary hover:underline"
                            >
                                Regístrate ahora
                            </Link>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
