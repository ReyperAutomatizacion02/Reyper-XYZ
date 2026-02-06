"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, CheckCircle2, Menu, X } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { motion, AnimatePresence } from "framer-motion";

export default function LandingPage() {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    return (
        <div className="min-h-screen flex flex-col bg-background selection:bg-primary selection:text-white transition-colors duration-300 overflow-hidden">
            {/* Background Gradients */}
            <div className="fixed inset-0 z-[-1]">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px] opacity-30 animate-pulse pointer-events-none" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px] opacity-30 delay-1000 animate-pulse pointer-events-none" />
            </div>

            <header className="px-4 md:px-6 py-4 md:py-6 flex justify-between items-center z-50 max-w-7xl mx-auto w-full">
                <div className="flex items-center gap-2">
                    <span className="font-bold text-xl md:text-2xl tracking-tight">Reyper<span className="text-primary">XYZ</span></span>
                </div>
                <div className="flex items-center gap-2 md:gap-4">
                    <ThemeToggle />
                    {/* Desktop Auth Links */}
                    <div className="hidden md:flex items-center gap-4">
                        <Link
                            href="/login"
                            className="text-sm font-medium hover:text-primary transition-colors px-4 py-2"
                        >
                            Iniciar Sesión
                        </Link>
                        <Link
                            href="/register"
                            className="bg-primary text-white px-5 py-2.5 rounded-full text-sm font-medium hover:scale-105 active:scale-95 transition-all shadow-lg shadow-primary/25"
                        >
                            Registrarse
                        </Link>
                    </div>
                    {/* Mobile Menu Button */}
                    <button
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        className="md:hidden p-2 rounded-lg hover:bg-muted text-foreground transition-colors"
                        aria-label={mobileMenuOpen ? "Cerrar menú" : "Abrir menú"}
                    >
                        {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                    </button>
                </div>
            </header>

            {/* Mobile Menu Dropdown */}
            <AnimatePresence>
                {mobileMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="md:hidden absolute top-16 left-0 right-0 z-40 px-4"
                    >
                        <div className="bg-card border border-border rounded-2xl shadow-xl p-4 flex flex-col gap-3">
                            <Link
                                href="/login"
                                className="text-sm font-medium hover:text-primary transition-colors px-4 py-3 rounded-xl hover:bg-muted text-center"
                                onClick={() => setMobileMenuOpen(false)}
                            >
                                Iniciar Sesión
                            </Link>
                            <Link
                                href="/register"
                                className="bg-primary text-white px-5 py-3 rounded-xl text-sm font-medium hover:opacity-90 transition-all text-center shadow-lg shadow-primary/25"
                                onClick={() => setMobileMenuOpen(false)}
                            >
                                Registrarse
                            </Link>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <main className="flex-1 flex flex-col items-center justify-center p-6 text-center relative z-10 w-full max-w-7xl mx-auto">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="max-w-4xl space-y-8 py-20"
                >
                    <div className="inline-block px-3 py-1 rounded-full bg-secondary/10 text-secondary-foreground text-xs font-semibold mb-4 border border-secondary/20">
                        🚀 Versión 2.0 Desplegada
                    </div>
                    <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tight leading-[1.1]">
                        Gestión Integral <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-red-500 to-orange-500">
                            Maquinados CNC
                        </span>
                    </h1>
                    <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto font-light leading-relaxed">
                        Optimiza producción, ventas y administración con la plataforma definitiva para la industria moderna.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8">
                        <Link
                            href="/dashboard"
                            className="group flex items-center justify-center gap-2 bg-foreground text-background px-8 py-4 rounded-full text-lg font-bold hover:opacity-90 transition-all hover:-translate-y-1 shadow-2xl"
                        >
                            Ir al Dashboard
                            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </Link>
                        <Link
                            href="/register"
                            className="flex items-center justify-center gap-2 bg-transparent border-2 border-primary/20 hover:border-primary text-foreground px-8 py-4 rounded-full text-lg font-bold transition-all hover:bg-primary/5"
                        >
                            Crear Cuenta
                        </Link>
                    </div>
                </motion.div>

                <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 w-full px-4 mb-20">
                    {[
                        { title: "Control Total", desc: "Administración centralizada de cada área de tu empresa." },
                        { title: "Tiempo Real", desc: "Visualiza el estado de la producción y ventas al instante." },
                        { title: "Eficiencia", desc: "Automatización inteligente para reducir tiempos y costos." }
                    ].map((feature, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.1 }}
                            className="glass-card p-8 rounded-3xl flex flex-col items-start text-left hover:border-primary/50 transition-colors group"
                        >
                            <div className="p-3 rounded-2xl bg-primary/10 text-primary mb-6 group-hover:scale-110 transition-transform duration-300">
                                <CheckCircle2 className="w-8 h-8" />
                            </div>
                            <h3 className="text-2xl font-bold mb-3">{feature.title}</h3>
                            <p className="text-muted-foreground leading-relaxed">{feature.desc}</p>
                        </motion.div>
                    ))}
                </div>
            </main>

            <footer className="py-8 text-center text-sm text-muted-foreground border-t border-border/40">
                <div className="flex flex-col md:flex-row justify-between items-center max-w-7xl mx-auto px-6 gap-4">
                    <p>© {new Date().getFullYear()} Reyper XYZ. Construido para el futuro.</p>
                    <div className="flex gap-4">
                        <Link href="#" className="hover:text-primary transition-colors">Términos</Link>
                        <Link href="#" className="hover:text-primary transition-colors">Privacidad</Link>
                    </div>
                </div>
            </footer>
        </div>
    );
}
