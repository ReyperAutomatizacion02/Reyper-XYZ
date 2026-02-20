"use client";

import { useEffect, useState } from "react";
import { X, Calendar, User2, Building2, Package, Image as ImageIcon, Loader2, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { getProjectDetails, updateProject } from "@/app/dashboard/ventas/actions";
import { parseLocalDate } from "@/lib/date-utils";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarUI } from "@/components/ui/calendar";
import { Check, CalendarIcon, Search, ChevronDown } from "lucide-react";
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

interface ProjectItem {
    id: string;
    part_code: string;
    part_name: string;
    quantity: number;
    status: string;
    image?: string;
    material: string;
}

interface ProjectDetailsPanelProps {
    project: Project | null;
    isOpen: boolean;
    onClose: () => void;
    onProjectUpdated?: () => void;
    clients?: { id: string; name: string; prefix?: string | null }[];
    contacts?: { id: string; name: string; client_id?: string }[];
}

export function ProjectDetailsPanel({
    project,
    isOpen,
    onClose,
    onProjectUpdated,
    clients = [],
    contacts = []
}: ProjectDetailsPanelProps) {
    const [items, setItems] = useState<ProjectItem[]>([]);
    const [selectedItem, setSelectedItem] = useState<ProjectItem | null>(null);
    const [loading, setLoading] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Form state
    const [editName, setEditName] = useState("");
    const [editStartDate, setEditStartDate] = useState<Date | undefined>(undefined);
    const [editDeliveryDate, setEditDeliveryDate] = useState<Date | undefined>(undefined);
    const [editCompany, setEditCompany] = useState("");
    const [editCompanyId, setEditCompanyId] = useState("");
    const [editRequestor, setEditRequestor] = useState("");
    const [editRequestorId, setEditRequestorId] = useState("");

    useEffect(() => {
        if (project && isOpen) {
            loadItems(project.id);
            setEditName(project.name || "");
            setEditStartDate(parseLocalDate(project.start_date));
            setEditDeliveryDate(parseLocalDate(project.delivery_date));
            setEditCompany(project.company || "");
            setEditCompanyId(project.company_id || "");
            setEditRequestor(project.requestor || "");
            setEditRequestorId(project.requestor_id || "");
        } else {
            setItems([]);
            setSelectedItem(null);
            setIsEditing(false);
        }
    }, [project, isOpen]);

    const handleSave = async () => {
        if (!project) return;
        setIsSaving(true);
        try {
            await updateProject(project.id, {
                name: editName,
                start_date: editStartDate ? format(editStartDate, "yyyy-MM-dd") : undefined,
                delivery_date: editDeliveryDate ? format(editDeliveryDate, "yyyy-MM-dd") : undefined,
                company: editCompany,
                company_id: editCompanyId,
                requestor: editRequestor,
                requestor_id: editRequestorId
            });
            toast.success("Proyecto actualizado correctamente");
            setIsEditing(false);
            if (onProjectUpdated) onProjectUpdated();
        } catch (error: any) {
            toast.error("Error al actualizar proyecto: " + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const loadItems = async (id: string) => {
        setLoading(true);
        try {
            const data = await getProjectDetails(id);
            setItems(data as any);
        } catch (error: any) {
            toast.error("Error al cargar partidas: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    if (!project) return null;

    // Calculate progress (same logic as card)
    const startDate = parseLocalDate(project.start_date)?.getTime() || 0;
    const endDate = parseLocalDate(project.delivery_date)?.getTime() || 0;
    const today = new Date().setHours(0, 0, 0, 0);
    const totalDuration = endDate - startDate;
    const elapsed = today - startDate;
    const progress = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Panel */}
                    <motion.div
                        initial={{ x: "100%" }}
                        animate={{ x: 0 }}
                        exit={{ x: "100%" }}
                        transition={{ type: "spring", damping: 25, stiffness: 200 }}
                        className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-background border-l border-border shadow-2xl z-20 flex flex-col pt-16 overflow-hidden"
                        id="project-details-panel"
                    >
                        <AnimatePresence mode="wait">
                            {!selectedItem ? (
                                <motion.div
                                    key="list"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="flex flex-col h-full"
                                >
                                    {/* Header */}
                                    <div className="p-6 border-b border-border bg-muted/10 flex-shrink-0" id="project-details-header">
                                        <div className="flex items-start justify-between mb-4">
                                            <Badge variant="outline" className="bg-red-500/5 text-red-600 dark:text-red-400 border-none shadow-none px-2 py-0.5 h-auto font-mono font-bold tracking-wider">
                                                {project.code}
                                            </Badge>
                                            <div className="flex items-center gap-2">
                                                {isEditing ? (
                                                    <div className="flex items-center gap-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => setIsEditing(false)}
                                                            className="h-8 text-[10px] font-bold uppercase hover:bg-muted"
                                                            disabled={isSaving}
                                                        >
                                                            Cancelar
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={handleSave}
                                                            className="h-8 text-[10px] font-bold uppercase border-green-500/50 text-green-600 hover:bg-green-500/10"
                                                            disabled={isSaving}
                                                        >
                                                            {isSaving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                                                            Guardar
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => setIsEditing(true)}
                                                        className="h-8 text-[10px] font-bold uppercase border-orange-500/50 text-orange-600 hover:bg-orange-500/10"
                                                    >
                                                        Editar
                                                    </Button>
                                                )}
                                                <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-full hover:bg-muted">
                                                    <X className="w-5 h-5" />
                                                </Button>
                                            </div>
                                        </div>
                                        {isEditing ? (
                                            <div className="space-y-3 mb-4">
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Nombre del Proyecto</label>
                                                    <Input
                                                        value={editName}
                                                        onChange={(e) => setEditName(e.target.value)}
                                                        className="bg-background/50 border-border font-bold text-sm"
                                                    />
                                                </div>
                                            </div>
                                        ) : (
                                            <h2 className="text-2xl font-bold leading-tight mb-2">{project.name}</h2>
                                        )}
                                        <div className="flex flex-col gap-2 text-sm text-muted-foreground mt-2">
                                            <div className="flex items-center min-h-[2rem]">
                                                <Building2 className="w-4 h-4 mr-2" />
                                                {isEditing ? (
                                                    <SearchableCombobox
                                                        value={editCompanyId}
                                                        onValueChange={(val) => {
                                                            setEditCompanyId(val);
                                                            const client = clients.find(c => c.id === val);
                                                            if (client) setEditCompany(client.name);
                                                        }}
                                                        options={clients.map(c => ({ label: c.name, value: c.id }))}
                                                        placeholder="Seleccionar Cliente"
                                                    />
                                                ) : (
                                                    <span>{project.company}</span>
                                                )}
                                            </div>
                                            <div className="flex items-center min-h-[2rem]">
                                                <User2 className="w-4 h-4 mr-2" />
                                                {isEditing ? (
                                                    <SearchableCombobox
                                                        value={editRequestorId}
                                                        onValueChange={(val) => {
                                                            setEditRequestorId(val);
                                                            const contact = contacts.find(c => c.id === val);
                                                            if (contact) setEditRequestor(contact.name);
                                                        }}
                                                        options={contacts
                                                            .filter(c => editCompanyId ? c.client_id === editCompanyId : true)
                                                            .map(c => ({ label: c.name, value: c.id }))
                                                        }
                                                        placeholder="Seleccionar Usuario"
                                                    />
                                                ) : (
                                                    <span>{project.requestor}</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Scrollable Content */}
                                    <div className="flex-1 overflow-y-auto p-6 space-y-8">
                                        {/* Dates & Progress */}
                                        <section className="space-y-4" id="project-details-dates">
                                            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center">
                                                <Calendar className="w-4 h-4 mr-2" /> Tiempos
                                            </h3>
                                            <div className="bg-muted/30 p-4 rounded-xl border border-border/50 space-y-4">
                                                <div className="flex justify-between items-center text-sm">
                                                    <div className="flex-1">
                                                        <p className="text-xs text-muted-foreground mb-1 font-bold uppercase">Inicio</p>
                                                        {isEditing ? (
                                                            <DateSelector
                                                                date={editStartDate}
                                                                onSelect={setEditStartDate}
                                                                label=""
                                                                align="start"
                                                            />
                                                        ) : (
                                                            <p className="font-semibold">{parseLocalDate(project.start_date)?.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                                                        )}
                                                    </div>
                                                    <div className="w-4" />
                                                    <div className="flex-1 text-right">
                                                        <p className="text-xs text-muted-foreground mb-1 font-bold uppercase text-right">Entrega</p>
                                                        {isEditing ? (
                                                            <DateSelector
                                                                date={editDeliveryDate}
                                                                onSelect={setEditDeliveryDate}
                                                                label=""
                                                                align="end"
                                                            />
                                                        ) : (
                                                            <p className="font-semibold text-red-600 dark:text-red-400">{parseLocalDate(project.delivery_date)?.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                                                        )}
                                                    </div>
                                                </div>
                                                {!isEditing && (
                                                    <div className="space-y-1">
                                                        <div className="flex justify-between text-xs font-medium">
                                                            <span>Progreso de tiempo</span>
                                                            <span>{Math.round(progress)}%</span>
                                                        </div>
                                                        <Progress value={progress} className="h-2" />
                                                    </div>
                                                )}
                                            </div>
                                        </section>

                                        {/* Production Orders / Items */}
                                        <section className="space-y-4" id="project-details-items">
                                            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                                                <span className="flex items-center"><Package className="w-4 h-4 mr-2" /> Partidas ({items.length})</span>
                                                {loading && <Loader2 className="w-3 h-3 animate-spin" />}
                                            </h3>

                                            {loading && items.length === 0 ? (
                                                <div className="space-y-3">
                                                    {[1, 2, 3].map(i => (
                                                        <div key={i} className="h-20 bg-muted/50 rounded-lg animate-pulse" />
                                                    ))}
                                                </div>
                                            ) : items.length === 0 ? (
                                                <div className="text-center py-8 text-muted-foreground text-sm italic">
                                                    No hay partidas registradas para este proyecto.
                                                </div>
                                            ) : (
                                                <div className="space-y-3">
                                                    {items.map(item => (
                                                        <div key={item.id} className="p-4 rounded-xl border border-border/50 bg-card/50 hover:border-primary/30 transition-all hover:shadow-lg group flex flex-col gap-4">
                                                            {/* Card Header: Code (Clickable, No Border) & Status */}
                                                            <div className="flex items-center justify-between gap-3 border-b border-border/40 pb-2 mb-1">
                                                                <span
                                                                    onClick={() => setSelectedItem(item)}
                                                                    className="text-[11px] font-mono font-bold text-red-500 dark:text-red-400 leading-none whitespace-nowrap cursor-pointer hover:underline transition-all"
                                                                >
                                                                    {item.part_code}
                                                                </span>
                                                                <Badge variant="secondary" className="text-[9px] px-2 py-0.5 h-auto bg-muted/80 text-muted-foreground border-border/50 font-normal tracking-wide">
                                                                    {item.status}
                                                                </Badge>
                                                            </div>

                                                            {/* Card Body: Image & Main Info */}
                                                            <div className="flex gap-5 items-start">
                                                                {/* Image Column (16:9) */}
                                                                <div className="w-32 aspect-video rounded-lg bg-white dark:bg-muted/10 flex items-center justify-center overflow-hidden relative border border-border shadow-sm shrink-0">
                                                                    {item.image ? (
                                                                        <Image
                                                                            src={item.image}
                                                                            alt={item.part_name}
                                                                            fill
                                                                            className="object-cover transition-transform duration-500 group-hover:scale-110"
                                                                            sizes="150px"
                                                                        />
                                                                    ) : (
                                                                        <ImageIcon className="w-6 h-6 text-muted-foreground/30" />
                                                                    )}
                                                                </div>

                                                                {/* Main Info Column: Name -> Material -> Pieces */}
                                                                <div className="flex-1 flex flex-col gap-3 min-w-0">
                                                                    <h4 className="text-sm font-bold text-foreground uppercase tracking-tight break-words">
                                                                        {item.part_name}
                                                                    </h4>

                                                                    <div className="flex flex-col gap-1 border-l-2 border-primary/20 pl-3 py-0.5">
                                                                        <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider truncate">
                                                                            {item.material}
                                                                        </span>
                                                                        <span className="text-[11px] font-bold text-foreground">
                                                                            {item.quantity} pza{item.quantity !== 1 ? 's' : ''}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </section>
                                    </div>
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="detail"
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                    className="flex flex-col h-full bg-card/30"
                                >
                                    {/* Detail Header */}
                                    <div className="p-6 border-b border-border bg-muted/30 flex-shrink-0">
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => setSelectedItem(null)}
                                                    className="h-8 w-8 rounded-full text-primary hover:text-primary/80 hover:bg-primary/10 transition-all -ml-2"
                                                >
                                                    <ChevronLeft className="w-5 h-5" />
                                                </Button>
                                                <span className="text-[13px] font-mono font-bold text-red-500 dark:text-red-400">
                                                    {selectedItem.part_code}
                                                </span>
                                            </div>
                                            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-full hover:bg-muted">
                                                <X className="w-5 h-5" />
                                            </Button>
                                        </div>
                                        <h2 className="text-xl font-bold leading-tight">{selectedItem.part_name}</h2>
                                    </div>

                                    {/* Detail Content */}
                                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                        <div className="aspect-video w-full rounded-xl bg-white dark:bg-muted/10 flex items-center justify-center relative overflow-hidden border border-border shadow-inner">
                                            {selectedItem.image ? (
                                                <Image
                                                    src={selectedItem.image}
                                                    alt={selectedItem.part_name}
                                                    fill
                                                    className="object-contain p-4"
                                                    sizes="400px"
                                                />
                                            ) : (
                                                <div className="flex flex-col items-center gap-2 text-muted-foreground/30">
                                                    <ImageIcon className="w-12 h-12" />
                                                    <span className="text-xs">Sin imagen disponible</span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="bg-muted/20 p-3 rounded-lg border border-border/50">
                                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Cantidad</p>
                                                <p className="text-sm font-bold">{selectedItem.quantity} piezas</p>
                                            </div>
                                            <div className="bg-muted/20 p-3 rounded-lg border border-border/50">
                                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Estatus</p>
                                                <Badge variant="secondary" className="text-[11px] h-auto py-0.5">
                                                    {selectedItem.status}
                                                </Badge>
                                            </div>
                                        </div>

                                        <div className="bg-muted/20 p-3 rounded-lg border border-border/50">
                                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Material</p>
                                            <p className="text-sm font-semibold">{selectedItem.material}</p>
                                        </div>

                                        <div className="pt-4 border-t border-border">
                                            <p className="text-xs text-muted-foreground italic text-center">
                                                En próximas versiones podrás ver planeación detallada por pieza aquí.
                                            </p>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

function DateSelector({
    date,
    onSelect,
    label,
    align = "start"
}: {
    date: Date | undefined;
    onSelect: (d: Date | undefined) => void;
    label: string;
    align?: "start" | "end";
}) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="space-y-1 relative">
            {label && <label className="text-muted-foreground font-medium text-[10px] uppercase tracking-wider ml-1">{label}</label>}
            <Popover open={isOpen} onOpenChange={setIsOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant={"outline"}
                        className={cn(
                            "h-8 w-full justify-start text-left font-normal bg-background/50 hover:bg-card border-border transition-all duration-200 text-xs px-2",
                            !date && "text-muted-foreground"
                        )}
                    >
                        <CalendarIcon className="mr-2 h-3 w-3 text-red-500" />
                        {date ? format(date, "dd MMM yyyy", { locale: es }) : <span>Seleccionar</span>}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 border rounded-xl shadow-xl overflow-hidden" align={align}>
                    <CalendarUI
                        mode="single"
                        selected={date}
                        onSelect={(d) => {
                            onSelect(d);
                            setIsOpen(false);
                        }}
                        initialFocus
                    />
                </PopoverContent>
            </Popover>
        </div>
    );
}

function SearchableCombobox({
    value,
    onValueChange,
    options,
    placeholder
}: {
    value: string | undefined;
    onValueChange: (val: string) => void;
    options: { label: string; value: string }[];
    placeholder: string;
}) {
    const [open, setOpen] = useState(false);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="h-8 w-full justify-between bg-background/50 border-border text-xs font-normal hover:bg-muted/50 transition-all duration-200"
                >
                    <span className="truncate">
                        {value
                            ? options.find((opt) => opt.value === value)?.label
                            : placeholder}
                    </span>
                    <ChevronDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0" align="start" sideOffset={8}>
                <Command>
                    <CommandInput placeholder={`Buscar ${placeholder.toLowerCase()}...`} className="h-9" />
                    <CommandList className="max-h-[250px] custom-scrollbar">
                        <CommandEmpty>No se encontraron resultados.</CommandEmpty>
                        <CommandGroup>
                            {options.map((option) => (
                                <CommandItem
                                    key={option.value}
                                    value={option.label}
                                    onSelect={() => {
                                        onValueChange(option.value);
                                        setOpen(false);
                                    }}
                                    className="flex items-center justify-between py-2 cursor-pointer"
                                >
                                    <span className="truncate text-xs">{option.label}</span>
                                    <Check
                                        className={cn(
                                            "h-3 w-3 text-primary",
                                            value === option.value ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
