"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { DateSelector } from "@/components/ui/date-selector";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Filter, X, Check, Search } from "lucide-react";
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
    /**
     * Optional configuration to hide/show filter tabs based on area
     */
    hiddenTabs?: string[];
}

export function ProjectsFilter({
    filters,
    options,
    onUpdate,
    onReset,
    activeCount,
    hiddenTabs = [],
}: ProjectsFilterProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [clientSearch, setClientSearch] = useState("");
    const [requestorSearch, setRequestorSearch] = useState("");

    const toggleArrayFilter = (key: "clients" | "requestors" | "status", value: string) => {
        const current = filters[key] as string[];
        const updated = current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
        onUpdate(key, updated);
    };

    const filteredClients = options.clients.filter((c) => c.toLowerCase().includes(clientSearch.toLowerCase()));

    const filteredRequestors = options.requestors.filter((r) =>
        r.toLowerCase().includes(requestorSearch.toLowerCase())
    );

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button
                    variant="outline"
                    className={cn(
                        "relative gap-2 border-dashed",
                        activeCount > 0 && "border-solid border-primary/30 bg-secondary/50"
                    )}
                >
                    <Filter className="h-4 w-4" />
                    Filtros
                    {activeCount > 0 && (
                        <Badge
                            variant="secondary"
                            className="pointer-events-none ml-1 h-5 min-w-[1.25rem] bg-primary px-1.5 text-[10px] font-bold text-primary-foreground"
                        >
                            {activeCount}
                        </Badge>
                    )}
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl gap-0 overflow-hidden p-0 outline-none">
                <DialogHeader className="border-b bg-muted/20 px-6 py-4">
                    <div className="flex items-center justify-between">
                        <DialogTitle className="text-lg font-semibold">Filtrar Proyectos</DialogTitle>
                        {activeCount > 0 && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onReset}
                                className="h-8 px-2 text-xs text-muted-foreground hover:text-red-500"
                            >
                                <X className="mr-1 h-3.5 w-3.5" />
                                Limpiar todo
                            </Button>
                        )}
                    </div>
                </DialogHeader>

                <Tabs defaultValue="general" className="flex w-full flex-1 flex-col overflow-hidden">
                    <div className="px-6 pt-4">
                        <TabsList className="h-9 w-full justify-start rounded-none border-b bg-transparent p-0">
                            {!hiddenTabs.includes("general") && (
                                <TabsTrigger
                                    value="general"
                                    className="rounded-none border-b-2 border-transparent px-4 py-2 text-sm data-[state=active]:border-primary data-[state=active]:bg-transparent"
                                >
                                    General
                                </TabsTrigger>
                            )}
                            {!hiddenTabs.includes("clients") && (
                                <TabsTrigger
                                    value="clients"
                                    className="rounded-none border-b-2 border-transparent px-4 py-2 text-sm data-[state=active]:border-primary data-[state=active]:bg-transparent"
                                >
                                    Clientes {filters.clients.length > 0 && `(${filters.clients.length})`}
                                </TabsTrigger>
                            )}
                            {!hiddenTabs.includes("requestors") && (
                                <TabsTrigger
                                    value="requestors"
                                    className="rounded-none border-b-2 border-transparent px-4 py-2 text-sm data-[state=active]:border-primary data-[state=active]:bg-transparent"
                                >
                                    Solicitantes {filters.requestors.length > 0 && `(${filters.requestors.length})`}
                                </TabsTrigger>
                            )}
                        </TabsList>
                    </div>

                    <div className="max-h-[60vh] flex-1 overflow-y-auto p-6">
                        {!hiddenTabs.includes("general") && (
                            <TabsContent value="general" className="mt-0 space-y-8 border-none">
                                {/* Status */}
                                <div className="space-y-3">
                                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                        Estado de Entrega
                                    </Label>
                                    <div className="flex gap-3">
                                        {["a_tiempo", "retrasado"].map((status) => {
                                            const isActive = filters.status.includes(status);
                                            return (
                                                <div
                                                    key={status}
                                                    onClick={() => toggleArrayFilter("status", status)}
                                                    className={cn(
                                                        "flex-1 cursor-pointer rounded-lg border px-4 py-3 text-center text-sm font-medium transition-all",
                                                        isActive
                                                            ? "border-primary bg-primary text-primary-foreground shadow-md"
                                                            : "border-border bg-background hover:bg-muted"
                                                    )}
                                                >
                                                    {status === "a_tiempo" ? "A Tiempo" : "Retrasado"}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Dates */}
                                <div className="space-y-3">
                                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                        Fecha de Entrega
                                    </Label>
                                    <div className="grid grid-cols-2 gap-4">
                                        {/* Start Date */}
                                        <DateSelector
                                            date={filters.dateRange?.from}
                                            onSelect={(date) =>
                                                onUpdate("dateRange", { ...filters.dateRange, from: date })
                                            }
                                            placeholder="Desde..."
                                        />

                                        {/* End Date */}
                                        <DateSelector
                                            date={filters.dateRange?.to}
                                            onSelect={(date) =>
                                                onUpdate("dateRange", { ...filters.dateRange, to: date })
                                            }
                                            placeholder="Hasta..."
                                        />
                                    </div>
                                </div>
                            </TabsContent>
                        )}

                        {!hiddenTabs.includes("clients") && (
                            <TabsContent value="clients" className="mt-0 flex h-full flex-col gap-4 border-none">
                                <div className="relative">
                                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Buscar clientes..."
                                        className="pl-9"
                                        value={clientSearch}
                                        onChange={(e) => setClientSearch(e.target.value)}
                                    />
                                </div>
                                <div className="grid grid-cols-2 content-start gap-2">
                                    {filteredClients.map((client) => {
                                        const isSelected = filters.clients.includes(client);
                                        return (
                                            <div
                                                key={client}
                                                onClick={() => toggleArrayFilter("clients", client)}
                                                className={cn(
                                                    "flex cursor-pointer items-center space-x-3 rounded-md border px-3 py-2.5 text-sm transition-all",
                                                    isSelected
                                                        ? "border-primary/30 bg-primary/5 text-primary shadow-sm"
                                                        : "border-transparent bg-background hover:border-border/50 hover:bg-muted"
                                                )}
                                            >
                                                <div
                                                    className={cn(
                                                        "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                                                        isSelected
                                                            ? "border-primary bg-primary text-primary-foreground"
                                                            : "border-muted-foreground/30 bg-transparent"
                                                    )}
                                                >
                                                    {isSelected && <Check className="h-3 w-3" />}
                                                </div>
                                                <span className="truncate">{client}</span>
                                            </div>
                                        );
                                    })}
                                    {filteredClients.length === 0 && (
                                        <div className="col-span-2 py-8 text-center text-sm text-muted-foreground">
                                            No se encontraron clientes
                                        </div>
                                    )}
                                </div>
                            </TabsContent>
                        )}

                        {!hiddenTabs.includes("requestors") && (
                            <TabsContent value="requestors" className="mt-0 flex h-full flex-col gap-4 border-none">
                                <div className="relative">
                                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Buscar solicitantes..."
                                        className="pl-9"
                                        value={requestorSearch}
                                        onChange={(e) => setRequestorSearch(e.target.value)}
                                    />
                                </div>
                                <div className="grid grid-cols-2 content-start gap-2">
                                    {filteredRequestors.map((requestor) => {
                                        const isSelected = filters.requestors.includes(requestor);
                                        return (
                                            <div
                                                key={requestor}
                                                onClick={() => toggleArrayFilter("requestors", requestor)}
                                                className={cn(
                                                    "flex cursor-pointer items-center space-x-3 rounded-md border px-3 py-2.5 text-sm transition-all",
                                                    isSelected
                                                        ? "border-primary/30 bg-primary/5 text-primary shadow-sm"
                                                        : "border-transparent bg-background hover:border-border/50 hover:bg-muted"
                                                )}
                                            >
                                                <div
                                                    className={cn(
                                                        "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                                                        isSelected
                                                            ? "border-primary bg-primary text-primary-foreground"
                                                            : "border-muted-foreground/30 bg-transparent"
                                                    )}
                                                >
                                                    {isSelected && <Check className="h-3 w-3" />}
                                                </div>
                                                <span className="truncate">{requestor}</span>
                                            </div>
                                        );
                                    })}
                                    {filteredRequestors.length === 0 && (
                                        <div className="col-span-2 py-8 text-center text-sm text-muted-foreground">
                                            No se encontraron solicitantes
                                        </div>
                                    )}
                                </div>
                            </TabsContent>
                        )}
                    </div>
                </Tabs>

                <DialogFooter className="items-center border-t bg-muted/20 p-4 sm:justify-between">
                    <div className="text-xs text-muted-foreground">
                        {activeCount > 0 ? `${activeCount} filtros activos` : "Sin filtros aplicados"}
                    </div>
                    <Button onClick={() => setIsOpen(false)}>Ver Resultados</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
