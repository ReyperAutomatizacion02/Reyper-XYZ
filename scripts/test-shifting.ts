import { format, addMilliseconds, addMinutes, addDays, startOfDay, differenceInMinutes, setHours, setMinutes, setSeconds, setMilliseconds, getHours, getDay, min as minDate } from "date-fns";

// Mocking the behavior of getNextValidWorkTime
function getNextValidWorkTime(date: Date): Date {
    let current = new Date(date);
    while (true) {
        const hour = getHours(current);
        const day = getDay(current);
        if (day === 0) {
            current = setHours(startOfDay(addDays(current, 1)), 6);
            continue;
        }
        if (hour < 6) {
            current = setMilliseconds(setSeconds(setMinutes(setHours(current, 6), 0), 0), 0);
            continue;
        }
        if (hour >= 22) {
            current = setHours(startOfDay(addDays(current, 1)), 6);
            continue;
        }
        break;
    }
    return current;
}

function shiftTasksToCurrent(
    tasks: any[],
    targetTime: Date,
    existingTasks: any[]
): any[] {
    if (tasks.length === 0) return tasks;
    const starts = tasks.map(t => new Date(t.planned_date));
    const earliestOriginal = minDate(starts);
    const newGlobalStart = getNextValidWorkTime(targetTime);
    const offsetMs = newGlobalStart.getTime() - earliestOriginal.getTime();

    const existingTasksMap = existingTasks.map(t => ({
        machine: t.machine,
        startMs: new Date(t.planned_date).getTime(),
        endMs: new Date(t.planned_end).getTime()
    }));

    return tasks.map(task => {
        let newStart = getNextValidWorkTime(addMilliseconds(new Date(task.planned_date), offsetMs));
        const duration = differenceInMinutes(new Date(task.planned_end), new Date(task.planned_date));
        let rem = duration;
        let cur = new Date(newStart);
        while (rem > 0) {
            cur = getNextValidWorkTime(cur);
            const se = setSeconds(setMinutes(setHours(new Date(cur), 22), 0), 0);
            const av = differenceInMinutes(se, cur);
            if (av <= 0) { cur = setHours(startOfDay(addDays(cur, 1)), 6); continue; }
            const seg = Math.min(rem, av);
            rem -= seg;
            cur = rem > 0 ? new Date(se) : addMinutes(cur, seg);
        }
        let newEnd = cur;
        const collision = existingTasksMap.find(t =>
            t.machine === task.machine &&
            t.startMs < newEnd.getTime() &&
            t.endMs > newStart.getTime()
        );
        if (collision) {
            newStart = getNextValidWorkTime(new Date(collision.endMs));
            let r = duration;
            let c = new Date(newStart);
            while (r > 0) {
                c = getNextValidWorkTime(c);
                const se = setSeconds(setMinutes(setHours(new Date(c), 22), 0), 0);
                const av = differenceInMinutes(se, c);
                if (av <= 0) { c = setHours(startOfDay(addDays(c, 1)), 6); continue; }
                const seg = Math.min(r, av);
                r -= seg;
                c = r > 0 ? new Date(se) : addMinutes(c, seg);
            }
            return {
                ...task,
                planned_date: format(newStart, "yyyy-MM-dd'T'HH:mm:ss"),
                planned_end: format(c, "yyyy-MM-dd'T'HH:mm:ss"),
            };
        }
        return {
            ...task,
            planned_date: format(newStart, "yyyy-MM-dd'T'HH:mm:ss"),
            planned_end: format(newEnd, "yyyy-MM-dd'T'HH:mm:ss"),
        };
    });
}

// Test cases
const now = new Date("2026-02-11T09:00:00");
const tasks = [
    { machine: "CNC-1", planned_date: "2026-02-01T10:00:00", planned_end: "2026-02-01T12:00:00" },
    { machine: "CNC-1", planned_date: "2026-02-01T14:00:00", planned_end: "2026-02-01T16:00:00" }
];
const existing = [
    { machine: "CNC-1", planned_date: "2026-02-11T10:00:00", planned_end: "2026-02-11T11:00:00" }
];

console.log("Original Tasks:");
tasks.forEach((t, i) => console.log(`  T${i}: ${t.planned_date} -> ${t.planned_end}`));

const shifted = shiftTasksToCurrent(tasks, now, existing);

console.log("\nShifted Tasks (Now=2026-02-11 09:00, Collision at 10:00-11:00):");
shifted.forEach((t, i) => console.log(`  T${i}: ${t.planned_date} -> ${t.planned_end}`));
