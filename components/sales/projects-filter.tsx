"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Filter, X, Calendar as CalendarIcon, Check, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProjectFilters } from "@/app/dashboard/ventas/proyectos/hooks/use-project-filters";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface FilterOptions {
    clients: string[];
    requestors: string[];
}

interface ProjectsFilterProps {
    filters: ProjectFilters;
    options: FilterOptions;
    onUpdate: (key: keyof ProjectFilters, value: any) => void;
    onReset: () => void;
    activeCount: number;
}

export function ProjectsFilter({ filters, options, onUpdate, onReset, activeCount }: ProjectsFilterProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [clientSearch, setClientSearch] = useState("");
    const [requestorSearch, setRequestorSearch] = useState("");

    const toggleArrayFilter = (key: 'clients' | 'requestors' | 'status', value: string) => {
        const current = filters[key];
        const updated = current.includes(value)
            ? current.filter(item => item !== value)
            : [...current, value];
        onUpdate(key, updated);
    };

    const filteredClients = options.clients.filter(c =>
        c.toLowerCase().includes(clientSearch.toLowerCase())
    );

    const filteredRequestors = options.requestors.filter(r =>
        r.toLowerCase().includes(requestorSearch.toLowerCase())
    );

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className={cn("relative gap-2 border-dashed", activeCount > 0 && "bg-secondary/50 border-solid border-primary/30")}>
                    <Filter className="w-4 h-4" />
                    Filtros
                    {activeCount > 0 && (
                        <Badge variant="secondary" className="ml-1 h-5 px-1.5 min-w-[1.25rem] pointer-events-none bg-primary text-primary-foreground font-bold text-[10px]">
                            {activeCount}
                        </Badge>
                    )}
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden outline-none">
                <DialogHeader className="px-6 py-4 border-b bg-muted/20">
                    <div className="flex items-center justify-between">
                        <DialogTitle className="text-lg font-semibold">Filtrar Proyectos</DialogTitle>
                        {activeCount > 0 && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onReset}
                                className="h-8 px-2 text-xs text-muted-foreground hover:text-red-500"
                            >
                                <X className="w-3.5 h-3.5 mr-1" />
                                Limpiar todo
                            </Button>
                        )}
                    </div>
                </DialogHeader>

                <Tabs defaultValue="general" className="w-full flex-1 flex flex-col overflow-hidden">
                    <div className="px-6 pt-4">
                        <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0 h-9">
                            <TabsTrigger value="general" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2 text-sm">General</TabsTrigger>
                            <TabsTrigger value="clients" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2 text-sm">Clientes {filters.clients.length > 0 && `(${filters.clients.length})`}</TabsTrigger>
                            <TabsTrigger value="requestors" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2 text-sm">Solicitantes {filters.requestors.length > 0 && `(${filters.requestors.length})`}</TabsTrigger>
                        </TabsList>
                    </div>

                    <div className="p-6 flex-1 overflow-y-auto max-h-[60vh]">
                        <TabsContent value="general" className="space-y-8 mt-0 border-none">
                            {/* Status */}
                            <div className="space-y-3">
                                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Estado de Entrega</Label>
                                <div className="flex gap-3">
                                    {['a_tiempo', 'retrasado'].map((status) => {
                                        const isActive = filters.status.includes(status);
                                        return (
                                            <div
                                                key={status}
                                                onClick={() => toggleArrayFilter('status', status)}
                                                className={cn(
                                                    "cursor-pointer flex-1 px-4 py-3 rounded-lg border text-sm font-medium text-center transition-all",
                                                    isActive
                                                        ? "bg-primary text-primary-foreground border-primary shadow-md"
                                                        : "bg-background border-border hover:bg-muted"
                                                )}
                                            >
                                                {status === 'a_tiempo' ? 'A Tiempo' : 'Retrasado'}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Dates */}
                            <div className="space-y-3">
                                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Fecha de Entrega</Label>
                                <div className="grid grid-cols-2 gap-4">
                                    {/* Start Date */}
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                className={cn("w-full justify-start text-left font-normal", !filters.dateRange?.from && "text-muted-foreground")}
                                            >
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {filters.dateRange?.from ? format(filters.dateRange.from, "PPP", { locale: es }) : "Desde..."}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar
                                                mode="single"
                                                selected={filters.dateRange?.from}
                                                onSelect={(date) => {
                                                    onUpdate('dateRange', { ...filters.dateRange, from: date });
                                                }}
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>

                                    {/* End Date */}
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                className={cn("w-full justify-start text-left font-normal", !filters.dateRange?.to && "text-muted-foreground")}
                                            >
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {filters.dateRange?.to ? format(filters.dateRange.to, "PPP", { locale: es }) : "Hasta..."}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar
                                                mode="single"
                                                selected={filters.dateRange?.to}
                                                onSelect={(date) => {
                                                    onUpdate('dateRange', { ...filters.dateRange, to: date });
                                                }}
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="clients" className="mt-0 h-full border-none flex flex-col gap-4">
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Buscar clientes..."
                                    className="pl-9"
                                    value={clientSearch}
                                    onChange={(e) => setClientSearch(e.target.value)}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-2 content-start">
                                {filteredClients.map(client => {
                                    const isSelected = filters.clients.includes(client);
                                    return (
                                        <div
                                            key={client}
                                            onClick={() => toggleArrayFilter('clients', client)}
                                            className={cn(
                                                "flex items-center space-x-3 px-3 py-2.5 rounded-md cursor-pointer text-sm transition-all border",
                                                isSelected
                                                    ? "bg-primary/5 border-primary/30 text-primary shadow-sm"
                                                    : "bg-background border-transparent hover:bg-muted hover:border-border/50"
                                            )}
                                        >
                                            <div className={cn(
                                                "w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0",
                                                isSelected ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/30 bg-transparent"
                                            )}>
                                                {isSelected && <Check className="w-3 h-3" />}
                                            </div>
                                            <span className="truncate">{client}</span>
                                        </div>
                                    )
                                })}
                                {filteredClients.length === 0 && (
                                    <div className="col-span-2 text-center py-8 text-muted-foreground text-sm">
                                        No se encontraron clientes
                                    </div>
                                )}
                            </div>
                        </TabsContent>

                        <TabsContent value="requestors" className="mt-0 h-full border-none flex flex-col gap-4">
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Buscar solicitantes..."
                                    className="pl-9"
                                    value={requestorSearch}
                                    onChange={(e) => setRequestorSearch(e.target.value)}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-2 content-start">
                                {filteredRequestors.map(requestor => {
                                    const isSelected = filters.requestors.includes(requestor);
                                    return (
                                        <div
                                            key={requestor}
                                            onClick={() => toggleArrayFilter('requestors', requestor)}
                                            className={cn(
                                                "flex items-center space-x-3 px-3 py-2.5 rounded-md cursor-pointer text-sm transition-all border",
                                                isSelected
                                                    ? "bg-primary/5 border-primary/30 text-primary shadow-sm"
                                                    : "bg-background border-transparent hover:bg-muted hover:border-border/50"
                                            )}
                                        >
                                            <div className={cn(
                                                "w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0",
                                                isSelected ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/30 bg-transparent"
                                            )}>
                                                {isSelected && <Check className="w-3 h-3" />}
                                            </div>
                                            <span className="truncate">{requestor}</span>
                                        </div>
                                    )
                                })}
                                {filteredRequestors.length === 0 && (
                                    <div className="col-span-2 text-center py-8 text-muted-foreground text-sm">
                                        No se encontraron solicitantes
                                    </div>
                                )}
                            </div>
                        </TabsContent>
                    </div>
                </Tabs>

                <DialogFooter className="p-4 border-t bg-muted/20 sm:justify-between items-center">
                    <div className="text-xs text-muted-foreground">
                        {activeCount > 0 ? `${activeCount} filtros activos` : 'Sin filtros aplicados'}
                    </div>
                    <Button onClick={() => setIsOpen(false)}>
                        Ver Resultados
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
