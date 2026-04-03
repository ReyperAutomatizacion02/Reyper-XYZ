"use client";

import { useState, useEffect, useMemo, useCallback, RefObject } from "react";
import {
    startOfDay,
    endOfDay,
    startOfISOWeek,
    endOfISOWeek,
    startOfMonth,
    endOfMonth,
    addDays,
    addHours,
    addWeeks,
    addMonths,
    addMilliseconds,
    subDays,
    isBefore,
    isAfter,
    getHours,
    getDay,
    getDate,
    getISOWeek,
    set,
    format,
} from "date-fns";
import { es } from "date-fns/locale";

const VIEW_MODE_CONFIG = {
    hour: { width: 100 },
    day: { width: 150 },
    week: { width: 200 },
};

interface UseGanttCoordinatesProps {
    viewMode: "hour" | "day" | "week";
    zoomLevel: number;
    scrollContainerRef: RefObject<HTMLDivElement | null>;
}

export function useGanttCoordinates({ viewMode, zoomLevel, scrollContainerRef }: UseGanttCoordinatesProps) {
    const UNIT_WIDTH = VIEW_MODE_CONFIG[viewMode].width * zoomLevel;

    const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));
    const [dateRangeStart, setDateRangeStart] = useState(() => subDays(startOfDay(new Date()), 7));
    const [dateRangeEnd, setDateRangeEnd] = useState(() => addDays(startOfDay(new Date()), 14));

    const timeWindow = useMemo(() => {
        if (viewMode === "hour") {
            return {
                start: startOfDay(selectedDate),
                end: addHours(endOfDay(selectedDate), 1),
            };
        } else if (viewMode === "day") {
            return {
                start: startOfDay(dateRangeStart),
                end: endOfDay(dateRangeEnd),
            };
        } else {
            return {
                start: startOfISOWeek(dateRangeStart),
                end: endOfISOWeek(dateRangeEnd),
            };
        }
    }, [viewMode, selectedDate, dateRangeStart, dateRangeEnd]);

    // Reset date ranges when switching view modes
    useEffect(() => {
        if (viewMode === "day") {
            setDateRangeStart(startOfISOWeek(new Date()));
            setDateRangeEnd(endOfISOWeek(new Date()));
        } else if (viewMode === "week") {
            setDateRangeStart(startOfMonth(new Date()));
            setDateRangeEnd(endOfMonth(new Date()));
        }
    }, [viewMode]);

    const timeToX = useCallback(
        (time: string | number | Date): number => {
            if (!time) return 0;
            const mTime = new Date(time as any);
            const startMs = timeWindow.start.getTime();
            const currentMs = mTime.getTime();
            if (viewMode === "hour") return ((currentMs - startMs) / (1000 * 60 * 60)) * UNIT_WIDTH;
            if (viewMode === "day") return ((currentMs - startMs) / (1000 * 60 * 60 * 24)) * UNIT_WIDTH;
            return ((currentMs - startMs) / (1000 * 60 * 60 * 24 * 7)) * UNIT_WIDTH;
        },
        [timeWindow, viewMode, UNIT_WIDTH]
    );

    const xToTime = useCallback(
        (x: number): Date => {
            const msPerUnit =
                viewMode === "hour"
                    ? 1000 * 60 * 60
                    : viewMode === "day"
                      ? 1000 * 60 * 60 * 24
                      : 1000 * 60 * 60 * 24 * 7;
            return addMilliseconds(timeWindow.start, (x / UNIT_WIDTH) * msPerUnit);
        },
        [timeWindow, viewMode, UNIT_WIDTH]
    );

    const totalWidth = useMemo(() => {
        const diffMs = timeWindow.end.getTime() - timeWindow.start.getTime();
        if (viewMode === "hour") return (diffMs / (1000 * 60 * 60)) * UNIT_WIDTH;
        if (viewMode === "day") return (diffMs / (1000 * 60 * 60 * 24)) * UNIT_WIDTH;
        return (diffMs / (1000 * 60 * 60 * 24 * 7)) * UNIT_WIDTH;
    }, [timeWindow, viewMode, UNIT_WIDTH]);

    const timeColumns = useMemo(() => {
        const columns = [];
        let curr = new Date(timeWindow.start);
        while (isBefore(curr, timeWindow.end)) {
            const h = getHours(curr);
            const isOffHour = viewMode === "hour" && (h < 6 || h >= 22);
            const isSpecial =
                viewMode === "hour"
                    ? getHours(curr) === 0
                    : viewMode === "day"
                      ? getDay(curr) === 1
                      : getDate(curr) === 1;
            columns.push({
                time: new Date(curr),
                x: timeToX(curr),
                label:
                    viewMode === "hour"
                        ? format(curr, "HH:mm")
                        : viewMode === "day"
                          ? format(curr, "dd MMM", { locale: es })
                          : `Sem ${getISOWeek(curr)}`,
                dateLabel: format(curr, "dd MMM", { locale: es }),
                isSpecial,
                isOffHour,
            });
            if (viewMode === "hour") curr = addHours(curr, 1);
            else if (viewMode === "day") curr = addDays(curr, 1);
            else curr = addWeeks(curr, 1);
        }
        return columns;
    }, [timeWindow.start, timeWindow.end, viewMode, UNIT_WIDTH, timeToX]);

    const offHourRects = useMemo(() => {
        if (viewMode !== "hour") return [] as { x: number; width: number }[];
        const rects: { x: number; width: number }[] = [];
        let day = startOfDay(timeWindow.start);
        while (isBefore(day, timeWindow.end)) {
            const nightStart = day;
            const nightEnd = set(day, { hours: 6, minutes: 0, seconds: 0, milliseconds: 0 });
            if (isBefore(nightStart, timeWindow.end) && isAfter(nightEnd, timeWindow.start)) {
                const x1 = timeToX(nightStart);
                const x2 = timeToX(nightEnd);
                if (x2 > x1) rects.push({ x: x1, width: x2 - x1 });
            }
            const eveningStart = set(day, { hours: 22, minutes: 0, seconds: 0, milliseconds: 0 });
            const eveningEnd = addDays(day, 1);
            if (isBefore(eveningStart, timeWindow.end) && isAfter(eveningEnd, timeWindow.start)) {
                const x1 = timeToX(eveningStart);
                const x2 = timeToX(eveningEnd);
                if (x2 > x1) rects.push({ x: x1, width: x2 - x1 });
            }
            day = addDays(day, 1);
        }
        return rects;
    }, [viewMode, timeWindow, timeToX]);

    const scrollToNow = useCallback(() => {
        if (!scrollContainerRef.current) return;
        const nowX = timeToX(new Date());
        const containerWidth = scrollContainerRef.current.clientWidth;
        scrollContainerRef.current.scrollTo({
            left: Math.max(0, nowX - containerWidth / 3),
            behavior: "smooth",
        });
    }, [timeToX, scrollContainerRef]);

    const navigateDate = useCallback(
        (direction: "prev" | "next" | "today") => {
            if (viewMode === "hour") {
                if (direction === "today") {
                    setSelectedDate(startOfDay(new Date()));
                    setTimeout(() => scrollToNow(), 100);
                } else {
                    setSelectedDate((prev) => addDays(prev, direction === "prev" ? -1 : 1));
                }
            } else {
                if (direction === "today") {
                    if (viewMode === "day") {
                        setDateRangeStart(startOfISOWeek(new Date()));
                        setDateRangeEnd(endOfISOWeek(new Date()));
                    } else {
                        setDateRangeStart(startOfMonth(new Date()));
                        setDateRangeEnd(endOfMonth(new Date()));
                    }
                    setTimeout(() => scrollToNow(), 100);
                } else {
                    const shiftDir = direction === "prev" ? -1 : 1;
                    if (viewMode === "day") {
                        setDateRangeStart((prev) => startOfISOWeek(addWeeks(prev, shiftDir)));
                        setDateRangeEnd((prev) => endOfISOWeek(addWeeks(prev, shiftDir)));
                    } else {
                        setDateRangeStart((prev) => startOfMonth(addMonths(prev, shiftDir)));
                        setDateRangeEnd((prev) => endOfMonth(addMonths(prev, shiftDir)));
                    }
                }
            }
        },
        [viewMode, scrollToNow]
    );

    return {
        // State
        selectedDate,
        setSelectedDate,
        dateRangeStart,
        setDateRangeStart,
        dateRangeEnd,
        setDateRangeEnd,
        // Derived
        timeWindow,
        UNIT_WIDTH,
        totalWidth,
        timeColumns,
        offHourRects,
        // Functions
        timeToX,
        xToTime,
        scrollToNow,
        navigateDate,
    };
}
