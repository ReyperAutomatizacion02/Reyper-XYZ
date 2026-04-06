"use client";

import { useState, useTransition, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import { Cpu, Pencil, Plus, Trash2, Images, Upload, Star, X, CheckCircle2, Loader2, ImageOff } from "lucide-react";
import { toast } from "sonner";
import { DashboardHeader } from "@/components/dashboard-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { upsertMachine, deleteMachine, setMachineCoverImage } from "@/app/dashboard/produccion/actions";
import { getErrorMessage } from "@/lib/action-result";
import { uploadMachineImage, listMachineImages, deleteMachineImageFromStorage } from "./upload-client";

type Machine = {
    id: string;
    name: string;
    brand: string | null;
    model: string | null;
    serial_number: string | null;
    location: string | null;
    is_active: boolean | null;
    cover_image_url: string | null;
    created_at: string | null;
};

type MachineImage = { name: string; url: string };

interface Props {
    machines: Machine[];
}

// ─── Image Gallery Modal ──────────────────────────────────────────────────────

function ImageGalleryModal({
    machine,
    onClose,
    onCoverChange,
}: {
    machine: Machine;
    onClose: () => void;
    onCoverChange: (url: string | null) => void;
}) {
    const [images, setImages] = useState<MachineImage[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [deletingName, setDeletingName] = useState<string | null>(null);
    const [settingCover, setSettingCover] = useState<string | null>(null);
    const [currentCover, setCurrentCover] = useState<string | null>(machine.cover_image_url);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const loadImages = useCallback(async () => {
        setLoading(true);
        const imgs = await listMachineImages(machine.id);
        setImages(imgs);
        setLoading(false);
    }, [machine.id]);

    useEffect(() => {
        loadImages();
    }, [loadImages]);

    async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        const url = await uploadMachineImage(file, machine.id);
        if (url) {
            toast.success("Imagen subida");
            await loadImages();
            // Auto-set cover if this is the first image
            if (images.length === 0 && !currentCover) {
                await handleSetCover(url, false);
            }
        }
        setUploading(false);
        // Reset input so the same file can be re-selected
        if (fileInputRef.current) fileInputRef.current.value = "";
    }

    async function handleSetCover(url: string, notify = true) {
        setSettingCover(url);
        try {
            await setMachineCoverImage(machine.id, url);
            setCurrentCover(url);
            onCoverChange(url);
            if (notify) toast.success("Imagen establecida como portada");
        } catch {
            toast.error("Error al establecer la portada");
        }
        setSettingCover(null);
    }

    async function handleDelete(img: MachineImage) {
        setDeletingName(img.name);
        const ok = await deleteMachineImageFromStorage(machine.id, img.name);
        if (ok) {
            // If we deleted the cover, clear it from DB too
            if (currentCover === img.url) {
                await setMachineCoverImage(machine.id, null);
                setCurrentCover(null);
                onCoverChange(null);
            }
            setImages((prev) => prev.filter((i) => i.name !== img.name));
            toast.success("Imagen eliminada");
        }
        setDeletingName(null);
    }

    const isCover = (url: string) => currentCover === url;

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-h-[90vh] w-full max-w-3xl overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Images className="h-5 w-5 text-orange-500" />
                        Galería de imágenes — {machine.name}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Upload button */}
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                            {images.length} {images.length === 1 ? "imagen" : "imágenes"} almacenadas
                        </p>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                        >
                            {uploading ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Upload className="mr-2 h-4 w-4" />
                            )}
                            {uploading ? "Subiendo..." : "Subir imagen"}
                        </Button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleUpload}
                        />
                    </div>

                    {/* Grid */}
                    {loading ? (
                        <div className="flex h-40 items-center justify-center">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : images.length === 0 ? (
                        <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-muted-foreground">
                            <ImageOff className="h-8 w-8 opacity-40" />
                            <p className="text-sm">Sin imágenes. Sube la primera con el botón de arriba.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                            {images.map((img) => (
                                <div
                                    key={img.name}
                                    className={`group relative overflow-hidden rounded-xl border-2 transition-colors ${
                                        isCover(img.url)
                                            ? "border-orange-500"
                                            : "border-border hover:border-muted-foreground/40"
                                    }`}
                                >
                                    <div className="relative aspect-square bg-muted">
                                        <Image
                                            src={img.url}
                                            alt={img.name}
                                            fill
                                            className="object-cover"
                                            sizes="(max-width: 640px) 50vw, 33vw"
                                        />
                                    </div>

                                    {/* Cover badge */}
                                    {isCover(img.url) && (
                                        <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-orange-500 px-2 py-0.5 text-xs font-medium text-white shadow">
                                            <Star className="h-3 w-3 fill-white" />
                                            Portada
                                        </div>
                                    )}

                                    {/* Action overlay */}
                                    <div className="absolute inset-0 flex items-end justify-between gap-1 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                                        {!isCover(img.url) && (
                                            <Button
                                                size="sm"
                                                variant="secondary"
                                                className="h-7 px-2 text-xs"
                                                disabled={settingCover === img.url}
                                                onClick={() => handleSetCover(img.url)}
                                            >
                                                {settingCover === img.url ? (
                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                ) : (
                                                    <CheckCircle2 className="mr-1 h-3 w-3" />
                                                )}
                                                Portada
                                            </Button>
                                        )}
                                        <Button
                                            size="icon"
                                            variant="destructive"
                                            className="ml-auto h-7 w-7"
                                            disabled={deletingName === img.name}
                                            onClick={() => handleDelete(img)}
                                        >
                                            {deletingName === img.name ? (
                                                <Loader2 className="h-3 w-3 animate-spin" />
                                            ) : (
                                                <Trash2 className="h-3 w-3" />
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Cerrar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ─── Machine Form Modal ───────────────────────────────────────────────────────

type FormData = {
    name: string;
    brand: string;
    model: string;
    serial_number: string;
    location: string;
    is_active: boolean;
};

function MachineFormModal({
    editing,
    onClose,
    onSaved,
}: {
    editing: Machine | null;
    onClose: () => void;
    onSaved: (machine: Machine) => void;
}) {
    const [form, setForm] = useState<FormData>({
        name: editing?.name ?? "",
        brand: editing?.brand ?? "",
        model: editing?.model ?? "",
        serial_number: editing?.serial_number ?? "",
        location: editing?.location ?? "",
        is_active: editing?.is_active ?? true,
    });
    const [coverUrl, setCoverUrl] = useState<string | null>(editing?.cover_image_url ?? null);
    const [showGallery, setShowGallery] = useState(false);
    const [isPending, startTransition] = useTransition();

    function setField<K extends keyof FormData>(key: K, value: FormData[K]) {
        setForm((prev) => ({ ...prev, [key]: value }));
    }

    function handleSave() {
        if (!form.name.trim()) return;
        startTransition(async () => {
            const result = await upsertMachine({
                id: editing?.id,
                name: form.name.trim(),
                brand: form.brand.trim() || null,
                model: form.model.trim() || null,
                serial_number: form.serial_number.trim() || null,
                location: form.location.trim() || null,
                is_active: form.is_active,
                cover_image_url: coverUrl,
            });
            if (result.success) {
                onSaved(result.data as Machine);
                toast.success(editing ? "Máquina actualizada" : "Máquina creada");
                onClose();
            } else {
                toast.error(getErrorMessage(result.error));
            }
        });
    }

    return (
        <>
            <Dialog open onOpenChange={(open) => !open && onClose()}>
                <DialogContent className="max-h-[90vh] w-full max-w-lg overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editing ? "Editar máquina" : "Nueva máquina"}</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 py-1">
                        {/* Name */}
                        <div className="space-y-1.5">
                            <Label htmlFor="m-name">
                                Nombre <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="m-name"
                                value={form.name}
                                onChange={(e) => setField("name", e.target.value)}
                                placeholder="Ej. CNC-01, Torno 3..."
                                autoFocus
                            />
                        </div>

                        {/* Brand + Model */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label htmlFor="m-brand">Fabricante / Marca</Label>
                                <Input
                                    id="m-brand"
                                    value={form.brand}
                                    onChange={(e) => setField("brand", e.target.value)}
                                    placeholder="Ej. Haas, Mazak..."
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="m-model">Modelo</Label>
                                <Input
                                    id="m-model"
                                    value={form.model}
                                    onChange={(e) => setField("model", e.target.value)}
                                    placeholder="Ej. VF-2, QT-250..."
                                />
                            </div>
                        </div>

                        {/* Serial + Location */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label htmlFor="m-serial">Número de serie</Label>
                                <Input
                                    id="m-serial"
                                    value={form.serial_number}
                                    onChange={(e) => setField("serial_number", e.target.value)}
                                    placeholder="Ej. SN-2024-001"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="m-location">Ubicación</Label>
                                <Input
                                    id="m-location"
                                    value={form.location}
                                    onChange={(e) => setField("location", e.target.value)}
                                    placeholder="Ej. Nave A, Planta 2..."
                                />
                            </div>
                        </div>

                        {/* Active toggle */}
                        <div className="flex items-center justify-between rounded-lg border px-4 py-3">
                            <div>
                                <p className="text-sm font-medium">Máquina activa</p>
                                <p className="text-xs text-muted-foreground">
                                    Las máquinas inactivas no aparecen en planeación
                                </p>
                            </div>
                            <Switch checked={form.is_active} onCheckedChange={(v) => setField("is_active", v)} />
                        </div>

                        {/* Images section — only for existing machines */}
                        {editing && (
                            <div className="space-y-2 rounded-lg border px-4 py-3">
                                <p className="text-sm font-medium">Imagen principal</p>
                                <div className="flex items-center gap-3">
                                    {coverUrl ? (
                                        <div className="relative h-16 w-16 overflow-hidden rounded-lg border">
                                            <Image
                                                src={coverUrl}
                                                alt="Portada"
                                                fill
                                                className="object-cover"
                                                sizes="64px"
                                            />
                                            <button
                                                type="button"
                                                className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                                                onClick={() => setCoverUrl(null)}
                                                title="Quitar imagen principal"
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed bg-muted">
                                            <ImageOff className="h-5 w-5 text-muted-foreground/50" />
                                        </div>
                                    )}
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setShowGallery(true)}
                                    >
                                        <Images className="mr-2 h-4 w-4" />
                                        Administrar galería
                                    </Button>
                                </div>
                            </div>
                        )}

                        {!editing && (
                            <p className="text-xs text-muted-foreground">
                                Podrás subir imágenes después de crear la máquina.
                            </p>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={onClose} disabled={isPending}>
                            Cancelar
                        </Button>
                        <Button onClick={handleSave} disabled={isPending || !form.name.trim()}>
                            {isPending ? "Guardando..." : "Guardar"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {showGallery && editing && (
                <ImageGalleryModal
                    machine={{ ...editing, cover_image_url: coverUrl }}
                    onClose={() => setShowGallery(false)}
                    onCoverChange={(url) => setCoverUrl(url)}
                />
            )}
        </>
    );
}

// ─── Main Client Component ────────────────────────────────────────────────────

export function MaquinasClient({ machines: initial }: Props) {
    const [machines, setMachines] = useState<Machine[]>(initial);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<Machine | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Machine | null>(null);
    const [galleryTarget, setGalleryTarget] = useState<Machine | null>(null);
    const [isPending, startTransition] = useTransition();

    function openCreate() {
        setEditing(null);
        setModalOpen(true);
    }

    function openEdit(machine: Machine) {
        setEditing(machine);
        setModalOpen(true);
    }

    function handleSaved(machine: Machine) {
        setMachines((prev) => {
            const exists = prev.some((m) => m.id === machine.id);
            const updated = exists ? prev.map((m) => (m.id === machine.id ? machine : m)) : [...prev, machine];
            return updated.sort((a, b) => a.name.localeCompare(b.name));
        });
    }

    function handleDelete() {
        if (!deleteTarget) return;
        startTransition(async () => {
            const result = await deleteMachine(deleteTarget.id);
            if (result.success) {
                setMachines((prev) => prev.filter((m) => m.id !== deleteTarget.id));
                toast.success("Máquina eliminada");
            } else {
                toast.error(getErrorMessage(result.error));
            }
            setDeleteTarget(null);
        });
    }

    return (
        <div className="mx-auto max-w-4xl space-y-6 p-6">
            <div className="flex items-start justify-between gap-4">
                <DashboardHeader
                    title="Gestión de Máquinas"
                    description="Administra el catálogo de máquinas de producción"
                    icon={<Cpu className="h-8 w-8" />}
                    backUrl="/dashboard/produccion"
                    iconClassName="bg-orange-500/10 text-orange-500"
                />
                <Button onClick={openCreate} className="mt-1 shrink-0">
                    <Plus className="mr-2 h-4 w-4" />
                    Nueva máquina
                </Button>
            </div>

            {machines.length === 0 ? (
                <div className="flex min-h-[200px] flex-col items-center justify-center rounded-xl border border-dashed text-center">
                    <Cpu className="mb-3 h-10 w-10 text-muted-foreground/50" />
                    <p className="text-sm font-medium text-muted-foreground">No hay máquinas registradas</p>
                    <p className="mt-1 text-xs text-muted-foreground/70">
                        Crea la primera máquina con el botón de arriba
                    </p>
                </div>
            ) : (
                <div className="overflow-hidden rounded-xl border">
                    {machines.map((machine, i) => (
                        <div
                            key={machine.id}
                            className={`flex items-center gap-3 px-4 py-3 ${i < machines.length - 1 ? "border-b" : ""}`}
                        >
                            {/* Thumbnail */}
                            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border bg-muted">
                                {machine.cover_image_url ? (
                                    <Image
                                        src={machine.cover_image_url}
                                        alt={machine.name}
                                        fill
                                        className="object-cover"
                                        sizes="40px"
                                    />
                                ) : (
                                    <div className="flex h-full w-full items-center justify-center">
                                        <Cpu className="h-5 w-5 text-orange-400" />
                                    </div>
                                )}
                            </div>

                            {/* Info */}
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-sm font-medium">{machine.name}</span>
                                    {machine.is_active === false && (
                                        <Badge variant="secondary" className="text-xs">
                                            Inactiva
                                        </Badge>
                                    )}
                                </div>
                                <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                                    {machine.brand && (
                                        <span className="text-xs text-muted-foreground">{machine.brand}</span>
                                    )}
                                    {machine.model && (
                                        <span className="text-xs text-muted-foreground">{machine.model}</span>
                                    )}
                                    {machine.location && (
                                        <span className="text-xs text-muted-foreground">📍 {machine.location}</span>
                                    )}
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex shrink-0 gap-1">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                    onClick={() => setGalleryTarget(machine)}
                                    title="Galería de imágenes"
                                >
                                    <Images className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                    onClick={() => openEdit(machine)}
                                    title="Editar"
                                >
                                    <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                    onClick={() => setDeleteTarget(machine)}
                                    title="Eliminar"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create / Edit Modal */}
            {modalOpen && (
                <MachineFormModal editing={editing} onClose={() => setModalOpen(false)} onSaved={handleSaved} />
            )}

            {/* Gallery from list row */}
            {galleryTarget && (
                <ImageGalleryModal
                    machine={galleryTarget}
                    onClose={() => setGalleryTarget(null)}
                    onCoverChange={(url) => {
                        setMachines((prev) =>
                            prev.map((m) => (m.id === galleryTarget.id ? { ...m, cover_image_url: url } : m))
                        );
                    }}
                />
            )}

            {/* Delete Confirmation */}
            <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Eliminar máquina</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">
                        ¿Estás seguro de eliminar{" "}
                        <span className="font-semibold text-foreground">{deleteTarget?.name}</span>? Esta acción no se
                        puede deshacer.
                    </p>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isPending}>
                            Cancelar
                        </Button>
                        <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
                            {isPending ? "Eliminando..." : "Eliminar"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
