"use client";

import { useState, useTransition } from "react";
import { Clock, Plus, Pencil, Trash2, Loader2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { upsertWorkShift, deleteWorkShift, type WorkShiftRow } from "@/app/dashboard/admin-panel/actions";
import { toast } from "sonner";

const DAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const DEFAULT_WORK_DAYS = [1, 2, 3, 4, 5, 6];

interface EditingShift {
    id?: string;
    name: string;
    start_time: string;
    end_time: string;
    days_of_week: number[];
    active: boolean;
    sort_order: number;
}

function emptyShift(): EditingShift {
    return {
        name: "",
        start_time: "06:00",
        end_time: "14:00",
        days_of_week: DEFAULT_WORK_DAYS,
        active: true,
        sort_order: 0,
    };
}

interface WorkShiftManagerProps {
    initialShifts: WorkShiftRow[];
}

export function WorkShiftManager({ initialShifts }: WorkShiftManagerProps) {
    const [shifts, setShifts] = useState<WorkShiftRow[]>(initialShifts);
    const [editing, setEditing] = useState<EditingShift | null>(null);
    const [isPending, startTransition] = useTransition();

    const openNew = () => setEditing(emptyShift());
    const openEdit = (s: WorkShiftRow) =>
        setEditing({
            id: s.id,
            name: s.name,
            start_time: s.start_time.slice(0, 5), // "HH:MM"
            end_time: s.end_time.slice(0, 5),
            days_of_week: s.days_of_week,
            active: s.active,
            sort_order: s.sort_order,
        });
    const cancelEdit = () => setEditing(null);

    const toggleDay = (day: number) => {
        if (!editing) return;
        const days = editing.days_of_week.includes(day)
            ? editing.days_of_week.filter((d) => d !== day)
            : [...editing.days_of_week, day].sort((a, b) => a - b);
        setEditing({ ...editing, days_of_week: days });
    };

    const saveShift = () => {
        if (!editing) return;
        if (!editing.name.trim()) {
            toast.error("El nombre es obligatorio");
            return;
        }
        if (!editing.start_time || !editing.end_time) {
            toast.error("Ingresa hora de inicio y fin");
            return;
        }
        if (editing.days_of_week.length === 0) {
            toast.error("Selecciona al menos un día");
            return;
        }

        startTransition(async () => {
            try {
                const result = await upsertWorkShift({
                    ...editing,
                    start_time: editing.start_time + ":00",
                    end_time: editing.end_time + ":00",
                });
                const saved = result.data as WorkShiftRow;
                setShifts((prev) => {
                    const idx = prev.findIndex((s) => s.id === saved.id);
                    return idx >= 0 ? prev.map((s) => (s.id === saved.id ? saved : s)) : [...prev, saved];
                });
                setEditing(null);
                toast.success(editing.id ? "Turno actualizado" : "Turno creado");
            } catch (e: any) {
                toast.error(e.message || "Error al guardar");
            }
        });
    };

    const removeShift = (id: string) => {
        startTransition(async () => {
            try {
                await deleteWorkShift(id);
                setShifts((prev) => prev.filter((s) => s.id !== id));
                toast.success("Turno eliminado");
            } catch (e: any) {
                toast.error(e.message || "Error al eliminar");
            }
        });
    };

    const toggleActive = (shift: WorkShiftRow) => {
        startTransition(async () => {
            try {
                const result = await upsertWorkShift({
                    ...shift,
                    active: !shift.active,
                });
                const saved = result.data as WorkShiftRow;
                setShifts((prev) => prev.map((s) => (s.id === saved.id ? saved : s)));
            } catch (e: any) {
                toast.error(e.message || "Error al actualizar");
            }
        });
    };

    const sorted = [...shifts].sort((a, b) => a.sort_order - b.sort_order || a.start_time.localeCompare(b.start_time));

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                        Solo los turnos <strong>activos</strong> se usan en la planeación automática.
                    </span>
                </div>
                <Button size="sm" onClick={openNew} disabled={isPending}>
                    <Plus className="mr-1 h-4 w-4" /> Agregar turno
                </Button>
            </div>

            {/* Shift list */}
            <div className="divide-y rounded-md border">
                {sorted.length === 0 && (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                        Sin turnos configurados. Se usará el horario por defecto (Lun-Sáb 06:00-22:00).
                    </p>
                )}
                {sorted.map((shift) => (
                    <div key={shift.id} className="flex items-center gap-3 px-4 py-3">
                        {/* Active toggle */}
                        <button
                            className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
                                shift.active
                                    ? "bg-green-100 text-green-700 hover:bg-green-200"
                                    : "bg-zinc-100 text-zinc-400 hover:bg-zinc-200"
                            }`}
                            onClick={() => toggleActive(shift)}
                            disabled={isPending}
                            title={shift.active ? "Activo (click para desactivar)" : "Inactivo (click para activar)"}
                        >
                            {shift.active ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                        </button>

                        {/* Name & times */}
                        <div className="min-w-0 flex-1">
                            <p
                                className={`truncate text-sm font-medium ${!shift.active ? "text-muted-foreground line-through" : ""}`}
                            >
                                {shift.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                {shift.start_time.slice(0, 5)} – {shift.end_time.slice(0, 5)}
                            </p>
                        </div>

                        {/* Days */}
                        <div className="flex gap-0.5">
                            {DAY_LABELS.map((label, i) => (
                                <span
                                    key={i}
                                    className={`rounded px-1 py-0.5 text-[10px] ${
                                        shift.days_of_week.includes(i)
                                            ? "bg-primary/10 font-semibold text-primary"
                                            : "text-muted-foreground/40"
                                    }`}
                                >
                                    {label}
                                </span>
                            ))}
                        </div>

                        {/* Actions */}
                        <div className="flex gap-1">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => openEdit(shift)}
                                disabled={isPending}
                            >
                                <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={() => removeShift(shift.id)}
                                disabled={isPending}
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Inline form */}
            {editing && (
                <div className="space-y-3 rounded-md border bg-muted/30 p-4">
                    <p className="text-sm font-semibold">{editing.id ? "Editar turno" : "Nuevo turno"}</p>
                    <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-3 sm:col-span-1">
                            <label className="mb-1 block text-xs text-muted-foreground">Nombre</label>
                            <Input
                                value={editing.name}
                                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                                placeholder="Turno 3"
                                className="h-8 text-sm"
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs text-muted-foreground">Inicio</label>
                            <Input
                                type="time"
                                value={editing.start_time}
                                onChange={(e) => setEditing({ ...editing, start_time: e.target.value })}
                                className="h-8 text-sm"
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs text-muted-foreground">Fin</label>
                            <Input
                                type="time"
                                value={editing.end_time}
                                onChange={(e) => setEditing({ ...editing, end_time: e.target.value })}
                                className="h-8 text-sm"
                            />
                        </div>
                    </div>

                    {/* Days selector */}
                    <div>
                        <label className="mb-1.5 block text-xs text-muted-foreground">Días activos</label>
                        <div className="flex gap-1.5">
                            {DAY_LABELS.map((label, i) => (
                                <button
                                    key={i}
                                    type="button"
                                    onClick={() => toggleDay(i)}
                                    className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                                        editing.days_of_week.includes(i)
                                            ? "bg-primary text-primary-foreground"
                                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                                    }`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                        <Button variant="ghost" size="sm" onClick={cancelEdit} disabled={isPending}>
                            Cancelar
                        </Button>
                        <Button size="sm" onClick={saveShift} disabled={isPending}>
                            {isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                            Guardar
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
