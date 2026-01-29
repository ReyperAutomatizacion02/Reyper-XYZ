"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search, Building2, ArrowUpDown, CheckCircle2, XCircle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
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

    const filteredClients = clients.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.business_name && c.business_name.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const sortedClients = useMemo(() => {
        let sortableItems = [...filteredClients];
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                // Handle boolean sorting for is_active separately or convert to string
                if (sortConfig.key === "is_active") {
                    // @ts-ignore
                    const aBool = !!a[sortConfig.key];
                    // @ts-ignore
                    const bBool = !!b[sortConfig.key];
                    return sortConfig.direction === "asc"
                        ? (aBool === bBool ? 0 : aBool ? -1 : 1)
                        : (aBool === bBool ? 0 : aBool ? 1 : -1);
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
        setIsModalOpen(true);
    };

    const openEditModal = (client: Client) => {
        setCurrentClient(client);
        setName(client.name);
        setPrefix(client.prefix || "");
        setBusinessName(client.business_name || "");
        setIsActive(client.is_active !== false); // Default to true if undefined
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!name.trim()) return toast.warning("El nombre es requerido");

        setIsLoading(true);
        try {
            if (currentClient) {
                // Update
                await updateClientEntry(currentClient.id, name, prefix, businessName, isActive);
                setClients(prev => prev.map(c => c.id === currentClient.id ? { ...c, name, prefix, business_name: businessName, is_active: isActive } : c));
                toast.success("Cliente actualizado");
            } else {
                // Create
                const id = await createClientEntry(name, prefix, businessName, isActive);
                if (id) {
                    setClients(prev => [...prev, { id, name, prefix, business_name: businessName, is_active: isActive }]);
                    toast.success("Cliente creado");
                }
            }
            router.refresh(); // REFRESH DATA FOR TABS
            setIsModalOpen(false);
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        // Simple confirm for now. Ideally a custom Alert Dialog
        if (!confirm("¿Estás seguro de eliminar este cliente?")) return;

        try {
            await deleteClientEntry(id);
            setClients(prev => prev.filter(c => c.id !== id));
            router.refresh(); // REFRESH DATA FOR TABS
            toast.success("Cliente eliminado");
        } catch (error: any) {
            toast.error("Error al eliminar: " + error.message);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between gap-4">
                <div className="relative w-full sm:w-72">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar cliente..."
                        className="pl-9"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex gap-4 text-sm text-muted-foreground bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 rounded-md">
                        <span className="flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" /> Total: <strong className="text-foreground">{clients.length}</strong></span>
                        <div className="w-px h-4 bg-zinc-300 dark:bg-zinc-600" />
                        <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> Activos: <strong className="text-green-600 dark:text-green-400">{clients.filter(c => c.is_active !== false).length}</strong></span>
                    </div>
                    <Button onClick={openCreateModal} className="bg-red-600 hover:bg-red-700 text-white rounded-full">
                        <Plus className="w-4 h-4 mr-2" />
                        Nuevo Cliente
                    </Button>
                </div>
            </div>

            <div className="rounded-xl border bg-white dark:bg-zinc-950 shadow-sm overflow-hidden">
                <Table>
                    <TableHeader className="bg-zinc-50 dark:bg-zinc-900">
                        <TableRow>
                            <TableHead className="cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors" onClick={() => requestSort("name")}>
                                <div className="flex items-center gap-1">
                                    Nombre
                                    <ArrowUpDown className="w-3 h-3 text-muted-foreground" />
                                </div>
                            </TableHead>
                            <TableHead className="cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors" onClick={() => requestSort("business_name")}>
                                <div className="flex items-center gap-1">
                                    Razón Social
                                    <ArrowUpDown className="w-3 h-3 text-muted-foreground" />
                                </div>
                            </TableHead>
                            <TableHead className="w-[150px] cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors" onClick={() => requestSort("prefix")}>
                                <div className="flex items-center gap-1">
                                    Prefijo
                                    <ArrowUpDown className="w-3 h-3 text-muted-foreground" />
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
                                <TableRow key={client.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50">
                                    <TableCell className="font-medium flex items-center gap-2">
                                        <div className="p-2 bg-red-100 dark:bg-red-900/20 rounded-lg text-red-600">
                                            <Building2 className="w-4 h-4" />
                                        </div>
                                        {client.name}
                                    </TableCell>
                                    <TableCell className="text-zinc-500 text-sm">{client.business_name || "-"}</TableCell>
                                    <TableCell className="font-mono text-zinc-500">{client.prefix || "-"}</TableCell>
                                    <TableCell className="text-center">
                                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${client.is_active !== false ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-900/30' : 'bg-zinc-50 text-zinc-500 border-zinc-200 dark:bg-zinc-900/50 dark:text-zinc-500 dark:border-zinc-800'}`}>
                                            {client.is_active !== false ? (
                                                <>
                                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                                    Activo
                                                </>
                                            ) : (
                                                <>
                                                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                                                    Inactivo
                                                </>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button variant="ghost" size="icon" onClick={() => openEditModal(client)}>
                                                <Pencil className="w-4 h-4 text-zinc-500 hover:text-blue-500" />
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => handleDelete(client.id)}>
                                                <Trash2 className="w-4 h-4 text-zinc-500 hover:text-red-500" />
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
                            {currentClient ? "Modifica los datos del cliente." : "Ingresa los datos para el nuevo cliente."}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Nombre de la Empresa (Corto)</Label>
                            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Reyper CNC" />
                        </div>
                        <div className="space-y-2">
                            <Label>Razón Social (Facturación)</Label>
                            <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Ej. Reyper CNC S.A. de C.V." />
                        </div>
                        <div className="flex items-center justify-between border rounded-lg p-3 bg-muted/20">
                            <div className="space-y-0.5">
                                <Label>Estatus Activo</Label>
                                <p className="text-xs text-muted-foreground">Desactivar para ocultar en listas.</p>
                            </div>
                            <Switch checked={isActive} onCheckedChange={setIsActive} />
                        </div>
                        <div className="space-y-2">
                            <Label>Prefijo (para proyectos)</Label>
                            <Input value={prefix} onChange={(e) => setPrefix(e.target.value.toUpperCase())} placeholder="Ej. RYP" maxLength={5} />
                            <p className="text-xs text-muted-foreground">Opcional. Se usa para generar códigos de proyecto automáticos.</p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSave} disabled={isLoading} className="bg-red-600 hover:bg-red-700">
                            {isLoading ? "Guardando..." : "Guardar"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
