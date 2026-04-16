"use client";

import React, { useState, useEffect, useRef } from "react";
import { ChevronDown } from "lucide-react";

interface TimePickerProps {
    value: string; // "HH:MM"
    onChange: (val: string) => void;
    className?: string;
    minuteInterval?: 15 | 30;
}

export function TimePicker({ value, onChange, className, minuteInterval = 15 }: TimePickerProps) {
    const [hour, minute] = value ? value.split(":") : ["00", "00"];
    const [openStack, setOpenStack] = useState<"none" | "hour" | "minute">("none");
    const hourListRef = useRef<HTMLDivElement>(null);
    const minuteListRef = useRef<HTMLDivElement>(null);

    const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, "0"));
    const minutes = Array.from({ length: 60 / minuteInterval }, (_, i) =>
        (i * minuteInterval).toString().padStart(2, "0")
    );

    useEffect(() => {
        if (openStack === "hour" && hourListRef.current) {
            const selected = hourListRef.current.querySelector(`#hour-${hour}`) as HTMLElement;
            selected?.scrollIntoView({ block: "center", behavior: "instant" });
        } else if (openStack === "minute" && minuteListRef.current) {
            const selected = minuteListRef.current.querySelector(`#minute-${minute}`) as HTMLElement;
            selected?.scrollIntoView({ block: "center", behavior: "instant" });
        }
    }, [openStack, hour, minute]);

    return (
        <div className={`flex items-center gap-1 ${className} relative`}>
            {openStack !== "none" && <div className="fixed inset-0 z-dropdown" onClick={() => setOpenStack("none")} />}

            {/* Hour Dropdown */}
            <div className="relative w-20">
                <button
                    type="button"
                    onClick={() => setOpenStack(openStack === "hour" ? "none" : "hour")}
                    className={`flex w-full flex-col items-center justify-center gap-0.5 rounded-lg border bg-muted/40 py-2 text-foreground outline-none transition-all hover:bg-muted/60 focus:ring-2 focus:ring-primary/20 ${openStack === "hour" ? "border-primary bg-background ring-2 ring-primary/20" : "border-transparent"}`}
                >
                    <div className="flex items-center gap-1.5">
                        <span className="text-xl font-bold leading-none">{hour}</span>
                        <ChevronDown
                            className={`h-3 w-3 text-muted-foreground transition-transform ${openStack === "hour" ? "rotate-180" : ""}`}
                        />
                    </div>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Hora</span>
                </button>

                {openStack === "hour" && (
                    <div
                        ref={hourListRef}
                        className="no-scrollbar absolute left-0 top-full z-picker mt-1 flex max-h-48 w-20 flex-col gap-0.5 overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-xl"
                    >
                        {hours.map((h) => (
                            <button
                                key={h}
                                id={`hour-${h}`}
                                type="button"
                                onClick={() => {
                                    onChange(`${h}:${minute}`);
                                    setOpenStack("none");
                                }}
                                className={`rounded-md py-1.5 text-sm font-bold transition-colors ${h === hour ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"}`}
                            >
                                {h}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <span className="pb-3 text-xl font-black text-muted-foreground/30">:</span>

            {/* Minute Dropdown */}
            <div className="relative w-20">
                <button
                    type="button"
                    onClick={() => setOpenStack(openStack === "minute" ? "none" : "minute")}
                    className={`flex w-full flex-col items-center justify-center gap-0.5 rounded-lg border bg-muted/40 py-2 text-foreground outline-none transition-all hover:bg-muted/60 focus:ring-2 focus:ring-primary/20 ${openStack === "minute" ? "border-primary bg-background ring-2 ring-primary/20" : "border-transparent"}`}
                >
                    <div className="flex items-center gap-1.5">
                        <span className="text-xl font-bold leading-none">{minute}</span>
                        <ChevronDown
                            className={`h-3 w-3 text-muted-foreground transition-transform ${openStack === "minute" ? "rotate-180" : ""}`}
                        />
                    </div>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Min</span>
                </button>

                {openStack === "minute" && (
                    <div
                        ref={minuteListRef}
                        className="no-scrollbar absolute right-0 top-full z-picker mt-1 flex max-h-48 w-20 flex-col gap-0.5 overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-xl"
                    >
                        {minutes.map((m) => (
                            <button
                                key={m}
                                id={`minute-${m}`}
                                type="button"
                                onClick={() => {
                                    onChange(`${hour}:${m}`);
                                    setOpenStack("none");
                                }}
                                className={`rounded-md py-1.5 text-sm font-bold transition-colors ${m === minute ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"}`}
                            >
                                {m}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
