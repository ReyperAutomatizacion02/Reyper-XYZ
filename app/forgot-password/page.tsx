"use client";

import { useActionState } from "react";
import Link from "next/link";
import { forgotPassword } from "../auth/actions";
import { SubmitButton } from "@/components/submit-button";
import { ArrowLeft } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export default function ForgotPasswordPage() {
    const [state, action] = useActionState(forgotPassword, null);

    return (
        <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-background p-4">
            {/* Background Gradients */}
            <div className="fixed inset-0 z-0">
                <div className="pointer-events-none absolute right-[-10%] top-[-20%] h-[50%] w-[50%] rounded-full bg-primary/10 blur-[100px]" />
            </div>

            <Link
                href="/login"
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
                    <div className="mb-8 flex flex-col gap-2 text-center">
                        <h1 className="text-2xl font-bold tracking-tight">Recuperar Contraseña</h1>
                        <p className="text-sm text-muted-foreground">Ingresa tu correo para recibir instrucciones</p>
                    </div>

                    <form className="flex flex-col gap-4" action={action}>
                        <div className="space-y-2">
                            <label className="text-sm font-medium leading-none" htmlFor="email">
                                Correo Electrónico
                            </label>
                            <input
                                className="flex h-11 w-full rounded-xl border border-input bg-background/50 px-3 py-2 text-sm ring-offset-background transition-all file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                name="email"
                                placeholder="tucorreo@ejemplo.com"
                                required
                            />
                        </div>

                        <SubmitButton
                            className="mt-4 h-11 rounded-xl bg-primary px-4 py-2 font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:opacity-90"
                            pendingText="Enviando..."
                        >
                            Enviar Correo
                        </SubmitButton>

                        {state?.success && (
                            <div className="mt-4 rounded-xl border border-green-500/20 bg-green-500/10 p-4 text-center text-sm text-green-500 animate-in fade-in">
                                {state.success}
                            </div>
                        )}
                        {state?.error && (
                            <div className="mt-4 rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-center text-sm text-destructive animate-in fade-in">
                                {state.error}
                            </div>
                        )}
                    </form>
                </div>
            </div>
        </div>
    );
}
