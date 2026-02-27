// components/sales/project-header-form.tsx
"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Check, CalendarIcon, ChevronDown, Check as CheckIcon, X, Building2, User, Loader2 } from "lucide-react";
import { Calendar as CalendarUI } from "@/components/ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

interface Project {
    id: string;
    code: string;
    name: string;
    company: string;
    company_id?: string;
    requestor: string;
    requestor_id?: string;
    start_date: string;
    delivery_date: string;
    status: string;
}

interface ProjectHeaderFormProps {
    project: Project;
    isEditing: boolean;
    isSaving: boolean;
    onToggleEdit: (val: boolean) => void;
    onSave: (data: {
        name: string;
        start_date: string;
        delivery_date: string;
        company: string;
        company_id: string;
        requestor: string;
        requestor_id: string;
    }) => void;
    onClose?: () => void;
    clients?: { id: string; name: string }[];
    contacts?: { id: string; name: string; client_id?: string }[];
}

export function ProjectHeaderForm({
    project,
    isEditing,
    isSaving,
    onToggleEdit,
    onSave,
    onClose,
    clients = [],
    contacts = []
}: ProjectHeaderFormProps) {
    const [editName, setEditName] = useState(project.name || "");
    const [editStartDate, setEditStartDate] = useState<Date | undefined>(
        project.start_date ? new Date(project.start_date + "T00:00:00") : undefined
    );
    const [editDeliveryDate, setEditDeliveryDate] = useState<Date | undefined>(
        project.delivery_date ? new Date(project.delivery_date + "T00:00:00") : undefined
    );
    const [editCompany, setEditCompany] = useState(project.company || "");
    const [editCompanyId, setEditCompanyId] = useState(project.company_id || "");
    const [editRequestor, setEditRequestor] = useState(project.requestor || "");
    const [editRequestorId, setEditRequestorId] = useState(project.requestor_id || "");

    useEffect(() => {
        if (isEditing) {
            setEditName(project.name || "");
            setEditStartDate(project.start_date ? new Date(project.start_date + "T00:00:00") : undefined);
            setEditDeliveryDate(project.delivery_date ? new Date(project.delivery_date + "T00:00:00") : undefined);
            setEditCompany(project.company || "");
            setEditCompanyId(project.company_id || "");
            setEditRequestor(project.requestor || "");
            setEditRequestorId(project.requestor_id || "");
        }
    }, [isEditing, project]);

    const hasChanges =
        editName !== (project.name || "") ||
        editCompany !== (project.company || "") ||
        editCompanyId !== (project.company_id || "") ||
        editRequestor !== (project.requestor || "") ||
        editRequestorId !== (project.requestor_id || "") ||
        (editStartDate ? format(editStartDate, 'yyyy-MM-dd') : "") !== (project.start_date || "") ||
        (editDeliveryDate ? format(editDeliveryDate, 'yyyy-MM-dd') : "") !== (project.delivery_date || "");

    const getStatusColor = (status: string) => {
        switch (status?.toLowerCase()) {
            case 'completed': return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
            case 'active': return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
            case 'on_hold': return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
            case 'cancelled': return 'bg-red-500/10 text-red-500 border-red-500/20';
            default: return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
        }
    };

    const getStatusText = (status: string) => {
        switch (status?.toLowerCase()) {
            case 'completed': return 'Completado';
            case 'active': return 'Activo';
            case 'on_hold': return 'En Pausa';
            case 'cancelled': return 'Cancelado';
            default: return status;
        }
    };

    const handleSave = () => {
        onSave({
            name: editName,
            start_date: editStartDate ? format(editStartDate, 'yyyy-MM-dd') : project.start_date,
            delivery_date: editDeliveryDate ? format(editDeliveryDate, 'yyyy-MM-dd') : project.delivery_date,
            company: editCompany,
            company_id: editCompanyId,
            requestor: editRequestor,
            requestor_id: editRequestorId
        });
    };

    const filteredContacts = editCompanyId
        ? contacts.filter(c => c.client_id === editCompanyId)
        : contacts;

    return (
        <div className="flex flex-col pb-6 px-6 mt-2 border-b border-border">
            {/* Top row with Badge and Edit Button */}
            <div className="flex items-center justify-between w-full mb-5">
                <Badge variant="secondary" className="bg-red-50 text-red-600 hover:bg-red-100 border-none px-3.5 py-1 font-mono text-sm font-bold tracking-widest shadow-none rounded-xl">
                    {project.code}
                </Badge>

                <div className="flex items-center gap-2">
                    {isEditing ? (
                        <>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onToggleEdit(false)}
                                disabled={isSaving}
                                className="h-8 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-slate-200 hover:bg-slate-50 bg-white dark:bg-slate-900 rounded-lg"
                            >
                                Cancelar
                            </Button>
                            <Button
                                size="sm"
                                onClick={handleSave}
                                disabled={isSaving || !editName || !editStartDate || !editDeliveryDate || (!editCompanyId && !editCompany) || (!editRequestorId && !editRequestor) || !hasChanges}
                                className="h-8 text-[11px] font-bold uppercase tracking-wider bg-[#EC1C21] hover:bg-[#D1181C] text-white rounded-lg shadow-sm"
                            >
                                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Check className="w-3.5 h-3.5 mr-1.5" />}
                                {isSaving ? "Guardando..." : "Guardar"}
                            </Button>
                        </>
                    ) : (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onToggleEdit(true)}
                            className="h-8 text-[10px] font-bold uppercase tracking-widest text-red-600 border-red-100 hover:bg-red-50 bg-white dark:bg-slate-950 rounded-lg transition-all"
                        >
                            EDITAR
                        </Button>
                    )}

                    {onClose && (
                        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 text-slate-500 hover:text-slate-900 ml-1">
                            <X className="w-5 h-5" />
                        </Button>
                    )}
                </div>
            </div>

            {/* Project Details Area */}
            <div className={cn("flex flex-col gap-4", isEditing && "bg-slate-50/50 dark:bg-slate-900/40 p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 mt-2")}>
                {isEditing ? (
                    <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">Nombre del Proyecto</label>
                        <Input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="text-lg font-bold uppercase h-11 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 focus:ring-[#EC1C21] rounded-xl shadow-sm"
                            placeholder="Nombre del Proyecto"
                        />
                    </div>
                ) : (
                    <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white uppercase mt-1">
                        {project.name}
                    </h1>
                )}

                <div className={cn("flex flex-col gap-3.5", !isEditing && "mt-1")}>
                    {/* Empresa */}
                    <div className="flex flex-col gap-1.5 text-slate-500 dark:text-slate-400">
                        {isEditing && <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">Empresa / Cliente</label>}
                        <div className="flex items-center gap-3">
                            <Building2 className={cn("w-5 h-5 shrink-0 opacity-70", isEditing && "w-4 h-4 text-[#EC1C21] opacity-100")} />
                            {isEditing ? (
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            className={cn(
                                                "w-full justify-between bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 h-10 px-3 font-bold uppercase tracking-wide text-[12px] rounded-xl",
                                                !editCompanyId && "text-muted-foreground"
                                            )}
                                        >
                                            <span className="truncate">
                                                {editCompanyId
                                                    ? clients.find((client) => client.id === editCompanyId)?.name
                                                    : "Seleccionar empresa..."}
                                            </span>
                                            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[300px] p-0" align="start">
                                        <Command>
                                            <CommandInput placeholder="Buscar empresa..." />
                                            <CommandList>
                                                <CommandEmpty>No se encontró empresa.</CommandEmpty>
                                                <CommandGroup>
                                                    {clients.map((client) => (
                                                        <CommandItem
                                                            key={client.id}
                                                            value={client.name}
                                                            onSelect={() => {
                                                                setEditCompanyId(client.id);
                                                                setEditCompany(client.name);
                                                                setEditRequestorId("");
                                                                setEditRequestor("");
                                                            }}
                                                        >
                                                            <CheckIcon
                                                                className={cn(
                                                                    "mr-2 h-4 w-4",
                                                                    client.id === editCompanyId ? "opacity-100" : "opacity-0"
                                                                )}
                                                            />
                                                            {client.name}
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            ) : (
                                <span className="text-[15px] font-medium uppercase tracking-wide">{project.company}</span>
                            )}
                        </div>
                    </div>

                    {/* Solicita (Contacto) */}
                    <div className="flex flex-col gap-1.5 text-slate-500 dark:text-slate-400">
                        {isEditing && <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">Contacto Solicitante</label>}
                        <div className="flex items-center gap-3">
                            <User className={cn("w-5 h-5 shrink-0 opacity-70", isEditing && "w-4 h-4 text-[#EC1C21] opacity-100")} />
                            {isEditing ? (
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            disabled={!editCompanyId}
                                            className={cn(
                                                "w-full justify-between bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 h-10 px-3 font-bold uppercase tracking-wide text-[12px] rounded-xl",
                                                !editRequestorId && "text-muted-foreground"
                                            )}
                                        >
                                            <span className="truncate">
                                                {editRequestorId
                                                    ? contacts.find((c) => c.id === editRequestorId)?.name
                                                    : "Seleccionar contacto..."}
                                            </span>
                                            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[300px] p-0" align="start">
                                        <Command>
                                            <CommandInput placeholder="Buscar contacto..." />
                                            <CommandList>
                                                <CommandEmpty>No se encontró contacto.</CommandEmpty>
                                                <CommandGroup>
                                                    {filteredContacts.map((contact) => (
                                                        <CommandItem
                                                            key={contact.id}
                                                            value={contact.name}
                                                            onSelect={() => {
                                                                setEditRequestorId(contact.id);
                                                                setEditRequestor(contact.name);
                                                            }}
                                                        >
                                                            <CheckIcon
                                                                className={cn(
                                                                    "mr-2 h-4 w-4",
                                                                    contact.id === editRequestorId ? "opacity-100" : "opacity-0"
                                                                )}
                                                            />
                                                            {contact.name}
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            ) : (
                                <span className="text-[15px] font-medium uppercase tracking-wide">{project.requestor}</span>
                            )}
                        </div>
                    </div>

                    {/* Dates (Only visible in edit mode here, since display is on Tiempos block) */}
                    {isEditing && (
                        <div className="flex flex-col sm:flex-row gap-4 mt-2 pt-4 border-t border-slate-200/60 dark:border-slate-800/60">
                            <div className="flex-1">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-1.5 ml-1">Fecha Inicio</label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant={"outline"}
                                            className={cn(
                                                "w-full justify-start text-left font-bold capitalize bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 h-10 px-3 text-[12px] rounded-xl",
                                                !editStartDate && "text-muted-foreground"
                                            )}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4 text-[#EC1C21]" />
                                            {editStartDate ? format(editStartDate, "dd MMM yyyy", { locale: es }) : <span>Seleccionar</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <CalendarUI
                                            mode="single"
                                            selected={editStartDate}
                                            onSelect={setEditStartDate}
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>

                            <div className="flex-1">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-[#EC1C21]/60 block mb-1.5 ml-1">Fecha Entrega</label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant={"outline"}
                                            className={cn(
                                                "w-full justify-start text-left font-bold capitalize bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 h-10 px-3 text-[12px] text-[#EC1C21] rounded-xl",
                                                !editDeliveryDate && "text-muted-foreground"
                                            )}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4 text-[#EC1C21]" />
                                            {editDeliveryDate ? format(editDeliveryDate, "dd MMM yyyy", { locale: es }) : <span>Seleccionar</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <CalendarUI
                                            mode="single"
                                            selected={editDeliveryDate}
                                            onSelect={setEditDeliveryDate}
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
