"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarIcon, Loader2, Save, FileText, RefreshCw, Plus, Trash2, X, ChevronDown, ImageIcon, ExternalLink, ZoomIn, ZoomOut, RotateCcw, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Dialog,
    DialogContent,
    DialogTrigger,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

import { getNextProjectCode, createProjectAndItems } from "@/app/dashboard/ventas/project-actions";
import { scanDriveFolder } from "@/app/dashboard/ventas/drive-actions";

interface ProjectFormProps {
    clients: { id: string; name: string; prefix?: string | null }[];
    contacts: { id: string; name: string }[];
    units: { id: string; name: string }[];
    materials: { id: string; name: string }[];
    initialDate: Date;
}

interface GeneratedItem {
    id: number;
    code: string;
    description: string;
    quantity: number;
    unit: string;
    designNo: string;
    material: string;
    url: string;
    thumbnail?: string;
    fileId?: string;
}

interface StagingFile {
    id: string; // fileId
    name: string;
    thumbnail?: string;
    url: string;
    mimeType?: string;
    selected: boolean;
}

// Animation Variants
const fadeIn = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3 } }
};

const slideUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } }
};

// Zoomable Image Logic - Moved to Top Level
// Zoomable Image Logic - Moved to Top Level
const ImagePreviewWithZoom = ({ src, fileId }: { src: string, fileId?: string }) => {
    // If we have a fileId, we use the Google Drive Embed Preview for maximum quality (Vectors)
    // If not, we fallback to the high-res thumbnail image with zoom controls.

    const [scale, setScale] = useState(1);
    const [imgError, setImgError] = useState(false);

    if (fileId) {
        return (
            <div className="w-full h-full bg-white rounded-lg overflow-hidden shadow-2xl relative">
                <iframe
                    src={`https://drive.google.com/file/d/${fileId}/preview`}
                    className="w-full h-full border-none"
                    allow="autoplay"
                    title="PDF Preview"
                ></iframe>
            </div>
        );
    }

    if (imgError) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4 text-center">
                <ImageIcon className="w-16 h-16 mb-4 opacity-50" />
                <p>No se pudo cargar la vista previa.</p>
                <p className="text-xs mt-2 opacity-70">Es posible que el archivo sea privado o no compatible.</p>
            </div>
        );
    }

    return (
        <>
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[10001] flex gap-2 bg-black/50 backdrop-blur-md p-1.5 rounded-full border border-white/10 shadow-xl scale-110">
                <Button
                    size="icon"
                    variant="ghost"
                    className="h-10 w-10 text-white hover:bg-white/20 rounded-full"
                    onClick={(e) => { e.stopPropagation(); setScale(Math.max(0.5, scale - 0.25)); }}
                >
                    <ZoomOut className="h-5 w-5" />
                </Button>
                <Button
                    size="icon"
                    variant="ghost"
                    className="h-10 w-10 text-white hover:bg-white/20 rounded-full"
                    onClick={(e) => { e.stopPropagation(); setScale(1); }}
                >
                    <RotateCcw className="h-5 w-5" />
                </Button>
                <Button
                    size="icon"
                    variant="ghost"
                    className="h-10 w-10 text-white hover:bg-white/20 rounded-full"
                    onClick={(e) => { e.stopPropagation(); setScale(Math.min(4, scale + 0.25)); }}
                >
                    <ZoomIn className="h-5 w-5" />
                </Button>
            </div>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="relative w-full h-full flex items-center justify-center p-8 overflow-hidden"
            >
                <motion.img
                    src={src}
                    alt="Plano Fullscreen"
                    referrerPolicy="no-referrer"
                    onError={() => setImgError(true)}
                    className="object-contain max-h-full max-w-full rounded-md shadow-2xl cursor-grab active:cursor-grabbing"
                    animate={{ scale: scale }}
                    drag={scale > 1}
                    dragConstraints={{ left: -1000, right: 1000, top: -1000, bottom: 1000 }}
                    draggable={false}
                />
            </motion.div>
        </>
    );
};

// Custom Date Selector Component - Manual Absolute Positioning to strictly obey User's layout preference
function DateSelector({
    date,
    onSelect,
    label
}: {
    date: Date | undefined;
    onSelect: (d: Date | undefined) => void;
    label: string
}) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Close on click outside logic could be added here if the backdrop isn't enough,
    // but the clear backdrop usually works well for simple cases.



    return (
        <div className="space-y-2 relative" ref={containerRef}>
            <Label className="text-muted-foreground font-medium text-xs uppercase tracking-wider">{label}</Label>
            <Button
                variant={"outline"}
                className={cn(
                    "w-full justify-start text-left font-normal bg-zinc-50/50 hover:bg-white border-zinc-200 shadow-sm transition-all duration-200",
                    !date && "text-muted-foreground"
                )}
                onClick={() => setIsOpen(!isOpen)}
            >
                <CalendarIcon className="mr-2 h-4 w-4 text-red-500" />
                {date ? format(date, "PPP", { locale: es }) : <span>Seleccionar</span>}
            </Button>

            {/* Manual Popover */}
            <AnimatePresence>
                {isOpen && (
                    <>
                        {/* Fixed Backdrop for click-outside closing */}
                        <div
                            className="fixed inset-0 z-[9998] bg-transparent"
                            onClick={() => setIsOpen(false)}
                        />

                        {/* Calendar Container - Strictly below the button with minimal margin */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: -10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: -10 }}
                            className="absolute top-full mt-1 left-0 z-[9999] bg-white dark:bg-zinc-900 border rounded-xl shadow-xl w-auto overflow-hidden ring-1 ring-black/5"
                        >
                            <Calendar
                                mode="single"
                                selected={date}
                                onSelect={(d) => {
                                    onSelect(d);
                                    setIsOpen(false);
                                }}
                                initialFocus
                            />
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}

export function ProjectForm({ clients, contacts, units, materials, initialDate }: ProjectFormProps) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    // Form State
    const [selectedClient, setSelectedClient] = useState("");
    const [clientCode, setClientCode] = useState("");
    const [selectedUser, setSelectedUser] = useState("");

    // Staging State (Drive Selection)
    const [stagingFiles, setStagingFiles] = useState<StagingFile[]>([]);
    const [isSelectingFiles, setIsSelectingFiles] = useState(false);

    const handleClientChange = (clientId: string) => {
        setSelectedClient(clientId);
        const client = clients.find(c => c.id === clientId);
        if (client && client.prefix) {
            setClientCode(client.prefix);
        } else {
            setClientCode("");
            toast.info("Este cliente no tiene prefijo registrado.");
        }
    };

    // Dates
    const [requestDate, setRequestDate] = useState<Date>(initialDate);
    const [deliveryDate, setDeliveryDate] = useState<Date | undefined>(undefined);

    // Project Details
    const [projectName, setProjectName] = useState("");
    const [driveFolderUrl, setDriveFolderUrl] = useState(""); // NEW

    // Note: We keep itemsToGenerate as a state for the INPUT field.
    const [itemsToGenerate, setItemsToGenerate] = useState(1);

    // Generated Data
    const [projectCode, setProjectCode] = useState<string | null>(null);
    const [generatedItems, setGeneratedItems] = useState<GeneratedItem[]>([]);
    const [showPreview, setShowPreview] = useState(false);

    // Effect to sync input with actual table size when preview is active
    useEffect(() => {
        if (showPreview) {
            setItemsToGenerate(generatedItems.length);
        }
    }, [generatedItems.length, showPreview]);


    const handleGeneratePreview = async () => {
        setLoading(true);
        // Reset staging state
        setStagingFiles([]);
        setIsSelectingFiles(false);
        setGeneratedItems([]);
        setShowPreview(false);

        try {
            // Determine project code logic
            let nextCode = projectCode;

            if (!nextCode && clientCode) {
                // Fetch real next code from server
                try {
                    const fetchedCode = await getNextProjectCode(clientCode);
                    if (fetchedCode) {
                        nextCode = fetchedCode;
                        setProjectCode(fetchedCode);
                    }
                } catch (e) {
                    console.error("Error fetching next code:", e);
                    // Fallback if fetch fails
                    const dateStr = format(requestDate, "yyMMdd");
                    nextCode = `${clientCode}-${dateStr}-XXXX`;
                }
            } else if (!nextCode) {
                const prefix = clientCode || "PRJ";
                const dateStr = format(requestDate, "yyMMdd");
                nextCode = `${prefix}-${dateStr}-XXXX`;
            }

            if (driveFolderUrl) {
                // --- DRIVE MODE -> STAGING ---
                const result = await scanDriveFolder(driveFolderUrl);

                if (!result.success) {
                    toast.error(result.error);
                } else if (result.items && result.items.length > 0) {

                    const staging: StagingFile[] = result.items.map(f => ({
                        id: f.fileId,
                        name: f.name,
                        url: f.link,
                        thumbnail: f.thumbnail,
                        selected: true, // Auto-select all by default
                        mimeType: f.mimeType || undefined
                    }));

                    setStagingFiles(staging);
                    setIsSelectingFiles(true);
                    toast.success(`Se encontraron ${result.items.length} archivos. Selecciona cuáles importar.`);

                } else {
                    toast.info("La carpeta está vacía o no se encontraron archivos.");
                }

            } else {
                // --- MANUAL MODE (No Drive Link) ---
                const newItems: GeneratedItem[] = [];
                for (let i = 1; i <= itemsToGenerate; i++) {
                    const suffix = i.toString().padStart(2, "0");
                    newItems.push({
                        id: i,
                        code: `${nextCode}-${suffix}.00`,
                        description: "", quantity: 1, unit: "PZA", designNo: "", material: "", url: ""
                    });
                }
                setGeneratedItems(newItems);
                setShowPreview(true);
                toast.success("Filas generadas manualmente.");
            }

        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    };







    const handleSave = async () => {
        if (!projectCode || generatedItems.length === 0) return;

        // Validation
        if (!deliveryDate) {
            toast.error("La fecha de entrega es obligatoria.");
            return;
        }

        setLoading(true);
        try {
            const success = await createProjectAndItems({
                code: projectCode,
                name: projectName,
                client_id: selectedClient,
                company_name: clients.find(c => c.id === selectedClient)?.name || "",
                requestor: contacts.find(c => c.id === selectedUser)?.name || "",
                start_date: format(requestDate, "yyyy-MM-dd"),
                delivery_date: format(deliveryDate, "yyyy-MM-dd"),
                status: "active"
            }, generatedItems.map(item => ({
                part_code: item.code,
                part_name: item.description,
                quantity: item.quantity,
                material: item.material,
                drawing_url: item.url,
                image: "",
                unit: item.unit,
                design_no: item.designNo,
            })));

            if (success) {
                toast.success("Proyecto creado exitosamente");
                router.push("/dashboard");
                router.refresh();
            }
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    const toggleStagingFile = (fileId: string) => {
        setStagingFiles(prev => prev.map(f => f.id === fileId ? { ...f, selected: !f.selected } : f));
    };

    const confirmImport = () => {
        const selectedFiles = stagingFiles.filter(f => f.selected);
        if (selectedFiles.length === 0) {
            toast.warning("Selecciona al menos un archivo para importar.");
            return;
        }

        const newItems: GeneratedItem[] = [];
        const nextCode = projectCode || `${clientCode}-${format(requestDate, "yyMMdd")}-XXXX`;

        // Use existing length to continue numbering if appending? For now, we assume fresh gen.
        // But if user scans twice, maybe we should append? 
        // For simplicity now: Replace or Append? Let's assume Append if we already have items?
        // Actually the Generate button usually resets. Let's keep reset behavior for now or Append?
        // User requested "Select -> Import". 
        // Let's Append to existing generatedItems if any.

        const startId = generatedItems.length > 0 ? Math.max(...generatedItems.map(i => i.id)) + 1 : 1;
        let counter = 0;

        selectedFiles.forEach((file) => {
            const id = startId + counter;
            const itemSuffix = id.toString().padStart(2, "0"); // 01, 02... based on ID
            // Actually code suffix usually resets per project? 
            // If we are "Generating", we usually start from 01. 
            // If we Append, we continue.

            // Let's recalculate suffix based on total index.
            // But wait, generatedItems state might be mixed logic.
            // Simplified: Just add them.

            newItems.push({
                id: id,
                code: `${nextCode}-${itemSuffix}.00`, // Provisional code, updated on save or re-seq?
                description: "", // User requested to separate Name and Design No. We leave Description empty for manual input.
                quantity: 1,
                unit: "PZA",
                designNo: file.name, // Use Filename as Design No
                material: "",
                url: file.url,
                thumbnail: file.thumbnail,
                fileId: file.id
            });
            counter++;
        });

        // Re-sequence everything to be safe
        const combined = [...generatedItems, ...newItems];
        const resequenced = combined.map((item, idx) => ({
            ...item,
            id: idx + 1,
            code: `${nextCode}-${(idx + 1).toString().padStart(2, "0")}.00`
        }));

        setGeneratedItems(resequenced);
        setIsSelectingFiles(false);
        setStagingFiles([]);
        setShowPreview(true);
        toast.success(`Importados ${selectedFiles.length} archivos.`);
    };

    // Update item helper
    const updateItem = (id: number, field: keyof GeneratedItem, value: any) => {
        setGeneratedItems(prev => prev.map(item =>
            item.id === id ? { ...item, [field]: value } : item
        ));
    };

    // Helper to delete and re-sequence items
    const handleDeleteItem = (idToDelete: number) => {
        setGeneratedItems(prev => {
            const filtered = prev.filter(i => i.id !== idToDelete);
            // Re-sequence
            if (!projectCode) return filtered;

            return filtered.map((item, index) => {
                const suffix = (index + 1).toString().padStart(2, "0");
                return {
                    ...item,
                    code: `${projectCode}-${suffix}.00`
                };
            });
        });
    };

    // Reusable styles for "Ghost" inputs in table
    const ghostInputClass = "bg-transparent border-transparent shadow-none hover:bg-red-50/10 focus:bg-white dark:focus:bg-zinc-900 focus:border-red-500/50 transition-all duration-200 h-9 font-medium";
    const ghostTextareaClass = "bg-transparent border-transparent shadow-none hover:bg-red-50/10 focus:bg-white dark:focus:bg-zinc-900 focus:border-red-500/50 transition-all duration-200 min-h-[60px] resize-none font-medium";
    const ghostTriggerClass = "bg-transparent border-transparent shadow-none hover:bg-red-50/10 focus:bg-white dark:focus:bg-zinc-900 focus:border-red-500/50 transition-all duration-200 h-9 font-medium";

    return (
        <div className="space-y-8 pb-20">
            <motion.div initial="hidden" animate="visible" variants={fadeIn}>
                <Card className="border-border/40 shadow-xl shadow-red-500/5 relative rounded-2xl overflow-visible bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 via-orange-500 to-red-600 rounded-t-2xl" />
                    <CardContent className="p-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-8">

                            {/* Client */}
                            <div className="space-y-2.5">
                                <Label className="text-muted-foreground font-medium text-xs uppercase tracking-wider">Cliente</Label>
                                <Select value={selectedClient} onValueChange={handleClientChange}>
                                    <SelectTrigger className="bg-zinc-50/50 border-zinc-200 shadow-sm h-10 transition-all hover:bg-white">
                                        <SelectValue placeholder="Seleccionar..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {clients.map(c => (
                                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* User / Requestor */}
                            <div className="space-y-2.5">
                                <Label className="text-muted-foreground font-medium text-xs uppercase tracking-wider">Usuario / Solicitante</Label>
                                <Select value={selectedUser} onValueChange={setSelectedUser}>
                                    <SelectTrigger className="bg-zinc-50/50 border-zinc-200 shadow-sm h-10 transition-all hover:bg-white">
                                        <SelectValue placeholder="Seleccionar..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {contacts.map(c => (
                                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Dates */}
                            <DateSelector
                                label="Fecha de Solicitud"
                                date={requestDate}
                                onSelect={(d) => d && setRequestDate(d)}
                            />

                            <DateSelector
                                label="Fecha de Entrega"
                                date={deliveryDate}
                                onSelect={setDeliveryDate}
                            />

                            {/* Project Info */}
                            <div className="space-y-2.5 md:col-span-2">
                                <Label className="text-muted-foreground font-medium text-xs uppercase tracking-wider">Nombre del Proyecto</Label>
                                <Input
                                    placeholder="Ej. Fabricación de Estructura Principal..."
                                    value={projectName}
                                    onChange={(e) => setProjectName(e.target.value)}
                                    className="bg-zinc-50/50 border-zinc-200 shadow-sm h-10 transition-all hover:bg-white focus:border-red-500/50"
                                />
                            </div>

                            {/* Drive Folder Input & Items Count Row */}
                            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="space-y-2.5 md:col-span-2">
                                    <Label className="text-muted-foreground font-medium text-xs uppercase tracking-wider flex items-center gap-2">
                                        Link Carpeta Drive (Opcional)
                                        <span className="bg-blue-100 text-blue-700 text-[10px] px-2 py-0.5 rounded-full font-bold">BETA</span>
                                    </Label>
                                    <Input
                                        placeholder="https://drive.google.com/drive/folders/..."
                                        value={driveFolderUrl}
                                        onChange={(e) => setDriveFolderUrl(e.target.value)}
                                        className="bg-blue-50/30 border-blue-100 shadow-sm h-10 transition-all hover:bg-white focus:border-blue-500/50"
                                    />
                                </div>
                                <div className="space-y-2.5">
                                    <Label className="text-muted-foreground font-medium text-xs uppercase tracking-wider">Nº de Partidas</Label>
                                    <Input
                                        type="number"
                                        min={1}
                                        value={itemsToGenerate}
                                        onChange={(e) => setItemsToGenerate(parseInt(e.target.value) || 1)}
                                        className="bg-zinc-50/50 border-zinc-200 shadow-sm h-10 transition-all hover:bg-white focus:border-red-500/50"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="mt-10 flex justify-end">
                            <Button
                                onClick={handleGeneratePreview}
                                disabled={loading || !selectedClient || !projectName}
                                className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white shadow-lg shadow-red-500/20 px-8 h-10 rounded-full transition-all duration-300 hover:scale-[1.02]"
                            >
                                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                                {driveFolderUrl ? "Escanear Drive y Generar" : "Generar Vista Previa"}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </motion.div>

            {/* STAGING AREA (Zona de Selección) */}
            <AnimatePresence>
                {isSelectingFiles && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-4"
                    >
                        <div className="flex items-center justify-between px-2 pt-4">
                            <h3 className="text-xl font-bold flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
                                <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 p-2 rounded-lg"><ImageIcon className="w-5 h-5" /></span>
                                Zona de Selección
                                <span className="text-sm font-normal text-muted-foreground ml-2">({stagingFiles.filter(f => f.selected).length} seleccionados)</span>
                            </h3>
                            <div className="flex gap-2">
                                <Button variant="ghost" size="sm" onClick={() => setIsSelectingFiles(false)}><X className="w-4 h-4 mr-1" /> Cancelar</Button>
                                <Button onClick={confirmImport} className="bg-blue-600 hover:bg-blue-700 text-white rounded-full transition-all hover:scale-105 shadow-lg shadow-blue-500/20">
                                    <Plus className="w-4 h-4 mr-2" /> Importar Seleccionados
                                </Button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 p-6 bg-zinc-50/50 dark:bg-zinc-900/50 rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700">
                            {stagingFiles.map(file => (
                                <div
                                    key={file.id}
                                    onClick={() => toggleStagingFile(file.id)}
                                    className={cn(
                                        "relative group cursor-pointer border rounded-xl overflow-hidden transition-all duration-200 aspect-[3/4] bg-white dark:bg-zinc-800",
                                        file.selected ? "ring-2 ring-blue-500 ring-offset-2 border-blue-500 shadow-xl shadow-blue-500/10 scale-[1.02]" : "border-zinc-200 hover:border-blue-300 opacity-70 hover:opacity-100 hover:scale-[1.02]"
                                    )}
                                >
                                    {/* Selection Indicator */}
                                    <div className={cn(
                                        "absolute top-2 right-2 z-10 w-6 h-6 rounded-full flex items-center justify-center transition-all shadow-sm",
                                        file.selected ? "bg-blue-500 text-white" : "bg-white/80 hover:bg-white text-zinc-400"
                                    )}>
                                        {file.selected ? <Plus className="w-4 h-4" /> : <div className="w-3 h-3 rounded-full border-2 border-current" />}
                                    </div>

                                    {/* Thumbnail */}
                                    <div className="w-full h-full flex items-center justify-center p-4">
                                        {file.thumbnail ? (
                                            <img src={file.thumbnail} alt={file.name} className="w-full h-full object-contain drop-shadow-sm" referrerPolicy="no-referrer" />
                                        ) : (
                                            <FileText className="w-12 h-12 text-zinc-300" />
                                        )}
                                    </div>

                                    {/* Name Label */}
                                    <div className="absolute bottom-0 left-0 w-full bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm p-2 text-[10px] font-medium truncate border-t text-center text-zinc-600 dark:text-zinc-300">
                                        {file.name}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* PREVIEW SECTION */}
            <AnimatePresence>
                {showPreview && (
                    <motion.div
                        initial="hidden"
                        animate="visible"
                        exit="hidden"
                        variants={slideUp}
                        className="space-y-4"
                    >
                        <div className="flex items-center justify-between px-2">
                            <h3 className="text-2xl font-bold flex items-center gap-3 text-zinc-900 dark:text-zinc-100">
                                <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                                    <FileText className="w-6 h-6 text-red-600" />
                                </div>
                                <span className="tracking-tight">Vista Previa</span>
                                <span className="text-lg font-mono text-muted-foreground bg-zinc-100 dark:bg-zinc-800 px-3 py-1 rounded-md">{projectCode}</span>
                            </h3>
                        </div>

                        <Card className="border-border/40 shadow-2xl shadow-black/5 overflow-hidden rounded-2xl bg-white dark:bg-zinc-950">
                            <div className="overflow-x-auto">
                                <Table className="min-w-[1200px]">
                                    <TableHeader className="bg-zinc-50/80 dark:bg-zinc-900/50">
                                        <TableRow className="hover:bg-transparent border-b-zinc-200/50">
                                            <TableHead className="w-[180px] font-bold text-xs uppercase tracking-wider text-zinc-500">Código</TableHead>
                                            <TableHead className="min-w-[350px] font-bold text-xs uppercase tracking-wider text-zinc-500">Descripción / Nombre</TableHead>
                                            <TableHead className="min-w-[100px] font-bold text-xs uppercase tracking-wider text-zinc-500">Cant.</TableHead>
                                            <TableHead className="w-[140px] font-bold text-xs uppercase tracking-wider text-zinc-500">Unidad</TableHead>
                                            <TableHead className="min-w-[400px] font-bold text-xs uppercase tracking-wider text-zinc-500">No. Diseño</TableHead>
                                            <TableHead className="min-w-[180px] font-bold text-xs uppercase tracking-wider text-zinc-500">Material</TableHead>
                                            <TableHead className="min-w-[180px] font-bold text-xs uppercase tracking-wider text-zinc-500">URL Plano</TableHead>
                                            <TableHead className="w-[50px]"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {generatedItems.map((item, index) => (
                                            <TableRow
                                                key={item.id}
                                                className={cn(
                                                    "border-b-zinc-100 dark:border-b-zinc-900 transition-colors hover:bg-red-50/50 dark:hover:bg-red-900/10",
                                                    index % 2 === 0 ? "bg-white dark:bg-zinc-950" : "bg-zinc-50/50 dark:bg-zinc-900/50"
                                                )}
                                            >
                                                <TableCell className="font-mono font-semibold text-zinc-700 dark:text-zinc-300 whitespace-nowrap align-top pt-4 pl-4">{item.code}</TableCell>
                                                <TableCell>
                                                    <Textarea
                                                        value={item.description}
                                                        onChange={(e) => updateItem(item.id, "description", e.target.value)}
                                                        className={ghostTextareaClass}
                                                        placeholder="Descripción..."
                                                    />
                                                </TableCell>
                                                <TableCell className="align-top pt-2">
                                                    <Input
                                                        type="number"
                                                        value={item.quantity}
                                                        onChange={(e) => updateItem(item.id, "quantity", parseInt(e.target.value))}
                                                        className={ghostInputClass}
                                                    />
                                                </TableCell>
                                                <TableCell className="align-top pt-2">
                                                    <Select
                                                        value={item.unit}
                                                        onValueChange={(val) => updateItem(item.id, "unit", val)}
                                                    >
                                                        <SelectTrigger className={ghostTriggerClass}>
                                                            <SelectValue placeholder="Uni." />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {units.map(u => (
                                                                <SelectItem key={u.id} value={u.name}>{u.name}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-start gap-1">
                                                        {item.thumbnail && (
                                                            <Dialog>
                                                                <DialogTrigger asChild>
                                                                    <Button variant="ghost" size="icon" className="h-9 w-9 text-blue-600/70 hover:text-blue-700 hover:bg-blue-50 shrink-0 rounded-full">
                                                                        <ImageIcon className="h-4 w-4" />
                                                                    </Button>
                                                                </DialogTrigger>
                                                                <DialogContent className="!fixed !top-[50%] !left-[50%] !translate-x-[-50%] !translate-y-[-50%] !max-w-6xl !w-[90vw] !h-[85vh] !max-h-[85vh] p-0 overflow-hidden bg-zinc-950 border border-zinc-800 shadow-2xl rounded-3xl flex flex-col items-center justify-center z-[9999] data-[state=open]:!zoom-in-95 data-[state=closed]:!zoom-out-95 data-[state=open]:!slide-in-from-left-1/2 data-[state=open]:!slide-in-from-top-[48%]">
                                                                    <DialogTitle className="sr-only">Vista Previa Plano</DialogTitle>
                                                                    <div className="w-full h-full flex items-center justify-center overflow-hidden p-4 relative group bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-100">
                                                                        {/* Decorative background glow */}
                                                                        <div className="absolute inset-0 bg-gradient-to-tr from-zinc-900/50 via-zinc-950/50 to-zinc-900/50 pointer-events-none" />



                                                                        <ImagePreviewWithZoom src={item.thumbnail} fileId={item.fileId} />
                                                                    </div>
                                                                </DialogContent>
                                                            </Dialog>
                                                        )}
                                                        <Textarea
                                                            value={item.designNo}
                                                            onChange={(e) => updateItem(item.id, "designNo", e.target.value)}
                                                            className={ghostTextareaClass}
                                                            placeholder="-"
                                                        />
                                                    </div>
                                                </TableCell>
                                                <TableCell className="align-top pt-2">
                                                    <Select
                                                        value={item.material}
                                                        onValueChange={(val) => updateItem(item.id, "material", val)}
                                                    >
                                                        <SelectTrigger className={ghostTriggerClass}>
                                                            <SelectValue placeholder="Mat." />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {materials.map(m => (
                                                                <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </TableCell>
                                                <TableCell className="align-top pt-2">
                                                    <Input
                                                        value={item.url}
                                                        onChange={(e) => updateItem(item.id, "url", e.target.value)}
                                                        className={ghostInputClass}
                                                        placeholder="https://..."
                                                    />
                                                </TableCell>
                                                <TableCell className="align-top pt-2">
                                                    <div className="flex items-center gap-1 justify-end">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                                            onClick={() => handleDeleteItem(item.id)}
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </Card>

                        <div className="flex justify-end gap-3 pt-4 pb-12">
                            <Button variant="outline" onClick={() => setShowPreview(false)} className="rounded-full px-6">Cancelar</Button>
                            <Button
                                onClick={handleSave}
                                disabled={loading || generatedItems.length === 0}
                                className="bg-red-600 hover:bg-red-700 text-white rounded-full px-6 shadow-lg shadow-red-500/20"
                            >
                                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                                Guardar Proyecto y Partidas
                            </Button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
