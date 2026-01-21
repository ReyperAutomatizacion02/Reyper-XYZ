"use client";

import React, { useState, useEffect, useRef } from "react";
import { ChevronDown, Search, X } from "lucide-react";

interface Option {
    label: string;
    value: string;
}

interface SearchableSelectProps {
    options: Option[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    onCreate?: (value: string) => void; // Optional: Allow creating new items
}

export function SearchableSelect({
    options,
    value,
    onChange,
    placeholder = "Select...",
    className = "",
    onCreate
}: SearchableSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const containerRef = useRef<HTMLDivElement>(null);

    // Filter options
    const filteredOptions = options.filter(opt =>
        opt.label.toLowerCase().includes(search.toLowerCase())
    );

    const selectedOption = options.find(opt => opt.value === value);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSelect = (val: string) => {
        onChange(val);
        setIsOpen(false);
        setSearch("");
    };

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            <div
                className="flex items-center justify-between w-full px-3 py-2 text-sm bg-background border border-input rounded-md cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors"
                onClick={() => setIsOpen(!isOpen)}
            >
                <span className={selectedOption ? "text-foreground" : "text-muted-foreground"}>
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <ChevronDown className={`w-4 h-4 opacity-50 transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </div>

            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-popover text-popover-foreground border bg-white border-border rounded-md shadow-md animate-in fade-in-0 zoom-in-95">
                    <div className="flex items-center px-2 py-2 border-b border-border sticky top-0 bg-popover">
                        <Search className="w-4 h-4 mr-2 opacity-50" />
                        <input
                            type="text"
                            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
                            placeholder="Buscar..."
                            autoFocus
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                        {search && (
                            <X
                                className="w-4 h-4 cursor-pointer opacity-50 hover:opacity-100"
                                onClick={() => setSearch("")}
                            />
                        )}
                    </div>
                    <div className="max-h-60 overflow-auto py-1">
                        {filteredOptions.length === 0 ? (
                            <div className="px-2 py-4 text-sm text-center text-muted-foreground">
                                No se encontraron resultados.
                                {onCreate && search && (
                                    <button
                                        className="mt-2 text-primary hover:underline block w-full"
                                        onClick={() => handleSelect(search)}
                                    >
                                        Crear "{search}"
                                    </button>
                                )}
                            </div>
                        ) : (
                            filteredOptions.map((option) => (
                                <div
                                    key={option.value}
                                    className={`px-3 py-2 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground flex justify-between items-center ${option.value === value ? "bg-accent/50 font-medium" : ""
                                        }`}
                                    onClick={() => handleSelect(option.value)}
                                >
                                    {option.label}
                                    {option.value === value && (
                                        <span className="text-primary text-xs">✓</span>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
