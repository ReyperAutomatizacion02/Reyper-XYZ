"use client";

import { useEffect, useState, useTransition, useRef } from "react";
import {
    FlaskConical,
    Plus,
    Pencil,
    Trash2,
    Search,
    Clock,
    Building2,
    X,
    AlertCircle,
    Layers,
    ChevronDown,
    ChevronUp,
} from "lucide-react";
import { DashboardHeader } from "@/components/dashboard-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getTreatments, createTreatment, updateTreatment, deleteTreatment, type Treatment } from "./actions";
import { getErrorMessage } from "@/lib/action-result";

// ─── Tag input for suppliers ───────────────────────────────────────────────

function SupplierTagInput({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
    const [draft, setDraft] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    function addTag(raw: string) {
        const tag = raw.trim();
        if (!tag || value.includes(tag)) return;
        onChange([...value, tag]);
        setDraft("");
    }

    function removeTag(tag: string) {
        onChange(value.filter((t) => t !== tag));
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            addTag(draft);
        } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
            removeTag(value[value.length - 1]);
        }
    }

    return (
        <div
            className="flex min-h-10 w-full cursor-text flex-wrap gap-1.5 rounded-md border border-input bg-background px-3 py-2"
            onClick={() => inputRef.current?.focus()}
        >
            {value.map((tag) => (
                <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-md bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-600 dark:text-blue-400"
                >
                    {tag}
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            removeTag(tag);
                        }}
                        className="transition-colors hover:text-destructive"
                    >
                        <X className="h-3 w-3" />
                    </button>
                </span>
            ))}
            <input
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={() => addTag(draft)}
                placeholder={value.length === 0 ? "Escribe y presiona Enter para agregar..." : ""}
                className="min-w-[140px] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
        </div>
    );
}

// ─── Treatment Card ────────────────────────────────────────────────────────

const ACCENT_COLORS = [
    "border-l-blue-500",
    "border-l-violet-500",
    "border-l-amber-500",
    "border-l-emerald-500",
    "border-l-rose-500",
    "border-l-cyan-500",
    "border-l-orange-500",
    "border-l-pink-500",
];

function getAccentColor(name: string): string {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return ACCENT_COLORS[Math.abs(hash) % ACCENT_COLORS.length];
}

function TreatmentCard({
    treatment,
    onEdit,
    onDelete,
}: {
    treatment: Treatment;
    onEdit: (t: Treatment) => void;
    onDelete: (t: Treatment) => void;
}) {
    const [expanded, setExpanded] = useState(false);
    const visibleSuppliers = expanded ? treatment.suppliers : treatment.suppliers.slice(0, 3);
    const hasMore = treatment.suppliers.length > 3;
    const accent = getAccentColor(treatment.id);

    return (
        <div
            className={cn(
                "group relative flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-sm",
                "transition-all duration-200 hover:shadow-md",
                "border-l-4",
                accent
            )}
        >
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
                <h3 className="line-clamp-2 flex-1 text-sm font-semibold leading-tight text-foreground">
                    {treatment.name}
                </h3>
                <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => onEdit(treatment)}
                        title="Editar"
                    >
                        <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => onDelete(treatment)}
                        title="Eliminar"
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </div>

            {/* Stats row */}
            <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5 text-amber-500" />
                    <span className="font-medium text-foreground">{treatment.avg_lead_days}</span>
                    <span>día{treatment.avg_lead_days !== 1 ? "s" : ""} prom.</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Layers className="h-3.5 w-3.5 text-primary" />
                    <span className="font-medium text-foreground">{treatment.usage_count}</span>
                    <span>partida{treatment.usage_count !== 1 ? "s" : ""}</span>
                </div>
            </div>

            {/* Suppliers */}
            {treatment.suppliers.length > 0 ? (
                <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Building2 className="h-3 w-3" />
                        <span>Proveedores</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                        {visibleSuppliers.map((s) => (
                            <Badge key={s} variant="secondary" className="text-xs font-normal">
                                {s}
                            </Badge>
                        ))}
                        {hasMore && (
                            <button
                                onClick={() => setExpanded(!expanded)}
                                className="inline-flex items-center gap-0.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                            >
                                {expanded ? (
                                    <>
                                        <ChevronUp className="h-3 w-3" />
                                        Menos
                                    </>
                                ) : (
                                    <>
                                        <ChevronDown className="h-3 w-3" />+{treatment.suppliers.length - 3} más
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </div>
            ) : (
                <p className="text-xs italic text-muted-foreground/60">Sin proveedores registrados</p>
            )}
        </div>
    );
}

// ─── Form Dialog ───────────────────────────────────────────────────────────

function TreatmentDialog({
    open,
    onOpenChange,
    initial,
    onSaved,
}: {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    initial: Treatment | null;
    onSaved: (t: Treatment) => void;
}) {
    const [name, setName] = useState("");
    const [avgLeadDays, setAvgLeadDays] = useState(1);
    const [suppliers, setSuppliers] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();
    const isEdit = !!initial;

    useEffect(() => {
        if (open) {
            setName(initial?.name ?? "");
            setAvgLeadDays(initial?.avg_lead_days ?? 1);
            setSuppliers(initial?.suppliers ?? []);
            setError(null);
        }
    }, [open, initial]);

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
            const result = isEdit
                ? await updateTreatment(initial!.id, name, avgLeadDays, suppliers)
                : await createTreatment(name, avgLeadDays, suppliers);

            if (!result.success) {
                setError(getErrorMessage(result.error));
                return;
            }

            // Preserve usage_count when editing
            const saved: Treatment = {
                ...result.data,
                usage_count: isEdit ? initial!.usage_count : 0,
            };
            onSaved(saved);
            onOpenChange(false);
        });
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{isEdit ? "Editar tratamiento" : "Nuevo tratamiento"}</DialogTitle>
                    <DialogDescription>
                        {isEdit
                            ? "Modifica los datos del tratamiento."
                            : "Registra un nuevo tratamiento en el catálogo."}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-1">
                    {/* Name */}
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="t-name">Nombre</Label>
                        <Input
                            id="t-name"
                            value={name}
                            onChange={(e) => setName(e.target.value.toUpperCase())}
                            placeholder="Ej. NITRURADO Y PAVONADO"
                            required
                            autoFocus
                        />
                    </div>

                    {/* Lead days */}
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="t-days">Días promedio de entrega</Label>
                        <div className="relative">
                            <Clock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                id="t-days"
                                type="number"
                                min={0}
                                step={0.5}
                                value={avgLeadDays}
                                onChange={(e) => setAvgLeadDays(Number(e.target.value))}
                                className="pl-9"
                            />
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Tiempo estimado que tarda el proveedor en entregar.
                        </p>
                    </div>

                    {/* Suppliers */}
                    <div className="flex flex-col gap-1.5">
                        <Label>Proveedores</Label>
                        <SupplierTagInput value={suppliers} onChange={setSuppliers} />
                        <p className="text-xs text-muted-foreground">
                            Escribe el nombre y presiona Enter o coma para agregar.
                        </p>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                            <AlertCircle className="h-4 w-4 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    <DialogFooter className="pt-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={isPending}
                        >
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={isPending || !name.trim()}>
                            {isPending ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear tratamiento"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function TratamientosPage() {
    const [treatments, setTreatments] = useState<Treatment[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editTarget, setEditTarget] = useState<Treatment | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Treatment | null>(null);
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const [isPendingDelete, startDeleteTransition] = useTransition();

    useEffect(() => {
        getTreatments().then((result) => {
            if (result.success) setTreatments(result.data);
            setLoading(false);
        });
    }, []);

    const filtered = treatments.filter(
        (t) =>
            t.name.toLowerCase().includes(search.toLowerCase()) ||
            t.suppliers.some((s) => s.toLowerCase().includes(search.toLowerCase()))
    );

    function handleNewClick() {
        setEditTarget(null);
        setDialogOpen(true);
    }

    function handleEditClick(t: Treatment) {
        setEditTarget(t);
        setDialogOpen(true);
    }

    function handleDeleteClick(t: Treatment) {
        setDeleteTarget(t);
        setDeleteError(null);
    }

    function handleSaved(saved: Treatment) {
        setTreatments((prev) => {
            const idx = prev.findIndex((t) => t.id === saved.id);
            if (idx >= 0) {
                const next = [...prev];
                next[idx] = saved;
                return next;
            }
            return [...prev, saved].sort((a, b) => a.name.localeCompare(b.name));
        });
    }

    function confirmDelete() {
        if (!deleteTarget) return;
        setDeleteError(null);
        startDeleteTransition(async () => {
            const result = await deleteTreatment(deleteTarget.id);
            if (!result.success) {
                setDeleteError(getErrorMessage(result.error));
                return;
            }
            setTreatments((prev) => prev.filter((t) => t.id !== deleteTarget.id));
            setDeleteTarget(null);
        });
    }

    // Summary stats
    const totalWithSuppliers = treatments.filter((t) => t.suppliers.length > 0).length;
    const totalInUse = treatments.filter((t) => t.usage_count > 0).length;
    const avgDays =
        treatments.length > 0
            ? (treatments.reduce((sum, t) => sum + t.avg_lead_days, 0) / treatments.length).toFixed(1)
            : "—";

    return (
        <div className="mx-auto max-w-7xl space-y-6 p-6 duration-500 animate-in fade-in">
            <DashboardHeader
                title="Tratamientos"
                description="Catálogo de tratamientos y acabados superficiales"
                icon={<FlaskConical className="h-8 w-8 text-[#EC1C21]" />}
                backUrl="/dashboard/logistica"
                iconClassName="bg-red-500/10 text-[#EC1C21]"
            />

            {/* Stats bar */}
            {!loading && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                        { label: "Total", value: treatments.length, icon: FlaskConical, color: "text-primary" },
                        { label: "En uso", value: totalInUse, icon: Layers, color: "text-emerald-500" },
                        {
                            label: "Con proveedores",
                            value: totalWithSuppliers,
                            icon: Building2,
                            color: "text-blue-500",
                        },
                        { label: "Días prom.", value: avgDays, icon: Clock, color: "text-amber-500" },
                    ].map(({ label, value, icon: Icon, color }) => (
                        <div key={label} className="flex items-center gap-3 rounded-xl border bg-card p-4">
                            <div className={cn("rounded-lg bg-muted p-2", color)}>
                                <Icon className="h-4 w-4" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">{label}</p>
                                <p className="text-lg font-semibold leading-tight">{value}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Toolbar */}
            <div className="flex items-center gap-3">
                <div className="relative max-w-sm flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Buscar por nombre o proveedor..."
                        className="pl-9"
                    />
                    {search && (
                        <button
                            onClick={() => setSearch("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </div>
                <Button onClick={handleNewClick} className="shrink-0 gap-2">
                    <Plus className="h-4 w-4" />
                    Nuevo tratamiento
                </Button>
            </div>

            {/* Grid */}
            {loading ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <Skeleton key={i} className="h-40 rounded-xl" />
                    ))}
                </div>
            ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
                    <FlaskConical className="h-12 w-12 text-muted-foreground/30" />
                    <p className="font-medium text-muted-foreground">
                        {search ? "Sin resultados para tu búsqueda" : "No hay tratamientos registrados"}
                    </p>
                    {!search && (
                        <Button variant="outline" onClick={handleNewClick} className="mt-1 gap-2">
                            <Plus className="h-4 w-4" />
                            Crear el primero
                        </Button>
                    )}
                </div>
            ) : (
                <>
                    {search && (
                        <p className="-mb-2 text-sm text-muted-foreground">
                            {filtered.length} resultado{filtered.length !== 1 ? "s" : ""} para &quot;{search}&quot;
                        </p>
                    )}
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {filtered.map((t) => (
                            <TreatmentCard
                                key={t.id}
                                treatment={t}
                                onEdit={handleEditClick}
                                onDelete={handleDeleteClick}
                            />
                        ))}
                    </div>
                </>
            )}

            {/* Create / Edit Dialog */}
            <TreatmentDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                initial={editTarget}
                onSaved={handleSaved}
            />

            {/* Delete Alert */}
            <AlertDialog
                open={!!deleteTarget}
                onOpenChange={(v) => {
                    if (!v) setDeleteTarget(null);
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar tratamiento?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Se eliminará <span className="font-semibold text-foreground">{deleteTarget?.name}</span> del
                            catálogo. Esta acción no se puede deshacer.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    {deleteError && (
                        <div className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                            <span>{deleteError}</span>
                        </div>
                    )}
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isPendingDelete}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmDelete}
                            disabled={isPendingDelete}
                            className="bg-destructive hover:bg-destructive/90"
                        >
                            {isPendingDelete ? "Eliminando..." : "Eliminar"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
