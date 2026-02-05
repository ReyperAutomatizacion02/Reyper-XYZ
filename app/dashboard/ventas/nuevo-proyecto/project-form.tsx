"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarIcon, Loader2, Save, FileText, RefreshCw, Plus, Trash2, X, ChevronDown, ImageIcon, ExternalLink, ZoomIn, ZoomOut, RotateCcw, Sparkles, FolderPlus } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";

import { DashboardHeader } from "@/components/dashboard-header";
import { useTour } from "@/hooks/use-tour";
import { cn } from "@/lib/utils";
/* removed duplicate imports */
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
import { createClientEntry, createContactEntry } from "@/app/dashboard/ventas/actions";
import { SearchableSelect } from "@/components/ui/searchable-select";


interface ProjectFormProps {
    clients: { id: string; name: string; prefix?: string | null }[];
    contacts: { id: string; name: string; client_id?: string }[];
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
    isDemo?: boolean; // Flag to identify demo items
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
            <div className="w-full h-full bg-card rounded-lg overflow-hidden shadow-2xl relative">
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
                    "w-full justify-start text-left font-normal bg-muted/50 hover:bg-card border-border shadow-sm transition-all duration-200",
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
                            className="absolute top-full mt-1 left-0 z-[9999] bg-popover border rounded-xl shadow-xl w-auto overflow-hidden ring-1 ring-border/20"
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

// Helper for auto-sizing textareas in tables
const AutoResizeTextarea = ({ value, onChange, placeholder, className, minHeight = "38px" }: any) => {
    return (
        <div className={cn("grid grid-cols-[1fr] relative w-max min-w-full", className?.includes("max-w") ? "" : "max-w-full")}>
            {/* Shadow element for sizing: Matches font/padding of textarea exactly */}
            <div
                className={cn(className, "invisible whitespace-pre-wrap break-words overflow-hidden h-auto w-full")}
                aria-hidden="true"
                style={{ minHeight }}
            >
                {value || placeholder || " "}
            </div>
            {/* Actual Input */}
            <textarea
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                className={cn(className, "absolute inset-0 h-full w-full resize-none overflow-hidden leading-inherit outline-none focus:outline-none")}
            />
        </div>
    );
};

export function ProjectForm({ clients, contacts, units, materials, initialDate }: ProjectFormProps) {
    const { startTour } = useTour();
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    // --- TOUR HANDLER WITH DEMO MODE ---
    const handleStartTour = () => {
        // 1. Simulate Data if empty to reveal hidden sections
        const isDemo = generatedItems.length === 0;

        if (isDemo) {
            // Populate Basic Info
            setProjectCode("PRJ-DEMO-001");
            setProjectName("Proyecto de Demostración (Tour)");
            if (clients.length > 0) setSelectedClient(clients[0].id);
            setDriveFolderUrl("https://drive.google.com/drive/folders/demo-folder-id");
            setItemsToGenerate(5);

            // Populate Staging Area (Selection Zone)
            setStagingFiles([
                { id: "demo-file-1", name: "Plano_Estructura_001.pdf", url: "", mimeType: "application/pdf", selected: true, thumbnail: "" }
            ]);
            setIsSelectingFiles(true);

            // Populate Preview Table
            setGeneratedItems([
                { id: 1, code: "PRJ-260204-01.00", description: "Parte Superior Estructura", quantity: 2, unit: "PZA", designNo: "D-001", material: "Acero A36", url: "", isDemo: true },
                { id: 2, code: "PRJ-260204-02.00", description: "Buje de Bronce", quantity: 10, unit: "PZA", designNo: "D-002", material: "Bronce", url: "", isDemo: true }
            ]);
            setShowPreview(true);
        }

        // 2. Cleanup Function
        const handleTourFinish = () => {
            if (isDemo) {
                setProjectCode("");
                setProjectName("");
                setSelectedClient("");
                setDriveFolderUrl("");
                setItemsToGenerate(0);
                setStagingFiles([]);
                setIsSelectingFiles(false);
                setGeneratedItems([]);
                setShowPreview(false);
            }
        };

        // 3. Start Tour with granular steps
        startTour([
            {
                element: "#project-client-wrapper",
                popover: { title: "Cliente", description: "Primero selecciona la empresa para la cual es el proyecto.", side: "bottom", align: "start" }
            },
            {
                element: "#project-user-wrapper",
                popover: { title: "Usuario / Solicitante", description: "Indica quién está solicitando este trabajo dentro de la empresa del cliente.", side: "bottom", align: "start" }
            },
            {
                element: "#project-date-request",
                popover: { title: "Fecha de Solicitud", description: "La fecha en que se recibió la orden de trabajo.", side: "bottom", align: "start" }
            },
            {
                element: "#project-date-delivery",
                popover: { title: "Fecha de Entrega", description: "Fecha compromiso para entregar el proyecto terminado.", side: "bottom", align: "start" }
            },
            {
                element: "#project-info-section",
                popover: { title: "Identificación del Proyecto", description: "Escribe un nombre claro para el proyecto.", side: "top", align: "start" }
            },
            {
                element: "#project-drive-input",
                popover: { title: "Carpeta de Drive", description: "Si tienes los planos en Drive, pega el link aquí para importarlos automáticamente.", side: "top", align: "start" }
            },
            {
                element: "#project-items-count",
                popover: { title: "Cantidad de Partidas", description: "Si no usas Drive, indica cuántas filas vacías necesitas generar.", side: "top", align: "start" }
            },
            {
                element: "#project-generate-btn",
                popover: { title: "Generar Partidas", description: "Haz clic para procesar el link de Drive o crear las filas manuales.", side: "right", align: "center" }
            },
            {
                element: "#project-staging-area",
                popover: { title: "Zona de Selección (Importación)", description: "Si usaste Drive, aquí verás los archivos encontrados. Selecciona los que quieras agregar al proyecto.", side: "top", align: "center" }
            },
            {
                element: "#project-preview-table",
                popover: { title: "Tabla de Partidas", description: "Revisa y edita la información generada (descripciones, cantidades, materiales).", side: "top", align: "center" }
            },
            {
                element: "#project-save-btn",
                popover: { title: "Guardar Proyecto", description: "Finalmente, guarda el proyecto para registrarlo en el sistema.", side: "top", align: "end" }
            }
        ], handleTourFinish);
    };

    // Data State (mutable for new additions)
    const [clientList, setClientList] = useState(clients);
    const [allContacts, setAllContacts] = useState(contacts);

    // Form State
    const [selectedClient, setSelectedClient] = useState("");
    const [clientCode, setClientCode] = useState("");
    const [selectedUser, setSelectedUser] = useState("");

    // Derived filtered contacts
    // If no client selected, maybe show nothing? Or show all?
    // User request: "only display contacts associated with the currently selected Client"
    // So if no client, likely empty or "select client first".
    const filteredContacts = selectedClient
        ? allContacts.filter(c => c.client_id === selectedClient)
        : [];


    // Staging State (Drive Selection)
    const [stagingFiles, setStagingFiles] = useState<StagingFile[]>([]);
    const [isSelectingFiles, setIsSelectingFiles] = useState(false);

    const handleClientChange = (clientId: string) => {
        setSelectedClient(clientId);
        const client = clientList.find(c => c.id === clientId);

        if (client && client.prefix) {
            setClientCode(client.prefix);
        } else {
            setClientCode("");
            toast.info("Este cliente no tiene prefijo registrado.");
        }

        // Check if current user belongs to new client
        const currentUser = allContacts.find(u => u.id === selectedUser);
        if (currentUser && currentUser.client_id !== clientId) {
            setSelectedUser("");
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
                company_name: clientList.find(c => c.id === selectedClient)?.name || "",
                requestor: allContacts.find(c => c.id === selectedUser)?.name || "",
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

    // Client Creation
    const handleCreateClient = async (name: string) => {
        try {
            setLoading(true);
            const newId = await createClientEntry(name); // Assuming createClientEntry returns the ID
            if (newId) {
                const newClient = { id: newId, name: name, prefix: null }; // Default prefix null
                setClientList(prev => [...prev, newClient].sort((a, b) => a.name.localeCompare(b.name)));
                setSelectedClient(newId);
                // Also trigger logic for code update if needed (will be empty prefix)
                setClientCode("");
                toast.success(`Cliente "${name}" creado exitosamente.`);
            }
        } catch (error: any) {
            toast.error("Error al crear cliente: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    // User Creation
    const handleCreateContact = async (name: string) => {
        try {
            if (!selectedClient) {
                toast.error("Selecciona un cliente primero.");
                return;
            }
            setLoading(true);
            const newId = await createContactEntry(name, selectedClient);
            if (newId) {
                const newContact = { id: newId, name: name, client_id: selectedClient };
                setAllContacts(prev => [...prev, newContact].sort((a, b) => a.name.localeCompare(b.name)));
                setSelectedUser(newId);
                toast.success(`Usuario "${name}" creado exitosamente.`);
            }
        } catch (error: any) {
            toast.error("Error al crear usuario: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    // Reusable styles for "Ghost" inputs in table
    const ghostInputClass = "bg-transparent border-transparent shadow-none hover:bg-primary/5 focus:bg-card focus:border-primary/50 transition-all duration-200 h-9 font-medium";
    const ghostTextareaClass = "bg-transparent border border-transparent shadow-none hover:bg-primary/5 focus:bg-card focus:border-primary focus:ring-1 focus:ring-primary transition-all duration-200 resize-none font-medium py-1.5 px-3 rounded-md";
    const ghostTriggerClass = "bg-transparent border-transparent shadow-none hover:bg-primary/5 focus:bg-card focus:border-primary/50 transition-all duration-200 h-9 font-medium";

    return (
        <div className="space-y-8 pb-20">
            <DashboardHeader
                title="Nuevo Proyecto"
                description="Generar cotización, códigos y partidas automáticamente."
                icon={<FolderPlus className="w-8 h-8" />}
                backUrl="/dashboard/ventas"
                colorClass="text-red-500"
                bgClass="bg-red-500/10"
                onHelp={handleStartTour}
            />

            <motion.div initial="hidden" animate="visible" variants={fadeIn}>
                <Card className="border-border/40 shadow-xl shadow-primary/5 relative rounded-2xl overflow-visible bg-card/80 backdrop-blur-sm">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 via-orange-500 to-red-600 rounded-t-2xl" />
                    <CardContent className="p-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-8">

                            {/* Client */}
                            <div className="space-y-2.5" id="project-client-wrapper">
                                <Label className="text-muted-foreground font-medium text-xs uppercase tracking-wider">Cliente</Label>
                                <SearchableSelect
                                    options={clientList.map(c => ({ label: c.name, value: c.id }))}
                                    value={selectedClient}
                                    onChange={handleClientChange}
                                    onCreate={handleCreateClient}
                                    placeholder="Seleccionar o crear..."
                                    className="w-full"
                                />
                            </div>

                            {/* User / Requestor */}
                            <div className="space-y-2.5" id="project-user-wrapper">
                                <Label className="text-muted-foreground font-medium text-xs uppercase tracking-wider">Usuario / Solicitante</Label>
                                <SearchableSelect
                                    options={filteredContacts.map(c => ({ label: c.name, value: c.id }))}
                                    value={selectedUser}
                                    onChange={setSelectedUser}
                                    onCreate={handleCreateContact}
                                    placeholder={selectedClient ? "Seleccionar o crear..." : "Selecciona Cliente primero"}
                                    className="w-full"
                                    disabled={!selectedClient}
                                />
                            </div>

                            {/* Dates */}
                            <div id="project-date-request">
                                <DateSelector
                                    label="Fecha de Solicitud"
                                    date={requestDate}
                                    onSelect={(d) => d && setRequestDate(d)}
                                />
                            </div>

                            <div id="project-date-delivery">
                                <DateSelector
                                    label="Fecha de Entrega"
                                    date={deliveryDate}
                                    onSelect={setDeliveryDate}
                                />
                            </div>

                            {/* Project Info */}
                            <div className="space-y-2.5 md:col-span-2" id="project-info-section">
                                <Label className="text-muted-foreground font-medium text-xs uppercase tracking-wider">Nombre del Proyecto</Label>
                                <Input
                                    placeholder="Ej. Fabricación de Estructura Principal..."
                                    value={projectName}
                                    onChange={(e) => setProjectName(e.target.value)}
                                    className="bg-muted/50 border-border shadow-sm h-10 transition-all hover:bg-card focus:border-primary/50"
                                />
                            </div>

                            {/* Drive Folder Input & Items Count Row */}
                            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-6" id="project-generation-section">
                                <div className="space-y-2.5 md:col-span-2" id="project-drive-input">
                                    <Label className="text-muted-foreground font-medium text-xs uppercase tracking-wider flex items-center gap-2">
                                        Link Carpeta Drive (Opcional)
                                    </Label>
                                    <Input
                                        placeholder="https://drive.google.com/drive/folders/..."
                                        value={driveFolderUrl}
                                        onChange={(e) => setDriveFolderUrl(e.target.value)}
                                        className="bg-blue-50/30 dark:bg-blue-950/30 border-blue-100 dark:border-blue-900 shadow-sm h-10 transition-all hover:bg-card focus:border-blue-500/50"
                                    />
                                </div>
                                <div className="space-y-2.5" id="project-items-count">
                                    <Label className="text-muted-foreground font-medium text-xs uppercase tracking-wider">Nº de Partidas</Label>
                                    <Input
                                        type="number"
                                        min={1}
                                        value={itemsToGenerate}
                                        onChange={(e) => setItemsToGenerate(parseInt(e.target.value) || 1)}
                                        className="bg-muted/50 border-border shadow-sm h-10 transition-all hover:bg-card focus:border-primary/50"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="mt-10 flex justify-end">
                            <Button
                                id="project-generate-btn"
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
                        id="project-staging-area"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-4"
                    >
                        <div className="flex items-center justify-between px-2 pt-4">
                            <h3 className="text-xl font-bold flex items-center gap-2 text-foreground">
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

                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 p-6 bg-muted/50 rounded-2xl border border-dashed border-border">
                            {stagingFiles.map(file => (
                                <div
                                    key={file.id}
                                    onClick={() => toggleStagingFile(file.id)}
                                    className={cn(
                                        "relative group cursor-pointer border rounded-xl overflow-hidden transition-all duration-200 aspect-[3/4] bg-card",
                                        file.selected ? "ring-2 ring-blue-500 ring-offset-2 ring-offset-background border-blue-500 shadow-xl shadow-blue-500/10 scale-[1.02]" : "border-border hover:border-blue-300 opacity-70 hover:opacity-100 hover:scale-[1.02]"
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
                                    <div className="absolute bottom-0 left-0 w-full bg-card/95 backdrop-blur-sm p-2 text-[10px] font-medium truncate border-t border-border text-center text-muted-foreground">
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
                            <h3 className="text-2xl font-bold flex items-center gap-3 text-foreground">
                                <div className="p-2 bg-primary/10 rounded-lg">
                                    <FileText className="w-6 h-6 text-red-600" />
                                </div>
                                <span className="tracking-tight">Vista Previa</span>
                                <span className="text-lg font-mono text-muted-foreground bg-muted px-3 py-1 rounded-md">{projectCode}</span>
                            </h3>
                        </div>

                        <Card className="border-border/40 shadow-2xl overflow-hidden rounded-2xl bg-card" id="project-preview-table">
                            <div className="overflow-x-auto">
                                <Table className="min-w-[1200px]">
                                    <TableHeader className="bg-table-header-bg">
                                        <TableRow className="hover:bg-transparent border-b-border/50">
                                            <TableHead className="w-[180px] font-bold text-xs uppercase tracking-wider text-zinc-500">Código</TableHead>
                                            <TableHead className="w-auto min-w-[200px] max-w-[450px] font-bold text-xs uppercase tracking-wider text-zinc-500">Descripción / Nombre</TableHead>
                                            <TableHead className="min-w-[100px] font-bold text-xs uppercase tracking-wider text-zinc-500">Cant.</TableHead>
                                            <TableHead className="w-[140px] font-bold text-xs uppercase tracking-wider text-zinc-500">Unidad</TableHead>
                                            <TableHead className="w-auto min-w-[150px] max-w-[400px] font-bold text-xs uppercase tracking-wider text-zinc-500">No. Diseño</TableHead>
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
                                                    "border-b-border transition-colors hover:bg-table-row-hover",
                                                    index % 2 === 0 ? "bg-card" : "bg-table-row-even"
                                                )}
                                            >
                                                <TableCell className="font-mono font-semibold text-foreground whitespace-nowrap pl-4">{item.code}</TableCell>
                                                <TableCell>
                                                    <AutoResizeTextarea
                                                        value={item.description}
                                                        onChange={(e: any) => updateItem(item.id, "description", e.target.value)}
                                                        className={cn(ghostTextareaClass, "min-w-[150px] max-w-[450px]")}
                                                        placeholder="Descripción..."
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Input
                                                        type="number"
                                                        value={item.quantity}
                                                        onChange={(e) => updateItem(item.id, "quantity", parseInt(e.target.value))}
                                                        className={ghostInputClass}
                                                    />
                                                </TableCell>
                                                <TableCell>
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
                                                    <div className="flex items-center gap-1">
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
                                                        <AutoResizeTextarea
                                                            value={item.designNo}
                                                            onChange={(e: any) => updateItem(item.id, "designNo", e.target.value)}
                                                            className={cn(ghostTextareaClass, "min-w-[150px] max-w-[350px]")}
                                                            placeholder="-"
                                                            minHeight="36px"
                                                        />
                                                    </div>
                                                </TableCell>
                                                <TableCell>
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
                                                <TableCell>
                                                    <Input
                                                        value={item.url}
                                                        onChange={(e) => updateItem(item.id, "url", e.target.value)}
                                                        className={ghostInputClass}
                                                        placeholder="https://..."
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-1 justify-end">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors"
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
                                id="project-save-btn"
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
