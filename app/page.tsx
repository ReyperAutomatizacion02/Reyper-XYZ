"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, BarChart2, Cpu } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { motion } from "framer-motion";
import { LogoShort, LogoLarge } from "@/components/logo";

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
                <LogoLarge className="h-8 w-auto md:h-10" />
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
                <section className="mx-auto flex min-h-[70vh] w-full max-w-7xl items-center justify-between gap-12 px-6 py-20">
                    {/* Left — text */}
                    <motion.div
                        initial={{ opacity: 0, x: -24 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5 }}
                        className="flex flex-1 flex-col gap-8"
                    >
                        <h1 className="text-5xl font-black leading-[1.1] tracking-tight md:text-7xl lg:text-8xl">
                            Gestión Integral <br />
                            <span className="text-primary">Maquinados CNC</span>
                        </h1>

                        <p className="max-w-xl text-xl font-light leading-relaxed text-muted-foreground md:text-2xl">
                            Optimiza producción, ventas y administración con la plataforma definitiva para la industria
                            moderna.
                        </p>

                        <div className="flex flex-wrap gap-4">
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

                    {/* Right — logo */}
                    <motion.div
                        initial={{ opacity: 0, x: 24 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                        className="hidden shrink-0 lg:block"
                    >
                        <LogoShort className="h-72 w-auto xl:h-80" />
                    </motion.div>
                </section>

                {/* ── Features ───────────────────────────────────────── */}
                <section className="border-t border-border/50 bg-muted/20 py-24">
                    <div className="mx-auto w-full max-w-7xl px-6">
                        <p className="mb-12 text-center text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                            ¿Qué incluye?
                        </p>
                        {/* Mobile: horizontal scroll-snap. Desktop: 3-col grid */}
                        <div className="flex snap-x snap-mandatory gap-6 overflow-x-auto pb-4 md:grid md:grid-cols-3 md:overflow-visible md:pb-0">
                            {FEATURES.map((feature, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, y: 20 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: i * 0.1 }}
                                    className="glass-card group flex min-w-[280px] snap-start flex-col items-start rounded-3xl p-8 text-left transition-colors hover:border-primary/50 md:min-w-0"
                                >
                                    <div className="mb-6 rounded-2xl bg-primary/10 p-3 text-primary transition-transform duration-300 group-hover:scale-110">
                                        <feature.icon className="h-8 w-8" />
                                    </div>
                                    <h3 className="mb-3 text-2xl font-bold">{feature.title}</h3>
                                    <p className="leading-relaxed text-muted-foreground">{feature.desc}</p>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>
            </main>

            {/* ── Footer ─────────────────────────────────────────────── */}
            <footer className="border-t border-border/40 py-8 text-center text-sm text-muted-foreground">
                <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 md:flex-row">
                    <p>© {new Date().getFullYear()} XYZ RYXZA. Construido para el futuro.</p>
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
