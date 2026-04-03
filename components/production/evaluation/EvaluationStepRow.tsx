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
    machines: { name: string }[];
    treatments: { id: string; name: string; avg_lead_days: number | null }[];
    onToggleType: (index: number) => void;
    onUpdateMachine: (index: number, field: "machine" | "hours", value: string | number) => void;
    onTreatmentSelect: (index: number, treatmentId: string) => void;
    onUpdateDays: (index: number, days: number) => void;
    onRemove: (index: number) => void;
}

export function EvaluationStepRow({
    step,
    index,
    machines,
    treatments,
    onToggleType,
    onUpdateMachine,
    onTreatmentSelect,
    onUpdateDays,
    onRemove,
}: EvaluationStepRowProps) {
    const isTreatment = isTreatmentStep(step);

    return (
        <div className="flex items-end gap-2 border-b border-border/50 pb-3 last:border-0">
            {/* Type toggle button */}
            <div className="flex shrink-0 flex-col gap-1">
                <Label className="text-[10px] uppercase opacity-0">T</Label>
                <button
                    type="button"
                    onClick={() => onToggleType(index)}
                    title={isTreatment ? "Cambiar a Máquina" : "Cambiar a Tratamiento"}
                    className={`flex h-9 w-9 items-center justify-center rounded-lg border transition-colors ${
                        isTreatment
                            ? "border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-100"
                            : "border-border bg-muted/50 text-muted-foreground hover:bg-muted"
                    }`}
                >
                    {isTreatment ? <FlaskConical className="h-4 w-4" /> : <Wrench className="h-4 w-4" />}
                </button>
            </div>

            {isTreatment ? (
                <>
                    <div className="flex-1 space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-amber-600">
                            Paso {index + 1}: Tratamiento
                        </Label>
                        <SearchableSelect
                            value={step.treatment_id}
                            onChange={(val) => onTreatmentSelect(index, val)}
                            placeholder="Seleccionar"
                            options={treatments.map((t) => ({
                                value: t.id,
                                label: t.avg_lead_days != null ? `${t.name} (${t.avg_lead_days}d)` : t.name,
                            }))}
                        />
                    </div>
                    <div className="w-20 space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-amber-600">Días</Label>
                        <div className="relative">
                            <Input
                                type="number"
                                min="0.5"
                                step="0.5"
                                value={step.days || ""}
                                onChange={(e) => onUpdateDays(index, parseFloat(e.target.value) || 0)}
                                className="h-9 border-amber-200 pr-6 text-xs focus:border-amber-500"
                            />
                            <FlaskConical className="absolute right-2 top-3 h-3 w-3 text-amber-400" />
                        </div>
                    </div>
                </>
            ) : (
                <>
                    <div className="flex-1 space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground">
                            Paso {index + 1}: Máquina
                        </Label>
                        <SearchableSelect
                            value={step.machine}
                            onChange={(val) => onUpdateMachine(index, "machine", val)}
                            placeholder="Seleccionar"
                            options={machines.map((m) => ({ value: m.name, label: m.name }))}
                        />
                    </div>
                    <div className="shrink-0 space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground">Tiempo</Label>
                        <div className="flex items-center gap-1">
                            <Input
                                type="number"
                                min="0"
                                step="1"
                                placeholder="0"
                                value={Math.floor(step.hours) > 0 ? Math.floor(step.hours) : ""}
                                onChange={(e) => {
                                    const h = parseInt(e.target.value) || 0;
                                    const m = Math.round((step.hours % 1) * 60);
                                    onUpdateMachine(index, "hours", h + m / 60);
                                }}
                                className="h-9 w-14 px-2 text-center text-xs"
                            />
                            <span className="text-[10px] font-bold text-muted-foreground">h</span>
                            <Input
                                type="number"
                                min="0"
                                max="59"
                                step="5"
                                placeholder="0"
                                value={Math.round((step.hours % 1) * 60) > 0 ? Math.round((step.hours % 1) * 60) : ""}
                                onChange={(e) => {
                                    const m = Math.min(59, parseInt(e.target.value) || 0);
                                    const h = Math.floor(step.hours);
                                    onUpdateMachine(index, "hours", h + m / 60);
                                }}
                                className="h-9 w-14 px-2 text-center text-xs"
                            />
                            <span className="text-[10px] font-bold text-muted-foreground">m</span>
                        </div>
                    </div>
                </>
            )}

            <Button
                variant="ghost"
                size="icon"
                onClick={() => onRemove(index)}
                className="h-9 w-9 text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-500"
            >
                <Trash2 className="h-4 w-4" />
            </Button>
        </div>
    );
}
