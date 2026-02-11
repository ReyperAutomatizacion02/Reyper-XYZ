import moment from "moment";

// Mocking the behavior of getNextValidWorkTime
function getNextValidWorkTime(date: moment.Moment): moment.Moment {
    let current = moment(date);
    while (true) {
        const hour = current.hour();
        const day = current.day();
        if (day === 0) {
            current.add(1, 'day').startOf('day').hour(6);
            continue;
        }
        if (hour < 6) {
            current.hour(6).minute(0).second(0).millisecond(0);
            continue;
        }
        if (hour >= 22) {
            current.add(1, 'day').startOf('day').hour(6);
            continue;
        }
        break;
    }
    return current;
}

function shiftTasksToCurrent(
    tasks: any[],
    targetTime: moment.Moment,
    existingTasks: any[]
): any[] {
    if (tasks.length === 0) return tasks;
    const starts = tasks.map(t => moment(t.planned_date));
    const earliestOriginal = moment.min(starts);
    const newGlobalStart = getNextValidWorkTime(targetTime);
    const offsetMs = newGlobalStart.valueOf() - earliestOriginal.valueOf();

    const existingTasksMap = existingTasks.map(t => ({
        machine: t.machine,
        startMs: moment(t.planned_date).valueOf(),
        endMs: moment(t.planned_end).valueOf()
    }));

    return tasks.map(task => {
        let newStart = getNextValidWorkTime(moment(task.planned_date).add(offsetMs, 'ms'));
        const duration = moment(task.planned_end).diff(moment(task.planned_date), 'minutes');
        let rem = duration;
        let cur = moment(newStart);
        while (rem > 0) {
            cur = getNextValidWorkTime(cur);
            const se = moment(cur).hour(22).minute(0).second(0);
            const av = se.diff(cur, 'minutes');
            if (av <= 0) { cur.add(1, 'day').startOf('day').hour(6); continue; }
            const seg = Math.min(rem, av);
            rem -= seg;
            cur = rem > 0 ? moment(se) : moment(cur).add(seg, 'minutes');
        }
        let newEnd = cur;
        const collision = existingTasksMap.find(t =>
            t.machine === task.machine &&
            t.startMs < newEnd.valueOf() &&
            t.endMs > newStart.valueOf()
        );
        if (collision) {
            newStart = getNextValidWorkTime(moment(collision.endMs));
            let r = duration;
            let c = moment(newStart);
            while (r > 0) {
                c = getNextValidWorkTime(c);
                const se = moment(c).hour(22).minute(0).second(0);
                const av = se.diff(c, 'minutes');
                if (av <= 0) { c.add(1, 'day').startOf('day').hour(6); continue; }
                const seg = Math.min(r, av);
                r -= seg;
                c = r > 0 ? moment(se) : moment(c).add(seg, 'minutes');
            }
            return {
                ...task,
                planned_date: newStart.format('YYYY-MM-DDTHH:mm:ss'),
                planned_end: c.format('YYYY-MM-DDTHH:mm:ss'),
            };
        }
        return {
            ...task,
            planned_date: newStart.format('YYYY-MM-DDTHH:mm:ss'),
            planned_end: newEnd.format('YYYY-MM-DDTHH:mm:ss'),
        };
    });
}

// Test cases
const now = moment("2026-02-11T09:00:00");
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
