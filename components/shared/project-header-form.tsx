"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, ChevronDown, Check as CheckIcon, X, Building2, User, Loader2 } from "lucide-react";
import { DateSelector } from "@/components/ui/date-selector";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

interface Project {
    id: string;
    code: string | null;
    name: string | null;
    company: string | null;
    company_id?: string | null;
    requestor: string | null;
    requestor_id?: string | null;
    start_date: string | null;
    delivery_date: string | null;
    status: string | null;
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
    contacts?: { id: string; name: string; client_id?: string | null }[];
    /**
     * Optional configuration for area-specific visibility and editing
     */
    allowEdit?: boolean;
    hiddenFields?: string[];
    readOnlyFields?: string[];
}

export function ProjectHeaderForm({
    project,
    isEditing,
    isSaving,
    onToggleEdit,
    onSave,
    onClose,
    clients = [],
    contacts = [],
    allowEdit = true,
    hiddenFields = [],
    readOnlyFields = [],
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
        (editStartDate ? format(editStartDate, "yyyy-MM-dd") : "") !== (project.start_date || "") ||
        (editDeliveryDate ? format(editDeliveryDate, "yyyy-MM-dd") : "") !== (project.delivery_date || "");

    const handleSave = () => {
        onSave({
            name: editName,
            start_date: editStartDate ? format(editStartDate, "yyyy-MM-dd") : (project.start_date ?? ""),
            delivery_date: editDeliveryDate ? format(editDeliveryDate, "yyyy-MM-dd") : (project.delivery_date ?? ""),
            company: editCompany,
            company_id: editCompanyId,
            requestor: editRequestor,
            requestor_id: editRequestorId,
        });
    };

    const filteredContacts = editCompanyId ? contacts.filter((c) => c.client_id === editCompanyId) : contacts;

    return (
        <div className="mt-2 flex flex-col border-b border-border px-6 pb-6">
            {/* Top row with Badge and Edit Button */}
            <div className="mb-5 flex w-full items-center justify-between">
                <Badge
                    variant="secondary"
                    className="rounded-xl border-none bg-red-50 px-3.5 py-1 font-mono text-sm font-bold tracking-widest text-red-600 shadow-none hover:bg-red-100"
                >
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
                                className="h-8 rounded-lg border-slate-200 bg-white text-[11px] font-bold uppercase tracking-wider text-slate-500 hover:bg-slate-50 dark:bg-slate-900"
                            >
                                Cancelar
                            </Button>
                            <Button
                                size="sm"
                                onClick={handleSave}
                                disabled={
                                    isSaving ||
                                    !editName ||
                                    !editStartDate ||
                                    !editDeliveryDate ||
                                    (!editCompanyId && !editCompany) ||
                                    (!editRequestorId && !editRequestor) ||
                                    !hasChanges
                                }
                                className="h-8 rounded-lg bg-brand text-[11px] font-bold uppercase tracking-wider text-white shadow-sm hover:bg-brand-hover"
                            >
                                {isSaving ? (
                                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                ) : (
                                    <Check className="mr-1.5 h-3.5 w-3.5" />
                                )}
                                {isSaving ? "Guardando..." : "Guardar"}
                            </Button>
                        </>
                    ) : (
                        allowEdit && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onToggleEdit(true)}
                                className="h-8 rounded-lg border-red-100 bg-white text-[10px] font-bold uppercase tracking-widest text-red-600 transition-all hover:bg-red-50 dark:bg-slate-950"
                            >
                                EDITAR
                            </Button>
                        )
                    )}

                    {onClose && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onClose}
                            className="ml-1 h-8 w-8 text-slate-500 hover:text-slate-900"
                        >
                            <X className="h-5 w-5" />
                        </Button>
                    )}
                </div>
            </div>

            {/* Project Details Area */}
            <div
                className={cn(
                    "flex flex-col gap-4",
                    isEditing &&
                        "mt-2 rounded-2xl border border-slate-200/60 bg-slate-50/50 p-5 dark:border-slate-800/60 dark:bg-slate-900/40"
                )}
            >
                {isEditing ? (
                    <div className="space-y-1.5 duration-300 animate-in fade-in slide-in-from-top-2">
                        <label className="ml-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Nombre del Proyecto
                        </label>
                        <Input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            readOnly={readOnlyFields.includes("name")}
                            maxLength={100}
                            className="h-11 truncate rounded-xl border-slate-200 bg-white text-lg font-bold uppercase shadow-sm focus:ring-brand dark:border-slate-800 dark:bg-slate-950"
                            placeholder="Nombre del Proyecto"
                        />
                    </div>
                ) : (
                    <h1 className="mt-1 text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white">
                        {project.name}
                    </h1>
                )}

                <div className={cn("flex flex-col gap-3.5", !isEditing && "mt-1")}>
                    {/* Empresa */}
                    {!hiddenFields.includes("company") && (
                        <div className="flex flex-col gap-1.5 text-slate-500 dark:text-slate-400">
                            {isEditing && (
                                <label className="ml-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                    Empresa / Cliente
                                </label>
                            )}
                            <div className="flex items-center gap-3">
                                <Building2
                                    className={cn(
                                        "h-5 w-5 shrink-0 opacity-70",
                                        isEditing && "h-4 w-4 text-brand opacity-100"
                                    )}
                                />
                                {isEditing && !readOnlyFields.includes("company") ? (
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                role="combobox"
                                                className={cn(
                                                    "h-10 w-full justify-between rounded-xl border-slate-200 bg-white px-3 text-[12px] font-bold uppercase tracking-wide dark:border-slate-800 dark:bg-slate-950",
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
                                                                        client.id === editCompanyId
                                                                            ? "opacity-100"
                                                                            : "opacity-0"
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
                                    <span className="text-[15px] font-medium uppercase tracking-wide">
                                        {project.company}
                                    </span>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Solicita (Contacto) */}
                    {!hiddenFields.includes("requestor") && (
                        <div className="flex flex-col gap-1.5 text-slate-500 dark:text-slate-400">
                            {isEditing && (
                                <label className="ml-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                    Contacto Solicitante
                                </label>
                            )}
                            <div className="flex items-center gap-3">
                                <User
                                    className={cn(
                                        "h-5 w-5 shrink-0 opacity-70",
                                        isEditing && "h-4 w-4 text-brand opacity-100"
                                    )}
                                />
                                {isEditing && !readOnlyFields.includes("requestor") ? (
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                role="combobox"
                                                disabled={!editCompanyId}
                                                className={cn(
                                                    "h-10 w-full justify-between rounded-xl border-slate-200 bg-white px-3 text-[12px] font-bold uppercase tracking-wide dark:border-slate-800 dark:bg-slate-950",
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
                                                                        contact.id === editRequestorId
                                                                            ? "opacity-100"
                                                                            : "opacity-0"
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
                                    <span className="text-[15px] font-medium uppercase tracking-wide">
                                        {project.requestor}
                                    </span>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Dates (Only visible in edit mode here, since display is on Tiempos block) */}
                    {isEditing && (
                        <div className="mt-2 flex flex-col gap-4 border-t border-slate-200/60 pt-4 dark:border-slate-800/60 sm:flex-row">
                            {/* Fecha Inicio - Often hidden or readonly for non-sales */}
                            {!hiddenFields.includes("start_date") && (
                                <div className="flex-1">
                                    <DateSelector
                                        label="Fecha Inicio"
                                        labelClassName="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1"
                                        date={editStartDate}
                                        onSelect={setEditStartDate}
                                        disabled={readOnlyFields.includes("start_date")}
                                        buttonClassName="font-bold capitalize bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 h-10 px-3 text-[12px] rounded-xl"
                                    />
                                </div>
                            )}

                            {!hiddenFields.includes("delivery_date") && (
                                <div className="flex-1">
                                    <DateSelector
                                        label="Fecha Entrega"
                                        labelClassName="text-[10px] font-bold uppercase tracking-widest text-brand/60 ml-1"
                                        date={editDeliveryDate}
                                        onSelect={setEditDeliveryDate}
                                        disabled={readOnlyFields.includes("delivery_date")}
                                        buttonClassName="font-bold capitalize bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 h-10 px-3 text-[12px] text-brand rounded-xl"
                                    />
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
