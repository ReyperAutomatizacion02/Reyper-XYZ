"use client";

import React, { useState, useEffect, useRef } from "react";
import { ChevronDown, Search, X, Check } from "lucide-react";

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
    onCreate?: (value: string) => void;
    disabled?: boolean;
}

export function SearchableSelect({
    options,
    value,
    onChange,
    placeholder = "Select...",
    className = "",
    onCreate,
    disabled = false
}: SearchableSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [activeIndex, setActiveIndex] = useState(-1);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

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

    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
            setActiveIndex(-1);
        }
    }, [isOpen]);

    const handleSelect = (val: string) => {
        onChange(val);
        setIsOpen(false);
        setSearch("");
        triggerRef.current?.focus();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (disabled) return;
        if (!isOpen) {
            if (e.key === "Enter" || e.key === "ArrowDown" || e.key === " ") {
                e.preventDefault();
                setIsOpen(true);
            }
            return;
        }

        switch (e.key) {
            case "ArrowDown":
                e.preventDefault();
                setActiveIndex(prev => (prev < filteredOptions.length - 1 ? prev + 1 : prev));
                adjustScroll(activeIndex + 1);
                break;
            case "ArrowUp":
                e.preventDefault();
                setActiveIndex(prev => (prev > 0 ? prev - 1 : prev));
                adjustScroll(activeIndex - 1);
                break;
            case "Enter":
                e.preventDefault();
                if (activeIndex >= 0 && activeIndex < filteredOptions.length) {
                    handleSelect(filteredOptions[activeIndex].value);
                } else if (onCreate && search && filteredOptions.length === 0) {
                    handleCreate();
                }
                break;
            case "Escape":
                e.preventDefault();
                setIsOpen(false);
                triggerRef.current?.focus();
                break;
            case "Tab":
                setIsOpen(false);
                break;
            default:
                break;
        }
    };

    const handleCreate = () => {
        if (onCreate && search) {
            onCreate(search);
            setIsOpen(false);
            setSearch("");
            triggerRef.current?.focus();
        }
    };

    const adjustScroll = (index: number) => {
        if (!listRef.current) return;
        const item = listRef.current.children[index] as HTMLElement;
        if (item) {
            item.scrollIntoView({ block: "nearest" });
        }
    };

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            <button
                ref={triggerRef}
                type="button"
                disabled={disabled}
                className={`flex items-center justify-between w-full px-3 py-2 text-sm bg-background border border-input rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-0 focus:border-primary
                    ${disabled ? "opacity-50 cursor-not-allowed bg-muted" : "cursor-pointer hover:bg-accent hover:text-accent-foreground"}
                `}
                onClick={() => !disabled && setIsOpen(!isOpen)}
                onKeyDown={handleKeyDown}
            >
                <span className={selectedOption ? "text-foreground" : "text-muted-foreground"}>
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <ChevronDown className={`w-4 h-4 opacity-50 transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </button>

            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-popover text-popover-foreground border border-input rounded-md shadow-md animate-in fade-in-0 zoom-in-95 overflow-hidden">
                    <div className="flex items-center px-2 py-2 border-b border-input sticky top-0 bg-popover">
                        <Search className="w-4 h-4 mr-2 opacity-50" />
                        <input
                            ref={inputRef}
                            type="text"
                            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground text-foreground"
                            placeholder="Buscar..."
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value);
                                setActiveIndex(0); // Reset selection on search
                            }}
                            onKeyDown={handleKeyDown}
                        />
                        {search && (
                            <X
                                className="w-4 h-4 cursor-pointer opacity-50 hover:opacity-100"
                                onClick={() => setSearch("")}
                            />
                        )}
                    </div>
                    <div ref={listRef} className="max-h-60 overflow-auto py-1">
                        {filteredOptions.length === 0 ? (
                            <div className="px-2 py-4 text-sm text-center text-muted-foreground">
                                {search && onCreate ? (
                                    <button
                                        className="text-sm text-primary hover:bg-accent hover:text-accent-foreground w-full text-left px-2 py-1.5 rounded-sm flex items-center justify-center gap-2 font-medium"
                                        onClick={handleCreate}
                                    >
                                        Crear "{search}"
                                    </button>
                                ) : (
                                    "No se encontraron resultados."
                                )}
                            </div>
                        ) : (
                            filteredOptions.map((option, index) => (
                                <div
                                    key={option.value}
                                    className={`px-3 py-2 text-sm cursor-pointer flex justify-between items-center transition-colors
                                        ${index === activeIndex ? "bg-accent text-accent-foreground" : "hover:bg-accent hover:text-accent-foreground"}
                                        ${option.value === value ? "bg-accent/50 font-medium" : ""}
                                    `}
                                    onClick={() => handleSelect(option.value)}
                                    onMouseEnter={() => setActiveIndex(index)}
                                >
                                    {option.label}
                                    {option.value === value && (
                                        <Check className="w-4 h-4 text-primary" />
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
