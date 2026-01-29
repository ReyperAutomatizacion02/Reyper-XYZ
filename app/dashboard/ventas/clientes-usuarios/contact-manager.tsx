"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search, User, Briefcase, ArrowUpDown, CheckCircle2, XCircle } from "lucide-react";
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
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { createContactEntry, updateContactEntry, deleteContactEntry, createContactBatch } from "../actions";


interface Contact {
    id: string;
    name: string;
    client_id?: string | null;
    is_active?: boolean;
}

interface Client {
    id: string;
    name: string;
}

export function ContactManager({ initialContacts, clients }: { initialContacts: Contact[], clients: Client[] }) {
    const router = useRouter();
    const [contacts, setContacts] = useState(initialContacts);
    const [searchTerm, setSearchTerm] = useState("");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentContact, setCurrentContact] = useState<Contact | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    // Form inputs
    const [names, setNames] = useState<string[]>([""]); // Array for batch creation
    const [clientId, setClientId] = useState<string>("no_client");
    const [isActive, setIsActive] = useState(true);

    const [sortConfig, setSortConfig] = useState<{ key: keyof Contact | "client_name"; direction: "asc" | "desc" } | null>(null);

    // Sync state with props
    useEffect(() => {
        setContacts(initialContacts);
    }, [initialContacts]);

    const filteredContacts = contacts.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const sortedContacts = useMemo(() => {
        let sortableItems = [...filteredContacts];
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                let aValue = "";
                let bValue = "";

                if (sortConfig.key === "client_name") {
                    aValue = (clients.find(c => c.id === a.client_id)?.name || "").toLowerCase();
                    bValue = (clients.find(c => c.id === b.client_id)?.name || "").toLowerCase();
                } else {
                    // @ts-ignore - Dynamic key access safely handled by logic, but TS might complain about optional properties vs keyof
                    aValue = (a[sortConfig.key as keyof Contact] || "").toLowerCase();
                    // @ts-ignore
                    bValue = (b[sortConfig.key as keyof Contact] || "").toLowerCase();
                }

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
    }, [filteredContacts, sortConfig, clients]);

    const requestSort = (key: keyof Contact | "client_name") => {
        let direction: "asc" | "desc" = "asc";
        if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") {
            direction = "desc";
        }
        setSortConfig({ key, direction });
    };

    const openCreateModal = () => {
        setCurrentContact(null);
        setNames([""]); // Start with one empty field
        setClientId("no_client");
        setIsActive(true);
        setIsModalOpen(true);
    };

    const openEditModal = (contact: Contact) => {
        setCurrentContact(contact);
        setNames([contact.name]); // Single name for editing
        setClientId(contact.client_id || "no_client");
        setIsActive(contact.is_active !== false); // Default to true
        setIsModalOpen(true);
    };

    const handleAddName = () => {
        setNames([...names, ""]);
    };

    const handleRemoveName = (index: number) => {
        setNames(names.filter((_, i) => i !== index));
    };

    const handleNameChange = (index: number, value: string) => {
        const newNames = [...names];
        newNames[index] = value;
        setNames(newNames);
    };

    const handleSave = async () => {
        const validNames = names.filter(n => n.trim() !== "");
        if (validNames.length === 0) return toast.warning("Debes ingresar al menos un nombre");

        const clientToSave = clientId === "no_client" ? undefined : clientId;

        setIsLoading(true);
        try {
            if (currentContact) {
                // Update Single
                await updateContactEntry(currentContact.id, validNames[0], clientToSave, isActive);
                setContacts(prev => prev.map(c => c.id === currentContact.id ? { ...c, name: validNames[0], client_id: clientToSave, is_active: isActive } : c));
                toast.success("Usuario actualizado");
            } else {
                // Create Batch
                await createContactBatch(validNames, clientToSave, isActive);
                // We can't easily append to local state because we don't have the IDs returned from batch insert (supabase limitation or simple implementation)
                // However, router.refresh() will help, but for immediate feedback we might need to rely on the refresh solely or fetch.
                // For better UX, we'll force a reload via router.refresh immediately.
                toast.success(`${validNames.length} usuario(s) creado(s)`);
            }
            router.refresh();
            setIsModalOpen(false);
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("¿Estás seguro de eliminar este usuario?")) return;

        try {
            await deleteContactEntry(id);
            setContacts(prev => prev.filter(c => c.id !== id));
            router.refresh();
            toast.success("Usuario eliminado");
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
                        placeholder="Buscar usuario..."
                        className="pl-9"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex gap-4 text-sm text-muted-foreground bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 rounded-md">
                        <span className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> Total: <strong className="text-foreground">{contacts.length}</strong></span>
                        <div className="w-px h-4 bg-zinc-300 dark:bg-zinc-600" />
                        <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> Activos: <strong className="text-green-600 dark:text-green-400">{contacts.filter(c => c.is_active !== false).length}</strong></span>
                    </div>
                    <Button onClick={openCreateModal} className="bg-blue-600 hover:bg-blue-700 text-white rounded-full">
                        <Plus className="w-4 h-4 mr-2" />
                        Nuevo Usuario
                    </Button>
                </div>
            </div>

            <div className="rounded-xl border bg-white dark:bg-zinc-950 shadow-sm overflow-hidden">
                <Table>
                    <TableHeader className="bg-zinc-50 dark:bg-zinc-900">
                        <TableRow>
                            <TableHead className="cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors" onClick={() => requestSort("name")}>
                                <div className="flex items-center gap-1">
                                    Nombre Completo
                                    <ArrowUpDown className="w-3 h-3 text-muted-foreground" />
                                </div>
                            </TableHead>
                            <TableHead className="cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors" onClick={() => requestSort("client_name")}>
                                <div className="flex items-center gap-1">
                                    Cliente Asociado
                                    <ArrowUpDown className="w-3 h-3 text-muted-foreground" />
                                </div>
                            </TableHead>
                            <TableHead className="w-[100px] text-center">Estatus</TableHead>
                            <TableHead className="w-[100px] text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sortedContacts.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                                    No hay usuarios registrados.
                                </TableCell>
                            </TableRow>
                        ) : (
                            sortedContacts.map((contact) => (
                                <TableRow key={contact.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50">
                                    <TableCell className="font-medium flex items-center gap-2">
                                        <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg text-blue-600">
                                            <User className="w-4 h-4" />
                                        </div>
                                        {contact.name}
                                    </TableCell>
                                    <TableCell className="text-zinc-500 text-sm">
                                        {contact.client_id ? clients.find(cl => cl.id === contact.client_id)?.name : <span className="text-muted-foreground italic">Sin asignar</span>}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${contact.is_active !== false ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-900/30' : 'bg-zinc-50 text-zinc-500 border-zinc-200 dark:bg-zinc-900/50 dark:text-zinc-500 dark:border-zinc-800'}`}>
                                            {contact.is_active !== false ? "Activo" : "Inactivo"}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button variant="ghost" size="icon" onClick={() => openEditModal(contact)}>
                                                <Pencil className="w-4 h-4 text-zinc-500 hover:text-blue-500" />
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => handleDelete(contact.id)}>
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
                <DialogContent className="sm:max-w-[550px] max-h-[95vh] flex flex-col p-0 overflow-hidden">
                    <div className="p-6 pb-2">
                        <DialogHeader>
                            <DialogTitle>{currentContact ? "Editar Usuario" : "Nuevo Usuario"}</DialogTitle>
                            <DialogDescription>
                                {currentContact ? "Modifica nombre del usuario/solicitante." : "Registra un nuevo usuario o solicitante de proyectos."}
                            </DialogDescription>
                        </DialogHeader>
                    </div>
                    <div className="flex-1 overflow-y-auto px-6 py-2 custom-scrollbar">
                        <div className="space-y-4">
                            <div className="space-y-3">
                                <Label>Nombre(s) de Usuario</Label>
                                <div className="space-y-3">
                                    {names.map((n, index) => (
                                        <div key={index} className="flex items-center gap-2">
                                            <Input
                                                value={n}
                                                onChange={(e) => handleNameChange(index, e.target.value)}
                                                placeholder={`Nombre del usuario #${index + 1}`}
                                                className="flex-1"
                                                autoFocus={index === names.length - 1 && index > 0}
                                            />
                                            {!currentContact && names.length > 1 && (
                                                <Button variant="ghost" size="icon" onClick={() => handleRemoveName(index)} className="text-muted-foreground hover:text-red-500">
                                                    <XCircle className="w-5 h-5" />
                                                </Button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                {!currentContact && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={handleAddName}
                                        className="w-full border-dashed border-zinc-300 dark:border-zinc-700 text-muted-foreground hover:text-foreground hover:bg-zinc-50 dark:hover:bg-zinc-900"
                                    >
                                        <Plus className="w-4 h-4 mr-2" />
                                        Agregar otro usuario
                                    </Button>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label>Cliente Asociado</Label>
                                <SearchableSelect
                                    options={[
                                        { label: "-- Ninguno --", value: "no_client" },
                                        ...clients.map(c => ({ label: c.name, value: c.id }))
                                    ]}
                                    value={clientId}
                                    onChange={setClientId}
                                    placeholder="Seleccionar cliente..."
                                />
                            </div>
                            <div className="flex items-center justify-between border rounded-lg p-3 bg-muted/20">
                                <div className="space-y-0.5">
                                    <Label>Estatus Activo</Label>
                                    <p className="text-xs text-muted-foreground">Desactivar para ocultar en listas.</p>
                                </div>
                                <Switch checked={isActive} onCheckedChange={setIsActive} />
                            </div>
                        </div>
                    </div>
                    <div className="p-6 pt-2">
                        <DialogFooter className="sm:justify-end gap-2">
                            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                            <Button onClick={handleSave} disabled={isLoading} className="bg-blue-600 hover:bg-blue-700 text-white">
                                {isLoading ? "Guardando..." : "Guardar"}
                            </Button>
                        </DialogFooter>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
