"use client";

import React, { useState, useEffect, useRef } from "react";
import { ChevronDown, Search, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface Option {
    label: string;
    value: string;
}

interface CustomDropdownProps {
    options: Option[];
    value: string | string[];
    onChange: (value: any) => void;
    placeholder?: string;
    className?: string;
    searchable?: boolean;
    disabled?: boolean;
    multiple?: boolean;
}

export function CustomDropdown({
    options,
    value,
    onChange,
    placeholder = "Seleccionar...",
    className = "",
    searchable = false,
    disabled = false,
    multiple = false,
}: CustomDropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const filteredOptions = options.filter((opt) => opt.label.toLowerCase().includes(search.toLowerCase()));

    const isSelected = (val: string) => {
        if (multiple && Array.isArray(value)) {
            return value.includes(val);
        }
        return value === val;
    };

    const selectedOptions = options.filter((opt) => isSelected(opt.value));

    const label = multiple
        ? selectedOptions.length === 0
            ? placeholder
            : selectedOptions.length === 1
              ? selectedOptions[0].label
              : "seleccionados"
        : selectedOptions[0]?.label || placeholder;

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        if (isOpen && searchable && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen, searchable]);

    const handleSelect = (val: string) => {
        if (multiple) {
            const currentValues = Array.isArray(value) ? value : [];
            const newValue = currentValues.includes(val)
                ? currentValues.filter((v) => v !== val)
                : [...currentValues, val];
            onChange(newValue);
        } else {
            onChange(val);
            setIsOpen(false);
            setSearch("");
        }
    };

    return (
        <div className={cn("relative", className)} ref={containerRef}>
            <button
                type="button"
                disabled={disabled}
                onClick={() => !disabled && setIsOpen(!isOpen)}
                className={cn(
                    "flex w-full items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-xs shadow-sm transition-all duration-200 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20",
                    disabled
                        ? "cursor-not-allowed bg-muted opacity-50"
                        : "cursor-pointer hover:border-border/80 hover:bg-muted/50"
                )}
            >
                <div className="flex items-center gap-1 overflow-hidden">
                    {multiple && selectedOptions.length > 1 && (
                        <div className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                            {selectedOptions.length}
                        </div>
                    )}
                    <span
                        className={cn(
                            "truncate",
                            selectedOptions.length > 0 ? "font-medium text-foreground" : "text-muted-foreground"
                        )}
                    >
                        {label}
                    </span>
                </div>
                <ChevronDown
                    className={cn(
                        "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200",
                        isOpen ? "rotate-180" : ""
                    )}
                />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 5, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 5, scale: 0.95 }}
                        transition={{ duration: 0.15, ease: "easeOut" }}
                        className="absolute left-0 z-[11000] mt-1.5 w-max min-w-full max-w-[350px] overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-xl backdrop-blur-md"
                    >
                        {searchable && (
                            <div className="flex items-center border-b border-border bg-muted/20 px-2 py-2">
                                <Search className="ml-1 mr-2 h-3.5 w-3.5 text-muted-foreground" />
                                <input
                                    ref={inputRef}
                                    type="text"
                                    className="h-6 flex-1 border-none bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
                                    placeholder="Buscar..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    onKeyDown={(e) => e.stopPropagation()}
                                />
                                {search && (
                                    <X
                                        className="h-3.5 w-3.5 cursor-pointer opacity-50 hover:opacity-100"
                                        onClick={() => setSearch("")}
                                    />
                                )}
                            </div>
                        )}
                        <div className="custom-scrollbar max-h-60 overflow-y-auto py-1.5">
                            {filteredOptions.length === 0 ? (
                                <div className="px-3 py-4 text-center text-xs italic text-muted-foreground">
                                    No se encontraron resultados.
                                </div>
                            ) : (
                                filteredOptions.map((option) => {
                                    const active = isSelected(option.value);
                                    return (
                                        <div
                                            key={option.value}
                                            className={cn(
                                                "mx-1 flex cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-2 text-xs transition-colors",
                                                active
                                                    ? "bg-primary/10 font-semibold text-primary"
                                                    : "text-foreground hover:bg-muted"
                                            )}
                                            onClick={() => handleSelect(option.value)}
                                        >
                                            <div className="flex items-center gap-2 overflow-hidden">
                                                {multiple && (
                                                    <div
                                                        className={cn(
                                                            "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border transition-colors",
                                                            active
                                                                ? "border-primary bg-primary"
                                                                : "border-border bg-background"
                                                        )}
                                                    >
                                                        {active && <Check className="h-2.5 w-2.5 text-white" />}
                                                    </div>
                                                )}
                                                <span className="whitespace-nowrap">{option.label}</span>
                                            </div>
                                            {!multiple && active && <Check className="h-3.5 w-3.5 shrink-0" />}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
