import {
    startOfDay,
    addDays,
    addMinutes,
    set,
    getDay,
    getHours,
    getMinutes,
    getSeconds,
    getMilliseconds,
} from "date-fns";

export interface WorkShift {
    id: string;
    name: string;
    /** "HH:MM:SS" or "HH:MM" – Postgres TIME column */
    start_time: string;
    end_time: string;
    /** Day-of-week numbers: 0=Sun, 1=Mon … 6=Sat */
    days_of_week: number[];
    active: boolean;
    sort_order: number;
}

/** Default schedule matches the legacy hardcoded window: Mon-Sat 06:00-22:00 */
export const DEFAULT_SHIFTS: WorkShift[] = [
    {
        id: "default-1",
        name: "Turno 1",
        start_time: "06:00:00",
        end_time: "14:00:00",
        days_of_week: [1, 2, 3, 4, 5, 6],
        active: true,
        sort_order: 1,
    },
    {
        id: "default-2",
        name: "Turno 2",
        start_time: "14:00:00",
        end_time: "22:00:00",
        days_of_week: [1, 2, 3, 4, 5, 6],
        active: true,
        sort_order: 2,
    },
];

/** Helper to set time components on a Date */
function setTime(date: Date, hours: number, minutes: number, seconds: number, ms: number = 0): Date {
    return set(date, { hours, minutes, seconds, milliseconds: ms });
}

/** Parse "HH:MM:SS" or "HH:MM" to minutes from midnight */
function parseTimeToMinutes(timeStr: string): number {
    const parts = timeStr.split(":");
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

/**
 * Returns merged [startMin, endMin] work windows for a given day-of-week.
 * Adjacent/overlapping shifts are merged into continuous blocks.
 */
function getMergedWindowsForDay(dayOfWeek: number, shifts: WorkShift[]): [number, number][] {
    const active = shifts.filter((s) => s.active && s.days_of_week.includes(dayOfWeek));
    if (active.length === 0) return [];

    const windows = active
        .map((s) => [parseTimeToMinutes(s.start_time), parseTimeToMinutes(s.end_time)] as [number, number])
        .sort((a, b) => a[0] - b[0]);

    const merged: [number, number][] = [windows[0]];
    for (let i = 1; i < windows.length; i++) {
        const last = merged[merged.length - 1];
        if (windows[i][0] <= last[1]) {
            last[1] = Math.max(last[1], windows[i][1]);
        } else {
            merged.push(windows[i]);
        }
    }
    return merged;
}

/**
 * Returns the end of the work window that `cursor` falls within.
 * Call getNextValidWorkTime(cursor) first to guarantee cursor is in a valid window.
 */
export function getShiftEnd(cursor: Date, shifts: WorkShift[] = DEFAULT_SHIFTS): Date {
    const dayOfWeek = getDay(cursor);
    const currentMinutes = getHours(cursor) * 60 + getMinutes(cursor);
    const windows = getMergedWindowsForDay(dayOfWeek, shifts);
    const win = windows.find(([s, e]) => currentMinutes >= s && currentMinutes < e);
    if (!win) return cursor;
    return setTime(cursor, Math.floor(win[1] / 60), win[1] % 60, 0);
}

/**
 * Moves a date to the next valid working minute according to active shifts.
 * Defaults to Mon-Sat 06:00-22:00 (two merged default shifts).
 */
export function getNextValidWorkTime(date: Date, shifts: WorkShift[] = DEFAULT_SHIFTS): Date {
    let current = new Date(date);

    // Safety: max 2 weeks of iterations to avoid infinite loops with invalid configs
    for (let attempt = 0; attempt < 14 * 96; attempt++) {
        const dayOfWeek = getDay(current);
        const currentMinutes = getHours(current) * 60 + getMinutes(current);
        const windows = getMergedWindowsForDay(dayOfWeek, shifts);

        if (windows.length > 0) {
            // Already inside a valid window?
            const inWindow = windows.find(([s, e]) => currentMinutes >= s && currentMinutes < e);
            if (inWindow) return current;

            // Next window later today?
            const nextWindow = windows.find(([s]) => s > currentMinutes);
            if (nextWindow) {
                return setTime(current, Math.floor(nextWindow[0] / 60), nextWindow[0] % 60, 0);
            }
        }

        // No work today (or past all windows) → advance to midnight of next day
        current = startOfDay(addDays(current, 1));
    }
    return current;
}

/**
 * Snaps a date to the next 15-minute interval (ceiling).
 * Used by the scheduling engine so tasks never start in the past.
 * e.g. 14:04 -> 14:15. 14:15:00 -> 14:15.
 */
export function snapToNext15Minutes(date: Date): Date {
    const current = new Date(date);
    const minutes = getMinutes(current);
    const seconds = getSeconds(current);
    const ms = getMilliseconds(current);

    // If already at a 15-min mark exactly, return it
    if (minutes % 15 === 0 && seconds === 0 && ms === 0) {
        return current;
    }

    const remainder = 15 - (minutes % 15);
    return set(addMinutes(current, remainder), { seconds: 0, milliseconds: 0 });
}

/**
 * Snaps a date to the nearest 15-minute interval (round).
 * Used for drag-and-drop UX so movements feel natural.
 * e.g. 14:04 -> 14:00. 14:08 -> 14:15. 14:52 -> 15:00.
 */
export function snapToNearest15Minutes(date: Date): Date {
    const roundedMinutes = Math.round(getMinutes(date) / 15) * 15;
    return set(new Date(date), { minutes: roundedMinutes, seconds: 0, milliseconds: 0 });
}

const TREATMENT_HOUR_START = 8;
const TREATMENT_HOUR_END = 18;

/**
 * Snap a date to the next valid treatment slot (Mon–Fri, 08:00–18:00).
 * - Weekday, time in [08:00, 18:00) → keep as-is (treatment starts immediately)
 * - Weekday, time < 08:00           → same day at 08:00
 * - Weekday, time >= 18:00          → next weekday at 08:00
 * - Saturday or Sunday              → next Monday at 08:00
 *   (weekend days are never treatment days, so hour context is discarded)
 */
export function snapTreatmentToWeekday(date: Date): Date {
    let result = new Date(date);
    const h = result.getHours() + result.getMinutes() / 60;

    // If outside treatment hours on a weekday → advance to next day at 08:00
    // (the machining end hour is not preserved when a day transition is required)
    if (getDay(result) !== 0 && getDay(result) !== 6 && h >= TREATMENT_HOUR_END) {
        result = addDays(result, 1);
        result = set(result, { hours: TREATMENT_HOUR_START, minutes: 0, seconds: 0, milliseconds: 0 });
    }

    // Skip weekend days → always land at 08:00 (weekend has no treatment context)
    if (getDay(result) === 0 || getDay(result) === 6) {
        while (getDay(result) === 0 || getDay(result) === 6) {
            result = addDays(result, 1);
        }
        return set(result, { hours: TREATMENT_HOUR_START, minutes: 0, seconds: 0, milliseconds: 0 });
    }

    // Weekday within range: clamp to 08:00 if before treatment start
    if (result.getHours() + result.getMinutes() / 60 < TREATMENT_HOUR_START) {
        result = set(result, { hours: TREATMENT_HOUR_START, minutes: 0, seconds: 0, milliseconds: 0 });
    }

    return result;
}

/**
 * Add N working days (Mon–Fri) to a date, skipping Saturday and Sunday.
 * Days=0 returns the same date unchanged.
 */
export function addWorkingDays(date: Date, days: number): Date {
    let result = new Date(date);
    let remaining = Math.ceil(days);
    while (remaining > 0) {
        result = addDays(result, 1);
        const d = getDay(result);
        if (d !== 0 && d !== 6) remaining--;
    }
    return result;
}

/**
 * Compute treatment end: the same H:M as start, N working days later.
 * Each day is a full forward jump: days=2 starting Wed 9:45 → Fri 9:45
 * (Wed→Thu = day 1, Thu→Fri = day 2).
 */
export function treatmentEndDate(start: Date, days: number): Date {
    const lastDay = addWorkingDays(start, days);
    return set(lastDay, { hours: start.getHours(), minutes: start.getMinutes(), seconds: 0, milliseconds: 0 });
}
