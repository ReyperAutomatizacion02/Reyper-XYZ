"use client";

import React from "react";
import { FlaskConical, Trash2, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { EvaluationStep, isTreatmentStep } from "@/lib/scheduling-utils";

interface EvaluationStepRowProps {
    step: EvaluationStep;
    index: number;
    quantity: number;
    machines: { name: string }[];
    treatments: { id: string; name: string; avg_lead_days: number | null }[];
    onToggleType: (index: number) => void;
    onUpdateMachine: (
        index: number,
        field: "machine" | "setup_time" | "machining_time" | "piece_change_time",
        value: string | number
    ) => void;
    onTreatmentSelect: (index: number, treatmentId: string) => void;
    onUpdateDays: (index: number, days: number) => void;
    onRemove: (index: number) => void;
}

const TIME_FIELDS = {
    setup_time: {
        label: "Set Up Inicial",
        sublabel: "una vez",
        labelCls: "text-sky-700 dark:text-sky-400",
        inputCls: "border-sky-200 focus:border-sky-400 bg-sky-50/50 dark:bg-sky-950/20 dark:border-sky-800",
        unitCls: "text-sky-500",
        badgeCls: "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400",
    },
    machining_time: {
        label: "Maquinado",
        sublabel: "por pieza",
        labelCls: "text-emerald-700 dark:text-emerald-400",
        inputCls:
            "border-emerald-200 focus:border-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-800",
        unitCls: "text-emerald-500",
        badgeCls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
    },
    piece_change_time: {
        label: "Set Up",
        sublabel: "por cambio",
        labelCls: "text-violet-700 dark:text-violet-400",
        inputCls:
            "border-violet-200 focus:border-violet-400 bg-violet-50/50 dark:bg-violet-950/20 dark:border-violet-800",
        unitCls: "text-violet-500",
        badgeCls: "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400",
    },
} as const;

/** Renders h + m inputs for a time value in hours (fractional). */
function HourMinuteInput({
    value,
    onChange,
    disabled,
    inputCls,
    unitCls,
}: {
    value: number;
    onChange: (hours: number) => void;
    disabled?: boolean;
    inputCls?: string;
    unitCls?: string;
}) {
    const h = Math.floor(value);
    const m = Math.round((value % 1) * 60);
    return (
        <div className="flex items-center gap-1">
            <Input
                type="number"
                min="0"
                step="1"
                placeholder="0"
                disabled={disabled}
                value={h > 0 ? h : ""}
                onChange={(e) => {
                    const newH = parseInt(e.target.value) || 0;
                    onChange(newH + m / 60);
                }}
                className={`h-8 w-11 px-1.5 text-center text-xs disabled:opacity-30 ${inputCls ?? ""}`}
            />
            <span className={`text-[10px] font-bold ${unitCls ?? "text-muted-foreground"}`}>h</span>
            <Input
                type="number"
                min="0"
                max="59"
                step="5"
                placeholder="0"
                disabled={disabled}
                value={m > 0 ? m : ""}
                onChange={(e) => {
                    const newM = Math.min(59, parseInt(e.target.value) || 0);
                    onChange(h + newM / 60);
                }}
                className={`h-8 w-11 px-1.5 text-center text-xs disabled:opacity-30 ${inputCls ?? ""}`}
            />
            <span className={`text-[10px] font-bold ${unitCls ?? "text-muted-foreground"}`}>m</span>
        </div>
    );
}

/** Formats fractional hours as "Xh Ym" for display. */
export function formatHours(hours: number): string {
    if (hours <= 0) return "—";
    const h = Math.floor(hours);
    const m = Math.round((hours % 1) * 60);
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
}

export function EvaluationStepRow({
    step,
    index,
    quantity,
    machines,
    treatments,
    onToggleType,
    onUpdateMachine,
    onTreatmentSelect,
    onUpdateDays,
    onRemove,
}: EvaluationStepRowProps) {
    const isTreatment = isTreatmentStep(step);
    const isMultiPiece = quantity > 1;
    const hasMachine = !isTreatment && !!step.machine;

    return (
        <div className="overflow-hidden rounded-xl border border-border/60 bg-background shadow-sm">
            {/* Row 1: type toggle + selector + delete */}
            <div className="flex items-center gap-2 bg-muted/30 px-3 py-2.5">
                <button
                    type="button"
                    onClick={() => onToggleType(index)}
                    title={isTreatment ? "Cambiar a Máquina" : "Cambiar a Tratamiento"}
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors ${
                        isTreatment
                            ? "border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-100"
                            : "border-border bg-background text-muted-foreground hover:bg-muted"
                    }`}
                >
                    {isTreatment ? <FlaskConical className="h-3.5 w-3.5" /> : <Wrench className="h-3.5 w-3.5" />}
                </button>

                <span
                    className={`text-[10px] font-black uppercase tracking-wider ${isTreatment ? "text-amber-600" : "text-muted-foreground"}`}
                >
                    Paso {index + 1}: {isTreatment ? "Tratamiento" : "Máquina"}
                </span>

                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onRemove(index)}
                    className="ml-auto h-7 w-7 shrink-0 text-muted-foreground/60 transition-colors hover:bg-red-50 hover:text-red-500"
                >
                    <Trash2 className="h-3.5 w-3.5" />
                </Button>
            </div>

            {/* Row 2: selector */}
            <div className="px-3 pb-2 pt-2.5">
                {isTreatment ? (
                    <div className="flex items-end gap-2">
                        <div className="flex-1 space-y-1">
                            <Label className="text-[9px] font-black uppercase text-amber-600 opacity-0">T</Label>
                            <SearchableSelect
                                value={step.treatment_id}
                                onChange={(val) => onTreatmentSelect(index, val)}
                                placeholder="Seleccionar tratamiento"
                                options={treatments.map((t) => ({
                                    value: t.id,
                                    label: t.avg_lead_days != null ? `${t.name} (${t.avg_lead_days}d)` : t.name,
                                }))}
                            />
                        </div>
                        <div className="w-16 space-y-1">
                            <Label className="text-[9px] font-black uppercase text-amber-600">Días</Label>
                            <div className="relative">
                                <Input
                                    type="number"
                                    min="0.5"
                                    step="0.5"
                                    value={step.days || ""}
                                    onChange={(e) => onUpdateDays(index, parseFloat(e.target.value) || 0)}
                                    className="h-9 border-amber-200 bg-amber-50/40 pr-5 text-xs focus:border-amber-500"
                                />
                                <FlaskConical className="absolute right-1.5 top-2.5 h-3 w-3 text-amber-400" />
                            </div>
                        </div>
                    </div>
                ) : (
                    <SearchableSelect
                        value={step.machine}
                        onChange={(val) => onUpdateMachine(index, "machine", val)}
                        placeholder="Seleccionar máquina"
                        options={machines.map((m) => ({ value: m.name, label: m.name }))}
                    />
                )}
            </div>

            {/* Row 3: time breakdown (machine steps only) */}
            {!isTreatment && (
                <div className="border-t border-border/40 px-3 pb-3 pt-2.5">
                    {!hasMachine ? (
                        <p className="py-1 text-center text-[10px] text-muted-foreground/60">
                            Selecciona una máquina para asignar tiempos
                        </p>
                    ) : (
                        <>
                            <div className="grid grid-cols-3 gap-2">
                                {(["setup_time", "piece_change_time", "machining_time"] as const).map((field) => {
                                    const cfg = TIME_FIELDS[field];
                                    const val = step[field] ?? 0;
                                    const disabled = field === "piece_change_time" && !isMultiPiece;
                                    return (
                                        <div
                                            key={field}
                                            className={`space-y-1.5 rounded-lg border p-2 transition-opacity ${
                                                disabled ? "opacity-40" : ""
                                            } ${
                                                disabled
                                                    ? "border-border/30 bg-muted/10"
                                                    : `border-current/10 ${cfg.badgeCls
                                                          .split(" ")
                                                          .map((c) =>
                                                              c.startsWith("bg-") ? `border-${c.slice(3)}` : ""
                                                          )
                                                          .filter(Boolean)
                                                          .join(" ")}`
                                            }`}
                                            style={{ borderColor: "transparent" }}
                                        >
                                            <div className={`rounded-md px-1.5 py-0.5 text-center ${cfg.badgeCls}`}>
                                                <p
                                                    className={`text-[9px] font-black uppercase leading-none ${cfg.labelCls}`}
                                                >
                                                    {cfg.label}
                                                </p>
                                                <p className={`text-[8px] font-medium opacity-75 ${cfg.labelCls}`}>
                                                    {cfg.sublabel}
                                                </p>
                                            </div>
                                            <HourMinuteInput
                                                value={val}
                                                onChange={(v) => onUpdateMachine(index, field, v)}
                                                disabled={disabled}
                                                inputCls={cfg.inputCls}
                                                unitCls={cfg.unitCls}
                                            />
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Step total */}
                            <div className="mt-2 flex items-center justify-between rounded-md bg-muted/40 px-2.5 py-1.5">
                                <span className="text-[9px] text-muted-foreground">
                                    {isMultiPiece ? `${quantity} piezas` : "1 pieza"}
                                </span>
                                <span className="text-[11px] font-black tabular-nums text-foreground/80">
                                    {formatHours(step.hours)}
                                </span>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
