import { type EvaluationStep, type MachineStep, isTreatmentStep } from "@/lib/scheduling-utils";

export function emptyMachineStep(): EvaluationStep {
    return { type: "machine", machine: "", hours: 0, setup_time: 0, machining_time: 0, piece_change_time: 0 };
}

export function isStepComplete(step: EvaluationStep): boolean {
    if (isTreatmentStep(step)) return !!step.treatment_id && step.days > 0;
    if (step.machining_time !== undefined) return !!step.machine && step.machining_time > 0;
    return !!step.machine && step.hours > 0;
}

export function isStepIncomplete(step: EvaluationStep): boolean {
    if (isTreatmentStep(step)) return !!step.treatment_id && !(step.days > 0);
    if (step.machining_time !== undefined) return !!step.machine && !(step.machining_time > 0);
    return !!step.machine && !(step.hours > 0);
}

export function computeHours(step: MachineStep, qty: number): number {
    const setup = step.setup_time ?? 0;
    const machining = step.machining_time ?? 0;
    const pieceChange = step.piece_change_time ?? 0;
    if (setup === 0 && machining === 0 && pieceChange === 0 && step.hours > 0) return step.hours;
    return setup + machining * qty + pieceChange * Math.max(0, qty - 1);
}

export function formatHours(hours: number): string {
    if (hours <= 0) return "—";
    const h = Math.floor(hours);
    const m = Math.round((hours % 1) * 60);
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
}
