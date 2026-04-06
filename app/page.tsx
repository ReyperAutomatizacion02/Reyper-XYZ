"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, BarChart2, Cpu } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { motion } from "framer-motion";

const FEATURES = [
    {
        icon: BarChart2,
        title: "Control Total",
        desc: "Administración centralizada de cada área de tu empresa, desde ventas hasta producción.",
    },
    {
        icon: Cpu,
        title: "Tiempo Real",
        desc: "Visualiza el estado de la producción y ventas al instante con el planificador Gantt.",
    },
    {
        icon: CheckCircle2,
        title: "Eficiencia",
        desc: "Automatización inteligente para reducir tiempos de ciclo y costos operativos.",
    },
];

export default function LandingPage() {
    return (
        <div className="flex min-h-screen flex-col overflow-hidden bg-background transition-colors duration-300 selection:bg-primary selection:text-white">
            {/* Background Gradients */}
            <div className="pointer-events-none fixed inset-0 z-[-1]">
                <div className="absolute left-[-10%] top-[-10%] h-[40%] w-[40%] animate-pulse rounded-full bg-primary/20 opacity-30 blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] h-[40%] w-[40%] animate-pulse rounded-full bg-blue-500/10 opacity-30 blur-[120px] delay-1000" />
            </div>

            {/* ── Header ─────────────────────────────────────────────── */}
            <header className="z-50 mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 md:px-6 md:py-6">
                <span className="text-xl font-bold tracking-tight md:text-2xl">
                    Reyper<span className="text-primary">XYZ</span>
                </span>
                <div className="flex items-center gap-3">
                    <ThemeToggle />
                    {/* On mobile, show a compact login link instead of hamburger menu */}
                    <Link
                        href="/login"
                        className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
                    >
                        Iniciar Sesión
                    </Link>
                    <Link
                        href="/register"
                        className="hidden rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-primary/25 transition-all hover:scale-105 active:scale-95 md:block"
                    >
                        Registrarse
                    </Link>
                </div>
            </header>

            <main className="flex-1">
                {/* ── Hero ───────────────────────────────────────────── */}
                <section className="mx-auto flex min-h-[70vh] w-full max-w-4xl flex-col items-center justify-center px-6 py-20 text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="space-y-8"
                    >
                        <div className="inline-block rounded-full border border-secondary/20 bg-secondary/10 px-3 py-1 text-xs font-semibold text-secondary-foreground">
                            🚀 Versión 2.0 Desplegada
                        </div>

                        <h1 className="text-5xl font-black leading-[1.1] tracking-tight md:text-7xl lg:text-8xl">
                            Gestión Integral <br />
                            <span className="bg-gradient-to-r from-primary via-red-500 to-orange-500 bg-clip-text text-transparent">
                                Maquinados CNC
                            </span>
                        </h1>

                        <p className="mx-auto max-w-2xl text-xl font-light leading-relaxed text-muted-foreground md:text-2xl">
                            Optimiza producción, ventas y administración con la plataforma definitiva para la industria
                            moderna.
                        </p>

                        <div className="flex flex-col items-center justify-center gap-4 pt-4 sm:flex-row">
                            <Link
                                href="/login"
                                className="group flex items-center justify-center gap-2 rounded-full bg-foreground px-8 py-4 text-lg font-bold text-background shadow-2xl transition-all hover:-translate-y-1 hover:opacity-90"
                            >
                                Iniciar Sesión
                                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                            </Link>
                            <Link
                                href="/register"
                                className="flex items-center justify-center gap-2 rounded-full border-2 border-primary/20 bg-transparent px-8 py-4 text-lg font-bold text-foreground transition-all hover:border-primary hover:bg-primary/5"
                            >
                                Crear Cuenta
                            </Link>
                        </div>
                    </motion.div>
                </section>

                {/* ── Features ───────────────────────────────────────── */}
                <section className="border-t border-border/40 py-24">
                    <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-6 px-6 sm:grid-cols-2 md:grid-cols-3">
                        {FEATURES.map((feature, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.1 }}
                                className="glass-card group flex flex-col items-start rounded-3xl p-8 text-left transition-colors hover:border-primary/50"
                            >
                                <div className="mb-6 rounded-2xl bg-primary/10 p-3 text-primary transition-transform duration-300 group-hover:scale-110">
                                    <feature.icon className="h-8 w-8" />
                                </div>
                                <h3 className="mb-3 text-2xl font-bold">{feature.title}</h3>
                                <p className="leading-relaxed text-muted-foreground">{feature.desc}</p>
                            </motion.div>
                        ))}
                    </div>
                </section>
            </main>

            {/* ── Footer ─────────────────────────────────────────────── */}
            <footer className="border-t border-border/40 py-8 text-center text-sm text-muted-foreground">
                <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 md:flex-row">
                    <p>© {new Date().getFullYear()} Reyper XYZ. Construido para el futuro.</p>
                    <div className="flex gap-4">
                        <Link href="#" className="transition-colors hover:text-primary">
                            Términos
                        </Link>
                        <Link href="#" className="transition-colors hover:text-primary">
                            Privacidad
                        </Link>
                    </div>
                </div>
            </footer>
        </div>
    );
}
