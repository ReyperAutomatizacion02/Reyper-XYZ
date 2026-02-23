"use client";

import { Filter, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useState } from "react";

interface QuoteHistoryFiltersProps {
    searchTerm: string;
    setSearchTerm: (val: string) => void;
    clientFilter: string;
    setClientFilter: (val: string) => void;
    statusFilter: string;
    setStatusFilter: (val: string) => void;
    clients: { id: string, name: string }[];
}

export function QuoteHistoryFilters({
    searchTerm,
    setSearchTerm,
    clientFilter,
    setClientFilter,
    statusFilter,
    setStatusFilter,
    clients
}: QuoteHistoryFiltersProps) {
    const [isOpen, setIsOpen] = useState(false);

    const activeFilterCount = (clientFilter !== 'all' ? 1 : 0) + (statusFilter !== 'all' ? 1 : 0);

    const handleClearAll = () => {
        setClientFilter("all");
        setStatusFilter("all");
        setSearchTerm("");
        setIsOpen(false);
    };

    return (
        <Card className="bg-card border-border border-l-4 border-l-red-500 shadow-sm" id="history-search-filter">
            <CardContent className="pt-6">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar por Folio (COT-...) o Cliente..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 bg-background/50 border-border focus:border-red-500 transition-colors uppercase"
                        />
                    </div>

                    <Popover open={isOpen} onOpenChange={setIsOpen}>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className="bg-background/50 border-border font-bold text-xs uppercase flex gap-2">
                                <Filter className="w-4 h-4" />
                                Filtros {activeFilterCount > 0 && (
                                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] text-white">
                                        {activeFilterCount}
                                    </span>
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="bg-card border-border sm:w-[350px]" align="end">
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 border-b border-border pb-2">
                                    <Filter className="w-4 h-4 text-red-500" />
                                    <span className="text-xs font-bold uppercase text-red-500">Filtros Avanzados</span>
                                </div>
                                <div className="grid gap-4 py-2">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Cliente</label>
                                        <Select value={clientFilter} onValueChange={setClientFilter}>
                                            <SelectTrigger className="bg-background/50 border-border uppercase text-xs font-bold w-full">
                                                <SelectValue placeholder="Filtrar por Cliente" />
                                            </SelectTrigger>
                                            <SelectContent position="popper" className="max-h-[var(--radix-select-content-available-height)]">
                                                <SelectItem value="all">TODOS LOS CLIENTES</SelectItem>
                                                {clients.map(c => (
                                                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Estado</label>
                                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                                            <SelectTrigger className="bg-background/50 border-border uppercase text-xs font-bold w-full">
                                                <SelectValue placeholder="Estatus" />
                                            </SelectTrigger>
                                            <SelectContent position="popper">
                                                <SelectItem value="all">TODOS LOS ESTADOS</SelectItem>
                                                <SelectItem value="active">ACTIVA</SelectItem>
                                                <SelectItem value="approved">PROYECTO</SelectItem>
                                                <SelectItem value="cancelled">CANCELADA</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="flex justify-end gap-2 border-t border-border pt-4">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-[10px] font-bold uppercase hover:bg-muted h-8"
                                        onClick={handleClearAll}
                                    >
                                        Limpiar Todo
                                    </Button>
                                    <Button
                                        size="sm"
                                        className="bg-red-600 hover:bg-red-700 text-white font-bold text-[10px] uppercase h-8 px-6"
                                        onClick={() => setIsOpen(false)}
                                    >
                                        Aplicar
                                    </Button>
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>
            </CardContent>
        </Card>
    );
}
