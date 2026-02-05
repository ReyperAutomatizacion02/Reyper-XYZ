"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";

export type Option = {
    value: string;
    label: string;
};

interface ComboboxCreatableProps {
    options: Option[];
    value?: string;
    onSelect: (value: string) => void;
    onCreate?: (newValue: string) => Promise<string | null>; // Returns the new ID
    placeholder?: string;
    searchPlaceholder?: string;
    emptyText?: string;
    createLabel?: string;
    disabled?: boolean;
    className?: string;
}

export function ComboboxCreatable({
    options,
    value,
    onSelect,
    onCreate,
    placeholder = "Seleccionar...",
    searchPlaceholder = "Buscar...",
    emptyText = "No encontrado.",
    createLabel = "Crear",
    disabled = false,
    className
}: ComboboxCreatableProps) {
    const [open, setOpen] = React.useState(false);
    const [inputValue, setInputValue] = React.useState("");
    const [creating, setCreating] = React.useState(false);

    const selectedOption = options.find((opt) => opt.value === value);

    const handleCreate = async () => {
        if (!onCreate || !inputValue) return;
        setCreating(true);
        try {
            const newId = await onCreate(inputValue);
            if (newId) {
                onSelect(newId);
                setOpen(false);
                setInputValue("");
            }
        } catch (error) {
            console.error("Error creating option:", error);
        } finally {
            setCreating(false);
        }
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn(
                        "w-full justify-between bg-background border-input hover:bg-accent hover:text-accent-foreground",
                        className // Allow overriding styles
                    )}
                    disabled={disabled}
                >
                    {selectedOption ? selectedOption.label : placeholder}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto min-w-[250px] p-0" align="start" side="bottom">
                <Command>
                    <CommandInput
                        placeholder={searchPlaceholder}
                        value={inputValue}
                        onValueChange={setInputValue}
                    />
                    <CommandList>
                        <CommandEmpty>
                            {onCreate && inputValue ? (
                                <div className="p-2">
                                    <p className="text-sm text-muted-foreground mb-2">{emptyText}</p>
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        className="w-full justify-start text-red-500 bg-red-500/10 hover:bg-red-500/20"
                                        onClick={handleCreate}
                                        disabled={creating}
                                    >
                                        <Plus className="mr-2 h-4 w-4" />
                                        {creating ? "Creando..." : `${createLabel} "${inputValue}"`}
                                    </Button>
                                </div>
                            ) : (
                                emptyText
                            )}
                        </CommandEmpty>
                        <CommandGroup>
                            {options.map((option) => (
                                <CommandItem
                                    key={option.value}
                                    value={option.label} // Use label for search filtering
                                    onSelect={() => {
                                        onSelect(option.value);
                                        setOpen(false);
                                    }}
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            value === option.value ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    {option.label}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
