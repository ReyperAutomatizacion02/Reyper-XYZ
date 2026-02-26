"use client";

import { useEffect, useState, useCallback } from "react";
import { getSystemUpdates, SystemUpdate } from "../actions-updates";
import {
    Sparkles,
    Calendar,
    ChevronRight,
    Rocket,
    Wrench,
    ShieldCheck,
    Info,
    ExternalLink,
    Clock,
    Pencil,
    X,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/utils/cn";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardHeader } from "@/components/dashboard-header";
import { Button } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { EditUpdateDialog } from "./components/edit-update-dialog";
import { DrawingViewer } from "@/components/sales/drawing-viewer";

const CATEGORY_CONFIG = {
    Feature: { icon: Rocket, color: "text-blue-500", bg: "bg-blue-500/10", border: "border-blue-500/20", label: "Nueva Función" },
    Improvement: { icon: Sparkles, color: "text-green-500", bg: "bg-green-500/10", border: "border-green-500/20", label: "Mejora" },
    Fix: { icon: Wrench, color: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/20", label: "Corrección" },
    Security: { icon: ShieldCheck, color: "text-red-500", bg: "bg-red-500/10", border: "border-red-500/20", label: "Seguridad" },
    Maintenance: { icon: Info, color: "text-slate-500", bg: "bg-slate-500/10", border: "border-slate-500/20", label: "Mantenimiento" },
};


export default function ActualizacionesPage() {
    const [updates, setUpdates] = useState<SystemUpdate[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [editingUpdate, setEditingUpdate] = useState<SystemUpdate | null>(null);
    const [lightbox, setLightbox] = useState<{ url: string; caption?: string } | null>(null);
    const supabase = createClient();

    const fetchUpdates = useCallback(async () => {
        setLoading(true);
        const data = await getSystemUpdates();
        setUpdates(data);
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchUpdates();

        // Check for admin role
        async function checkRole() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: profile } = await supabase
                .from("user_profiles")
                .select("roles")
                .eq("id", user.id)
                .single();

            if (profile?.roles?.includes("admin")) {
                setIsAdmin(true);
            }
        }
        checkRole();
    }, [fetchUpdates, supabase]);

    if (loading) {
        return (
            <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
                <div className="space-y-4">
                    <Skeleton className="h-12 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                </div>
                {[1, 2, 3].map((i) => (
                    <div key={i} className="relative pl-8 pb-12">
                        <Skeleton className="absolute left-0 top-0 w-4 h-4 rounded-full" />
                        <Card className="p-6 space-y-4">
                            <Skeleton className="h-6 w-1/4" />
                            <Skeleton className="h-20 w-full" />
                        </Card>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <DashboardHeader
                title="Centro de Novedades"
                description="Mantente al tanto de las últimas mejoras, funciones y correcciones que implementamos para agilizar tu flujo de trabajo."
                icon={<Sparkles className="w-8 h-8 text-red-600 animate-pulse" />}
                backUrl="/dashboard"
                bgClass="bg-red-600/10"
                className="mb-12"
            />

            {updates.length === 0 ? (
                <Card className="p-12 text-center border-dashed bg-muted/30">
                    <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                        <Clock className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-xl font-bold">No hay actualizaciones registradas</h3>
                    <p className="text-muted-foreground mt-1">Vuelve pronto para ver las novedades.</p>
                </Card>
            ) : (
                <div className="relative">
                    <div className="absolute left-4 top-2 bottom-0 w-px bg-gradient-to-b from-red-600/50 via-border to-transparent" />

                    <div className="space-y-12">
                        {updates.map((update, idx) => {
                            const config = CATEGORY_CONFIG[update.category as keyof typeof CATEGORY_CONFIG] || CATEGORY_CONFIG.Improvement;
                            const Icon = config.icon;
                            const displayDate = update.commit_date || update.created_at;

                            return (
                                <div key={update.id} className="relative pl-12 group">
                                    <div className={cn(
                                        "absolute left-2.5 top-1.5 w-3 h-3 rounded-full border-2 border-background ring-4 ring-background z-10 transition-all duration-300 group-hover:scale-125 group-hover:ring-red-600/20",
                                        idx === 0 ? "bg-red-600" : "bg-muted-foreground/40"
                                    )} />

                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-3">
                                        <div className="flex items-center gap-3">
                                            <Badge variant="outline" className={cn("px-2.5 py-0.5 font-bold uppercase tracking-wider text-[10px]", config.bg, config.color, config.border)}>
                                                <Icon className="w-3 h-3 mr-1" />
                                                {config.label}
                                            </Badge>
                                            <div className="flex items-center text-xs text-muted-foreground font-medium">
                                                <Calendar className="w-3 h-3 mr-1.5" />
                                                {displayDate ? format(new Date(displayDate), "d 'de' MMMM, yyyy", { locale: es }) : "Reciente"}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {isAdmin && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-7 text-[10px] uppercase font-bold text-muted-foreground hover:text-red-600 hover:bg-red-600/5"
                                                    onClick={() => setEditingUpdate(update)}
                                                >
                                                    <Pencil className="w-3 h-3 mr-1.5" />
                                                    Editar
                                                </Button>
                                            )}
                                            {update.github_url && (
                                                <a
                                                    href={update.github_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center text-[10px] uppercase tracking-widest font-bold text-muted-foreground hover:text-red-600 transition-colors bg-muted/50 px-2.5 py-1 rounded"
                                                >
                                                    Ver Commit <ExternalLink className="w-2.5 h-2.5 ml-1" />
                                                </a>
                                            )}
                                        </div>
                                    </div>

                                    <Card className="p-6 border-border/40 bg-card hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-all duration-300 shadow-sm hover:shadow-xl hover:-translate-y-1 group/card overflow-hidden relative">
                                        <div className={cn("absolute top-0 left-0 w-full h-[2px] opacity-0 group-hover/card:opacity-100 transition-opacity", config.color.replace('text', 'bg'))} />

                                        <h3 className="text-xl font-bold mb-3 group-hover/card:text-red-600 transition-colors flex items-center gap-2">
                                            {update.title}
                                            <ChevronRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover/card:opacity-100 group-hover/card:translate-x-0 transition-all" />
                                        </h3>

                                        <div className="space-y-6">
                                            {/* Conditional Content Rendering */}
                                            {update.content ? (
                                                <div className="prose-reyper max-w-none text-foreground leading-relaxed">
                                                    <ReactMarkdown
                                                        remarkPlugins={[remarkGfm]}
                                                        components={{
                                                            h1: ({ node, ...props }) => <h1 className="text-2xl font-black mt-8 mb-4 border-b pb-2 border-border" {...props} />,
                                                            h2: ({ node, ...props }) => <h2 className="text-xl font-bold mt-6 mb-3" {...props} />,
                                                            h3: ({ node, ...props }) => <h3 className="text-lg font-bold mt-4 mb-2" {...props} />,
                                                            p: ({ node, ...props }) => <p className="mb-4 text-muted-foreground" {...props} />,
                                                            ul: ({ node, ...props }) => <ul className="list-disc pl-6 mb-4 space-y-1" {...props} />,
                                                            ol: ({ node, ...props }) => <ol className="list-decimal pl-6 mb-4 space-y-1" {...props} />,
                                                            li: ({ node, ...props }) => <li className="text-muted-foreground" {...props} />,
                                                            code: ({ node, ...props }) => <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs text-red-600 dark:text-red-400" {...props} />,
                                                        }}
                                                    >
                                                        {update.content}
                                                    </ReactMarkdown>
                                                </div>
                                            ) : (
                                                <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground leading-relaxed whitespace-pre-wrap">
                                                    {update.summary}
                                                </div>
                                            )}

                                            {/* Images Gallery with Captions and Lightbox */}
                                            {update.images && (update.images as string[]).length > 0 && (
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-6">
                                                    {(update.images as string[]).map((img, i) => {
                                                        const caption = update.image_captions?.[i];
                                                        return (
                                                            <div
                                                                key={i}
                                                                className="flex flex-col gap-3 group/img cursor-pointer"
                                                                onClick={() => setLightbox({ url: img, caption })}
                                                            >
                                                                <div className="rounded-xl overflow-hidden border border-border/50 shadow-sm aspect-video bg-muted relative">
                                                                    <img
                                                                        src={img}
                                                                        alt={caption || `Update image ${i}`}
                                                                        className="w-full h-full object-cover transition-transform duration-500 group-hover/img:scale-105"
                                                                    />
                                                                    <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/10 transition-colors flex items-center justify-center">
                                                                        <Badge className="opacity-0 group-hover/img:opacity-100 transition-opacity bg-white/20 backdrop-blur-md text-white border-white/30">
                                                                            Ampliar
                                                                        </Badge>
                                                                    </div>
                                                                </div>
                                                                {caption && (
                                                                    <p className="text-[11px] italic text-muted-foreground px-1 border-l-2 border-red-600/30">
                                                                        {caption}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}

                                            {update.author_name && (
                                                <div className="mt-6 pt-6 border-t border-border/50 flex items-center gap-3">
                                                    <div className="w-6 h-6 rounded-full bg-red-600/10 flex items-center justify-center text-red-600">
                                                        <Sparkles className="w-3.5 h-3.5" />
                                                    </div>
                                                    <span className="text-xs font-medium text-muted-foreground">
                                                        Actualizado por <span className="text-foreground">{update.author_name}</span>
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </Card>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {editingUpdate && (
                <EditUpdateDialog
                    update={editingUpdate}
                    isOpen={!!editingUpdate}
                    onClose={() => setEditingUpdate(null)}
                    onSuccess={fetchUpdates}
                />
            )}

            <DrawingViewer
                url={lightbox?.url || null}
                title={lightbox?.caption || "Imagen de Actualización"}
                onClose={() => setLightbox(null)}
                type="image"
            />
        </div>
    );
}
