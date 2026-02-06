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
    multiple = false
}: CustomDropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const filteredOptions = options.filter(opt =>
        opt.label.toLowerCase().includes(search.toLowerCase())
    );

    const isSelected = (val: string) => {
        if (multiple && Array.isArray(value)) {
            return value.includes(val);
        }
        return value === val;
    };

    const selectedOptions = options.filter(opt => isSelected(opt.value));

    // For single select, it was find, now we can have many
    const label = multiple
        ? (selectedOptions.length > 0 ? `${selectedOptions.length} seleccionados` : placeholder)
        : (selectedOptions[0]?.label || placeholder);

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
                ? currentValues.filter(v => v !== val)
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
                    "flex items-center justify-between w-full px-3 py-2 text-xs bg-background border border-border rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 shadow-sm",
                    disabled ? "opacity-50 cursor-not-allowed bg-muted" : "cursor-pointer hover:bg-muted/50 hover:border-border/80"
                )}
            >
                <div className="flex items-center gap-1 overflow-hidden">
                    {multiple && selectedOptions.length > 0 && (
                        <div className="bg-primary/10 text-primary px-1.5 py-0.5 rounded text-[10px] font-bold">
                            {selectedOptions.length}
                        </div>
                    )}
                    <span className={cn(
                        "truncate",
                        selectedOptions.length > 0 ? "text-foreground font-medium" : "text-muted-foreground"
                    )}>
                        {label}
                    </span>
                </div>
                <ChevronDown className={cn(
                    "w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 shrink-0",
                    isOpen ? "rotate-180" : ""
                )} />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 5, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 5, scale: 0.95 }}
                        transition={{ duration: 0.15, ease: "easeOut" }}
                        className="absolute z-[11000] min-w-full w-max max-w-[350px] mt-1.5 bg-popover text-popover-foreground border border-border rounded-xl shadow-xl overflow-hidden backdrop-blur-md left-0"
                    >
                        {searchable && (
                            <div className="flex items-center px-2 py-2 border-b border-border bg-muted/20">
                                <Search className="w-3.5 h-3.5 ml-1 mr-2 text-muted-foreground" />
                                <input
                                    ref={inputRef}
                                    type="text"
                                    className="flex-1 bg-transparent border-none outline-none text-xs placeholder:text-muted-foreground text-foreground h-6"
                                    placeholder="Buscar..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    onKeyDown={(e) => e.stopPropagation()}
                                />
                                {search && (
                                    <X
                                        className="w-3.5 h-3.5 cursor-pointer opacity-50 hover:opacity-100"
                                        onClick={() => setSearch("")}
                                    />
                                )}
                            </div>
                        )}
                        <div className="max-h-60 overflow-y-auto py-1.5 custom-scrollbar">
                            {filteredOptions.length === 0 ? (
                                <div className="px-3 py-4 text-xs text-center text-muted-foreground italic">
                                    No se encontraron resultados.
                                </div>
                            ) : (
                                filteredOptions.map((option) => {
                                    const active = isSelected(option.value);
                                    return (
                                        <div
                                            key={option.value}
                                            className={cn(
                                                "px-3 py-2 text-xs cursor-pointer flex justify-between items-center transition-colors mx-1 rounded-md gap-3",
                                                active
                                                    ? "bg-primary/10 text-primary font-semibold"
                                                    : "hover:bg-muted text-foreground"
                                            )}
                                            onClick={() => handleSelect(option.value)}
                                        >
                                            <div className="flex items-center gap-2 overflow-hidden">
                                                {multiple && (
                                                    <div className={cn(
                                                        "w-3.5 h-3.5 border rounded flex items-center justify-center transition-colors shrink-0",
                                                        active ? "bg-primary border-primary" : "border-border bg-background"
                                                    )}>
                                                        {active && <Check className="w-2.5 h-2.5 text-white" />}
                                                    </div>
                                                )}
                                                <span className="whitespace-nowrap">{option.label}</span>
                                            </div>
                                            {!multiple && active && (
                                                <Check className="w-3.5 h-3.5 shrink-0" />
                                            )}
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
