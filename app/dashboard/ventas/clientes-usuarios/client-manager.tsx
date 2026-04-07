"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search, Building2, ArrowUpDown, CheckCircle2, XCircle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { createClientEntry, updateClientEntry, deleteClientEntry } from "../actions";
import { getErrorMessage } from "@/lib/action-result";

interface Client {
    id: string;
    name: string;
    prefix?: string | null;
    business_name?: string | null;
    is_active?: boolean;
}

export function ClientManager({ initialClients }: { initialClients: Client[] }) {
    const router = useRouter();
    const [clients, setClients] = useState(initialClients);
    const [searchTerm, setSearchTerm] = useState("");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentClient, setCurrentClient] = useState<Client | null>(null); // null = new
    const [isLoading, setIsLoading] = useState(false);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

    // Form inputs
    const [name, setName] = useState("");
    const [prefix, setPrefix] = useState("");
    const [businessName, setBusinessName] = useState("");
    const [isActive, setIsActive] = useState(true);

    const [sortConfig, setSortConfig] = useState<{ key: keyof Client; direction: "asc" | "desc" } | null>(null);

    // Sync state with props to ensure updates from router.refresh() are reflected
    useEffect(() => {
        setClients(initialClients);
    }, [initialClients]);

    const filteredClients = clients.filter(
        (c) =>
            c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (c.business_name && c.business_name.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const sortedClients = useMemo(() => {
        const sortableItems = [...filteredClients];
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                // Handle boolean sorting for is_active separately or convert to string
                if (sortConfig.key === "is_active") {
                    // @ts-ignore
                    const aBool = !!a[sortConfig.key];
                    // @ts-ignore
                    const bBool = !!b[sortConfig.key];
                    return sortConfig.direction === "asc"
                        ? aBool === bBool
                            ? 0
                            : aBool
                              ? -1
                              : 1
                        : aBool === bBool
                          ? 0
                          : aBool
                            ? 1
                            : -1;
                }

                // @ts-ignore
                const aValue = (a[sortConfig.key] || "").toString().toLowerCase();
                // @ts-ignore
                const bValue = (b[sortConfig.key] || "").toString().toLowerCase();

                if (aValue < bValue) {
                    return sortConfig.direction === "asc" ? -1 : 1;
                }
                if (aValue > bValue) {
                    return sortConfig.direction === "asc" ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableItems;
    }, [filteredClients, sortConfig]);

    const requestSort = (key: keyof Client) => {
        let direction: "asc" | "desc" = "asc";
        if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") {
            direction = "desc";
        }
        setSortConfig({ key, direction });
    };

    const openCreateModal = () => {
        setCurrentClient(null);
        setName("");
        setPrefix("");
        setBusinessName("");
        setIsActive(true);
        setFieldErrors({});
        setIsModalOpen(true);
    };

    const openEditModal = (client: Client) => {
        setCurrentClient(client);
        setName(client.name);
        setPrefix(client.prefix || "");
        setBusinessName(client.business_name || "");
        setIsActive(client.is_active !== false); // Default to true if undefined
        setFieldErrors({});
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!name.trim()) {
            setFieldErrors({ name: "El nombre es requerido" });
            return;
        }

        setIsLoading(true);
        setFieldErrors({});
        try {
            if (currentClient) {
                const result = await updateClientEntry(currentClient.id, name, prefix, businessName, isActive);
                if (result.success) {
                    setClients((prev) =>
                        prev.map((c) =>
                            c.id === currentClient.id
                                ? { ...c, name, prefix, business_name: businessName, is_active: isActive }
                                : c
                        )
                    );
                    toast.success("Cliente actualizado");
                    router.refresh();
                    setIsModalOpen(false);
                } else if (result.error.code === "VALIDATION_ERROR") {
                    const mapped: Record<string, string> = {};
                    for (const [field, msgs] of Object.entries(result.error.fields)) {
                        mapped[field] = Array.isArray(msgs) ? msgs[0] : msgs;
                    }
                    setFieldErrors(mapped);
                } else {
                    toast.error(getErrorMessage(result.error));
                }
            } else {
                const result = await createClientEntry(name, prefix, businessName, isActive);
                if (result.success) {
                    setClients((prev) => [
                        ...prev,
                        { id: result.data, name, prefix, business_name: businessName, is_active: isActive },
                    ]);
                    toast.success("Cliente creado");
                    router.refresh();
                    setIsModalOpen(false);
                } else if (result.error.code === "VALIDATION_ERROR") {
                    const mapped: Record<string, string> = {};
                    for (const [field, msgs] of Object.entries(result.error.fields)) {
                        mapped[field] = Array.isArray(msgs) ? msgs[0] : msgs;
                    }
                    setFieldErrors(mapped);
                } else {
                    toast.error(getErrorMessage(result.error));
                }
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("¿Estás seguro de eliminar este cliente?")) return;

        const result = await deleteClientEntry(id);
        if (result.success) {
            setClients((prev) => prev.filter((c) => c.id !== id));
            router.refresh();
            toast.success("Cliente eliminado");
        } else {
            toast.error(getErrorMessage(result.error));
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col justify-between gap-4 sm:flex-row">
                <div className="relative w-full sm:w-72">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar cliente..."
                        className="pl-9"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        id="clients-search"
                    />
                </div>
                <div className="flex items-center gap-4">
                    <div
                        className="flex gap-4 rounded-md border border-border bg-muted/50 px-3 py-1.5 text-sm text-muted-foreground"
                        id="clients-stats"
                    >
                        <span className="flex items-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5" /> Total:{" "}
                            <strong className="text-foreground">{clients.length}</strong>
                        </span>
                        <div className="h-4 w-px bg-border" />
                        <span className="flex items-center gap-1.5">
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> Activos:{" "}
                            <strong className="text-green-600 dark:text-green-400">
                                {clients.filter((c) => c.is_active !== false).length}
                            </strong>
                        </span>
                    </div>
                    <Button
                        onClick={openCreateModal}
                        className="rounded-full bg-red-600 text-white hover:bg-red-700"
                        id="clients-new-btn"
                    >
                        <Plus className="mr-2 h-4 w-4" />
                        Nuevo Cliente
                    </Button>
                </div>
            </div>

            <div className="overflow-hidden rounded-xl border bg-card shadow-sm" id="clients-table">
                <Table>
                    <TableHeader className="bg-muted/50">
                        <TableRow>
                            <TableHead
                                className="cursor-pointer transition-colors hover:bg-muted/50"
                                onClick={() => requestSort("name")}
                            >
                                <div className="flex items-center gap-1">
                                    Nombre
                                    <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                                </div>
                            </TableHead>
                            <TableHead
                                className="cursor-pointer transition-colors hover:bg-muted/50"
                                onClick={() => requestSort("business_name")}
                            >
                                <div className="flex items-center gap-1">
                                    Razón Social
                                    <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                                </div>
                            </TableHead>
                            <TableHead
                                className="w-[150px] cursor-pointer transition-colors hover:bg-muted/50"
                                onClick={() => requestSort("prefix")}
                            >
                                <div className="flex items-center gap-1">
                                    Prefijo
                                    <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                                </div>
                            </TableHead>
                            <TableHead className="w-[100px] text-center">Estatus</TableHead>
                            <TableHead className="w-[100px] text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sortedClients.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                    No hay clientes registrados.
                                </TableCell>
                            </TableRow>
                        ) : (
                            sortedClients.map((client) => (
                                <TableRow key={client.id} className="hover:bg-muted/50">
                                    <TableCell className="flex items-center gap-2 font-medium">
                                        <div className="rounded-lg bg-red-100 p-2 text-red-600 dark:bg-red-900/20">
                                            <Building2 className="h-4 w-4" />
                                        </div>
                                        {client.name}
                                    </TableCell>
                                    <TableCell className="text-sm text-zinc-500">
                                        {client.business_name || "-"}
                                    </TableCell>
                                    <TableCell className="font-mono text-zinc-500">{client.prefix || "-"}</TableCell>
                                    <TableCell className="text-center">
                                        <div
                                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${client.is_active !== false ? "border-green-500/20 bg-green-500/10 text-green-600 dark:text-green-400" : "border-border bg-muted text-muted-foreground"}`}
                                        >
                                            {client.is_active !== false ? (
                                                <>
                                                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
                                                    Activo
                                                </>
                                            ) : (
                                                <>
                                                    <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
                                                    Inactivo
                                                </>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button variant="ghost" size="icon" onClick={() => openEditModal(client)}>
                                                <Pencil className="h-4 w-4 text-zinc-500 hover:text-blue-500" />
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => handleDelete(client.id)}>
                                                <Trash2 className="h-4 w-4 text-zinc-500 hover:text-red-500" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{currentClient ? "Editar Cliente" : "Nuevo Cliente"}</DialogTitle>
                        <DialogDescription>
                            {currentClient
                                ? "Modifica los datos del cliente."
                                : "Ingresa los datos para el nuevo cliente."}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="client-name">Nombre de la Empresa (Corto)</Label>
                            <Input
                                id="client-name"
                                value={name}
                                onChange={(e) => {
                                    setName(e.target.value);
                                    setFieldErrors((prev) => ({ ...prev, name: "" }));
                                }}
                                placeholder="Ej. Reyper CNC"
                                aria-describedby={fieldErrors.name ? "client-name-error" : undefined}
                                aria-invalid={!!fieldErrors.name}
                                className={fieldErrors.name ? "border-destructive" : undefined}
                            />
                            {fieldErrors.name && (
                                <p id="client-name-error" role="alert" className="text-xs text-destructive">
                                    {fieldErrors.name}
                                </p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="client-business-name">Razón Social (Facturación)</Label>
                            <Input
                                id="client-business-name"
                                value={businessName}
                                onChange={(e) => {
                                    setBusinessName(e.target.value);
                                    setFieldErrors((prev) => ({ ...prev, business_name: "" }));
                                }}
                                placeholder="Ej. Reyper CNC S.A. de C.V."
                                aria-describedby={fieldErrors.business_name ? "client-business-name-error" : undefined}
                                aria-invalid={!!fieldErrors.business_name}
                                className={fieldErrors.business_name ? "border-destructive" : undefined}
                            />
                            {fieldErrors.business_name && (
                                <p id="client-business-name-error" role="alert" className="text-xs text-destructive">
                                    {fieldErrors.business_name}
                                </p>
                            )}
                        </div>
                        <div className="flex items-center justify-between rounded-lg border bg-muted/20 p-3">
                            <div className="space-y-0.5">
                                <Label>Estatus Activo</Label>
                                <p className="text-xs text-muted-foreground">Desactivar para ocultar en listas.</p>
                            </div>
                            <Switch checked={isActive} onCheckedChange={setIsActive} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="client-prefix">Prefijo (para proyectos)</Label>
                            <Input
                                id="client-prefix"
                                value={prefix}
                                onChange={(e) => {
                                    setPrefix(e.target.value.toUpperCase());
                                    setFieldErrors((prev) => ({ ...prev, prefix: "" }));
                                }}
                                placeholder="Ej. RYP"
                                maxLength={5}
                                aria-describedby={fieldErrors.prefix ? "client-prefix-error" : "client-prefix-hint"}
                                aria-invalid={!!fieldErrors.prefix}
                                className={fieldErrors.prefix ? "border-destructive" : undefined}
                            />
                            {fieldErrors.prefix ? (
                                <p id="client-prefix-error" role="alert" className="text-xs text-destructive">
                                    {fieldErrors.prefix}
                                </p>
                            ) : (
                                <p id="client-prefix-hint" className="text-xs text-muted-foreground">
                                    Opcional. Se usa para generar códigos de proyecto automáticos.
                                </p>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsModalOpen(false)}>
                            Cancelar
                        </Button>
                        <Button onClick={handleSave} disabled={isLoading} className="bg-red-600 hover:bg-red-700">
                            {isLoading ? "Guardando..." : "Guardar"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
