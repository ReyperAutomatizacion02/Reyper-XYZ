"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarIcon, Loader2, Save, FileText, RefreshCw, Plus, Trash2, X, ChevronDown, ImageIcon, ExternalLink, ZoomIn, ZoomOut, RotateCcw, Sparkles, FolderPlus, UploadCloud, Eye, GripVertical } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { motion, AnimatePresence, Reorder } from "framer-motion";

import { DashboardHeader } from "@/components/dashboard-header";
import { useTour } from "@/hooks/use-tour";
import { cn } from "@/lib/utils";
import { SharedItemsTable, SharedItemProps } from "../components/shared-items-table";
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
import { Dropzone } from "@/components/sales/dropzone";
import { createClient } from "@/utils/supabase/client";
import { DrawingViewer } from "@/components/sales/drawing-viewer";
import { ComboboxCreatable } from "@/components/sales/combobox-creatable";
import { createMaterialEntry, createTreatmentEntry } from "@/app/dashboard/ventas/actions";


interface ProjectFormProps {
    clients: { id: string; name: string; prefix?: string | null }[];
    contacts: { id: string; name: string; client_id?: string }[];
    units: { id: string; name: string }[];
    materials: { id: string; name: string }[];
    treatments: { id: string; name: string }[];
    initialDate: Date;
    initialQuote?: any;
}

interface GeneratedItem {
    id: number;
    stableId: string; // Added for Framer Motion keys
    code: string;
    description: string;
    quantity: number;
    unit: string;
    design_no: string;
    material: string;
    material_id?: string;
    treatment_id?: string;
    treatment_name?: string;
    url: string;
    thumbnail?: string;
    fileId?: string;
    mimeType?: string; // Added for better format detection
    is_sub_item?: boolean;
    isDemo?: boolean;
    part_name?: string;
}

interface StagingFile {
    id: string; // fileId
    name: string;
    thumbnail?: string;
    url: string;
    mimeType?: string;
    selected: boolean;
    file?: File;
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

export function ProjectForm({ clients, contacts, units, materials, treatments, initialDate, initialQuote }: ProjectFormProps) {
    const { startTour } = useTour();
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    // Data State (mutable for new additions)
    const [clientList, setClientList] = useState(clients);
    const [allContacts, setAllContacts] = useState(contacts);
    const [materialsList, setMaterialsList] = useState(materials.map(m => ({ value: m.id, label: m.name })));
    const [treatmentsList, setTreatmentsList] = useState(treatments ? treatments.map(t => ({ value: t.id, label: t.name })) : []);

    // Form State
    const [selectedClient, setSelectedClient] = useState("");
    const [clientCode, setClientCode] = useState("");
    const [selectedUser, setSelectedUser] = useState("");

    // Derived filtered contacts
    const filteredContacts = selectedClient
        ? allContacts.filter(c => c.client_id === selectedClient)
        : [];

    // Staging State
    const [stagingFiles, setStagingFiles] = useState<StagingFile[]>([]);

    // Dates
    const [requestDate, setRequestDate] = useState<Date>(initialDate);
    const [deliveryDate, setDeliveryDate] = useState<Date | undefined>(undefined);

    // Project Details
    const [projectName, setProjectName] = useState("");
    const [driveFolderUrl, setDriveFolderUrl] = useState("");
    const [itemsToGenerate, setItemsToGenerate] = useState(1);

    // Generated Data
    const [projectCode, setProjectCode] = useState<string | null>(null);
    const [generatedItems, setGeneratedItems] = useState<GeneratedItem[]>([]);
    const [showPreview, setShowPreview] = useState(false);
    const [pendingFiles, setPendingFiles] = useState<Map<string, File>>(new Map());
    const [isUploadingFiles, setIsUploadingFiles] = useState(false);

    // Viewer State
    const [viewerUrl, setViewerUrl] = useState<string | null>(null);
    const [viewerTitle, setViewerTitle] = useState("");
    const [viewerType, setViewerType] = useState<"image" | "pdf" | undefined>(undefined);
    const supabase = createClient();

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

            // Populate Preview Table
            setGeneratedItems([
                { id: 1, stableId: "demo-1", code: "PRJ-260204-01.00", description: "Parte Superior Estructura", quantity: 2, unit: "PZA", design_no: "D-001", material: "Acero A36", url: "https://example.com/demo.pdf", isDemo: true, is_sub_item: false },
                { id: 2, stableId: "demo-2", code: "PRJ-260204-02.00", description: "Buje de Bronce", quantity: 10, unit: "PZA", design_no: "D-002", material: "Bronce", url: "", isDemo: true, is_sub_item: false }
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
                setItemsToGenerate(1);
                setStagingFiles([]);
                setGeneratedItems([]);
                setShowPreview(false);
                setPendingFiles(new Map());
            }
        };

        // 3. Start Tour with grouped steps
        startTour([
            {
                element: "#project-header-first-three",
                popover: {
                    title: "Datos de Proyecto",
                    description: "Primero selecciona el Cliente, el Usuario solicitante y las fechas de Solicitud y Entrega.",
                    side: "bottom",
                    align: "start"
                }
            },
            {
                element: "#project-identity-input",
                popover: {
                    title: "Identificación del Proyecto",
                    description: "Asigna un nombre descriptivo y define la cantidad de filas iniciales.",
                    side: "top",
                    align: "start"
                }
            },
            {
                element: "#project-dropzone-section",
                popover: {
                    title: "Carga de Archivos",
                    description: "Puedes arrastrar tus planos directamente aquí para procesarlos de forma masiva.",
                    side: "top",
                    align: "center"
                }
            },
            {
                element: "#project-staging-area",
                popover: {
                    title: "Zona de Selección (Importación)",
                    description: "Aquí aparecen los archivos cargados. Puedes elegir cuáles incluir en el proyecto final.",
                    side: "top",
                    align: "center"
                }
            },
            {
                element: ".grip-handle-tour", // Target the first grip handle
                popover: {
                    title: "Reordenar Registros",
                    description: "Arrastra las filas desde el icono de la izquierda para cambiar su orden en el proyecto.",
                    side: "right",
                    align: "center"
                }
            },
            {
                element: ".viewer-btn-tour", // Target the first viewer button
                popover: {
                    title: "Visor de Planos",
                    description: "Usa el icono del ojo para previsualizar el plano asignado a cada partida.",
                    side: "right",
                    align: "center"
                }
            },
            {
                element: ".subitem-switch-tour", // Target the first sub-item switch
                popover: {
                    title: "Crear Subpartidas",
                    description: "Activa este switch para convertir una partida en subpartida, vinculándola a la anterior.",
                    side: "left",
                    align: "center"
                }
            },
            {
                element: "#project-save-btn",
                popover: {
                    title: "Guardar Proyecto",
                    description: "Una vez todo esté correcto, haz clic aquí para registrar el proyecto y sus partidas en el sistema.",
                    side: "top",
                    align: "end"
                }
            }
        ], handleTourFinish);
    };

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

    // Initialize from initialQuote if provided
    useEffect(() => {
        const initializeFromQuote = async () => {
            if (initialQuote && !selectedClient && clientList.length > 0) {
                const quoteClient = clientList.find(c => c.id === initialQuote.client_id);
                if (quoteClient) {
                    handleClientChange(quoteClient.id);

                    // Fetch project code immediately if we have a client
                    try {
                        const fetchedCode = await getNextProjectCode(quoteClient.prefix || "PRJ");
                        setProjectCode(fetchedCode);

                        if (initialQuote.items && initialQuote.items.length > 0) {
                            const quoteItemsAsGenerated: GeneratedItem[] = initialQuote.items.map((item: any, idx: number) => {
                                return {
                                    id: idx + 1,
                                    stableId: `quote-${item.id}`,
                                    code: ``, // Placeholder, will be sequenced below
                                    quantity: item.quantity,
                                    unit: item.unit || "PZA",
                                    design_no: item.design_no || "",
                                    material: item.material || "",
                                    material_id: item.material_id || "",
                                    treatment_id: item.treatment_id || "",
                                    treatment_name: item.treatment || "", // Map 'treatment' from quote item to 'treatment_name'
                                    url: item.drawing_url || "",
                                    is_sub_item: item.is_sub_item || false,
                                    part_name: item.part_name || "",
                                    description: item.description || "",
                                };
                            });

                            // Resequence with the real code prefix
                            const sequenced = resequenceItems(quoteItemsAsGenerated, fetchedCode);
                            setGeneratedItems(sequenced);
                            setItemsToGenerate(sequenced.length);
                            setShowPreview(true);

                            // Auto-set project name if empty
                            if (!projectName) {
                                setProjectName(`PROYECTO DESDE COTIZACIÓN ${initialQuote.id}`);
                            }
                        }
                    } catch (err) {
                        console.error("Error initializing project code:", err);
                        toast.error("Error al generar el código del proyecto.");
                    }
                }

                if (initialQuote.contact_id) {
                    setSelectedUser(initialQuote.contact_id);
                }

                if (initialQuote.delivery_date) {
                    setDeliveryDate(new Date(initialQuote.delivery_date + 'T12:00:00Z'));
                }
            }
        };

        initializeFromQuote();
    }, [initialQuote, clientList]);

    // Effect to sync itemsToGenerate with stagingFiles length
    useEffect(() => {
        if (stagingFiles.length > 0) {
            setItemsToGenerate(stagingFiles.length);
        }
    }, [stagingFiles.length]);

    // Effect to sync input with actual table size when preview is active
    useEffect(() => {
        if (showPreview) {
            setItemsToGenerate(generatedItems.length);
        }
    }, [generatedItems.length, showPreview]);


    const handleGeneratePreview = async () => {
        if (!selectedClient) {
            toast.error("Selecciona un cliente primero.");
            return;
        }

        setLoading(true);
        // Reset generated items
        setGeneratedItems([]);
        setShowPreview(false);

        try {
            // Determine project code logic
            const fetchedCode = await getNextProjectCode(clientCode || "PRJ");
            const nextCode = fetchedCode || projectCode || `${clientCode || "PRJ"}-${format(requestDate, "yyMMdd")}-XXXX`;
            setProjectCode(nextCode);

            const selectedFiles = stagingFiles.filter(f => f.selected);

            if (selectedFiles.length > 0) {
                // --- STAGING MODE (Files) ---
                const newPendingFiles = new Map<string, File>();
                const newItems: GeneratedItem[] = selectedFiles.map((f: StagingFile, idx) => {
                    const fileName = f.name.substring(0, f.name.lastIndexOf('.')) || f.name;
                    const upperName = fileName.toUpperCase();

                    if (f.file) {
                        newPendingFiles.set(f.id, f.file);
                    }

                    return {
                        id: idx + 1,
                        stableId: `file-${f.id}-${idx}`,
                        code: `${nextCode}-${(idx + 1).toString().padStart(2, "0")}.00`,
                        part_name: "",
                        description: "",
                        quantity: 1,
                        unit: "PZA",
                        design_no: upperName,
                        material: "",
                        treatment_id: "",
                        treatment_name: "",
                        url: f.url,
                        fileId: f.id,
                        mimeType: f.mimeType,
                        is_sub_item: false
                    };
                });

                setPendingFiles(prev => {
                    const updated = new Map(prev);
                    newPendingFiles.forEach((file, id) => updated.set(id, file));
                    return updated;
                });

                setGeneratedItems(newItems);
                setShowPreview(true);
                setStagingFiles([]); // Clear staging after generation
                toast.success(`Partidas generadas desde ${selectedFiles.length} archivos.`);
            } else {
                // --- MANUAL MODE ---
                const newItems: GeneratedItem[] = [];
                for (let i = 1; i <= itemsToGenerate; i++) {
                    const suffix = i.toString().padStart(2, "0");
                    newItems.push({
                        id: i,
                        stableId: `manual-${i}-${Math.random().toString(36).substring(7)}`,
                        code: `${nextCode}-${suffix}.00`,
                        part_name: "",
                        description: "",
                        quantity: 1,
                        unit: "PZA",
                        design_no: "",
                        material: "",
                        treatment_id: "",
                        treatment_name: "",
                        url: "",
                        is_sub_item: false
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

    const getLotNumber = (index: number, items: GeneratedItem[]) => {
        let parentCount = 0;
        let childCount = 0;
        for (let i = 0; i <= index; i++) {
            if (!items[i].is_sub_item) {
                parentCount++;
                childCount = 0;
            } else {
                childCount++;
            }
        }
        if (items[index].is_sub_item) {
            return `${parentCount}.${childCount}`;
        }
        return `${parentCount}`;
    };

    const resequenceItems = (items: GeneratedItem[], baseCode: string) => {
        let parentCount = 0;
        let childCount = 0;

        return items.map((item, idx) => {
            if (!item.is_sub_item) {
                parentCount++;
                childCount = 0;
            } else {
                childCount++;
            }

            const suffix = parentCount.toString().padStart(2, "0");
            const subSuffix = childCount.toString().padStart(2, "0");
            const finalCode = `${baseCode}-${suffix}.${subSuffix}`;

            return {
                ...item,
                id: idx + 1,
                code: finalCode
            };
        });
    };

    const generatePdfThumbnail = async (file: File): Promise<string | undefined> => {
        try {
            // Dynamic import to avoid SSR errors
            const pdfjsLib = await import("pdfjs-dist");

            // Set worker on client
            if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
                pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
            }

            const arrayBuffer = await file.arrayBuffer();
            const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
            const pdf = await loadingTask.promise;
            const page = await pdf.getPage(1);

            const viewport = page.getViewport({ scale: 0.5 });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');

            if (!context) return undefined;

            canvas.height = viewport.height;
            canvas.width = viewport.width;

            await page.render({ canvasContext: context, viewport, canvas: canvas as any }).promise;
            return canvas.toDataURL();
        } catch (error) {
            console.error("Error generating PDF thumbnail:", error);
            return undefined;
        }
    };

    const onFilesSelected = async (files: File[]) => {
        if (files.length === 0) return;

        setLoading(true);
        try {
            const newStaging: StagingFile[] = await Promise.all(files.map(async (file) => {
                const isImage = file.type.startsWith('image/');
                const isPdf = file.type === 'application/pdf';
                const url = URL.createObjectURL(file);

                let thumbnail: string | undefined = undefined;
                if (isImage) {
                    thumbnail = url;
                } else if (isPdf) {
                    thumbnail = await generatePdfThumbnail(file);
                }

                return {
                    id: `temp_${Math.random().toString(36).substring(7)}`,
                    name: file.name,
                    url: url,
                    thumbnail: thumbnail,
                    mimeType: file.type,
                    selected: true,
                    file: file
                } as StagingFile;
            }));

            setStagingFiles(prev => [...prev, ...newStaging]);
            toast.success(`${files.length} archivos añadidos a la previa.`);
        } catch (error) {
            toast.error("Error al procesar archivos.");
        } finally {
            setLoading(false);
        }
    };

    const removeStagedFile = (id: string) => {
        setStagingFiles(prev => {
            const fileToRemove = prev.find(f => f.id === id);
            if (fileToRemove) {
                URL.revokeObjectURL(fileToRemove.url);
            }
            return prev.filter(f => f.id !== id);
        });
    };

    const uploadPendingFiles = async (projectId: string): Promise<Record<string, string>> => {
        const results: Record<string, string> = {};

        for (const [id, file] of pendingFiles.entries()) {
            const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
            const filePath = `${projectId}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from("projects")
                .upload(filePath, file);

            if (uploadError) {
                console.error(`Error uploading ${file.name}:`, uploadError);
                throw new Error(`Fallo al subir ${file.name}`);
            }

            const { data: { publicUrl } } = supabase.storage
                .from("projects")
                .getPublicUrl(filePath);

            results[id] = publicUrl;
        }

        return results;
    };







    const handleSave = async () => {
        if (generatedItems.length === 0) {
            toast.error("No hay partidas para guardar.");
            return;
        }

        if (!projectCode) {
            toast.error("El código de proyecto no se ha generado correctamente.");
            return;
        }

        // Validation
        if (!deliveryDate) {
            toast.error("La fecha de entrega es obligatoria.");
            return;
        }
        if (!selectedClient) {
            toast.error("Debe seleccionar un cliente.");
            return;
        }
        if (!projectName) {
            toast.error("El nombre del proyecto es obligatorio.");
            return;
        }

        setLoading(true);
        try {
            // 1. Create Project and Initial Items
            const result = await createProjectAndItems({
                code: projectCode,
                name: projectName,
                client_id: selectedClient,
                company_name: clientList.find(c => c.id === selectedClient)?.name || "",
                requestor: allContacts.find(c => c.id === selectedUser)?.name || "",
                requestor_id: selectedUser,
                start_date: format(requestDate, "yyyy-MM-dd"),
                delivery_date: format(deliveryDate, "yyyy-MM-dd"),
                status: "active",
                source_quote_id: initialQuote?.id
            }, generatedItems.map((item: any) => ({
                part_code: item.code || "",
                part_name: item.part_name || "",
                description: item.description || "",
                quantity: item.quantity,
                material: item.material || "",
                material_id: item.material_id, // Passed from items array
                treatment_id: item.treatment_id,
                treatment_name: item.treatment_name, // Passed from items array
                drawing_url: item.url.startsWith('blob:') ? "" : item.url, // Initially empty if it's a blob
                image: "",
                unit: item.unit,
                design_no: item.design_no,
                is_sub_item: item.is_sub_item || false,
            })));

            if (result.success && result.projectId) {
                // 2. Upload pending files
                let drawingUrls: Record<string, string> = {};
                if (pendingFiles.size > 0) {
                    setIsUploadingFiles(true);
                    try {
                        drawingUrls = await uploadPendingFiles(result.projectId);
                    } catch (err: any) {
                        toast.error("Error al subir archivos: " + err.message);
                        // We continue, the project is created but some drawings might be missing
                    } finally {
                        setIsUploadingFiles(false);
                    }
                }

                // 3. Update items with real URLs (using a direct Supabase update if needed,
                // but since we want to be consistent, let's just update the items that had blobs)
                if (Object.keys(drawingUrls).length > 0) {
                    const updates = generatedItems
                        .filter(item => item.fileId && drawingUrls[item.fileId])
                        .map(item => ({
                            part_code: item.code,
                            drawing_url: drawingUrls[item.fileId!]
                        }));

                    for (const update of updates) {
                        await supabase
                            .from("production_orders")
                            .update({ drawing_url: update.drawing_url })
                            .eq("project_id", result.projectId)
                            .eq("part_code", update.part_code);
                    }
                }

                toast.success("Proyecto creado exitosamente");
                router.push("/dashboard");
            }
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
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
                    id: index + 1,
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
                title={initialQuote ? "Conversión a Proyecto" : "Nuevo Proyecto"}
                description={initialQuote ? `Convirtiendo partes de COT-${initialQuote.quote_number}` : "Generar cotización, códigos y partidas automáticamente."}
                icon={<FolderPlus className="w-8 h-8" />}
                backUrl="/dashboard/ventas"
                colorClass="text-red-500"
                bgClass="bg-red-500/10"
                onHelp={handleStartTour}
            />

            {initialQuote && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 flex items-start gap-4 mb-8">
                    <FolderPlus className="w-6 h-6 text-green-500 mt-0.5 flex-none" />
                    <div>
                        <h3 className="text-sm font-bold text-green-600 uppercase">Convirtiendo COT-{initialQuote.quote_number}</h3>
                        <p className="text-xs text-muted-foreground mt-1">
                            Ajusta los materiales, genera subpartidas de ser necesario y añade cualquier archivo pendiente. Al darle en "Guardar y Confirmar", esta cotización quedará marcada como aprobada automáticamente.
                        </p>
                    </div>
                </div>
            )}

            <motion.div initial="hidden" animate="visible" variants={fadeIn}>
                <Card className="border-border/40 shadow-xl shadow-primary/5 relative rounded-2xl overflow-visible bg-card/80 backdrop-blur-sm">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 via-orange-500 to-red-600 rounded-t-2xl" />
                    <CardContent className="p-8">
                        <div className="relative">
                            {/* Ghost highlight for Tour Step 1 - First 3 fields */}
                            <div
                                id="project-header-first-three"
                                className="absolute pointer-events-none z-0 rounded-xl"
                                style={{
                                    top: '-8px',
                                    left: '-8px',
                                    width: 'calc(100% + 16px)',
                                    height: 'calc(100% + 16px)'
                                }}
                            />

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-8 mb-8">
                                {/* Client */}
                                <div className="space-y-2.5 z-10" id="project-client-wrapper">
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
                                <div className="space-y-2.5 z-10" id="project-user-wrapper">
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

                                {/* Dates Request */}
                                <div className="z-10" id="project-date-request">
                                    <DateSelector
                                        label="Fecha de Solicitud"
                                        date={requestDate}
                                        onSelect={(d) => d && setRequestDate(d)}
                                    />
                                </div>

                                {/* Date Delivery - Always visible, not part of first ghost highlight */}
                                <div id="project-date-delivery" className="z-10">
                                    <DateSelector
                                        label="Fecha de Entrega"
                                        date={deliveryDate}
                                        onSelect={setDeliveryDate}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Project Info & Items Count Row - Group 2 for tour */}
                        <div className="md:col-span-4 grid grid-cols-1 md:grid-cols-4 gap-6 mb-8" id="project-identity-input">
                            <div className="space-y-2.5 md:col-span-3" id="project-info-section">
                                <Label className="text-muted-foreground font-medium text-xs uppercase tracking-wider">Nombre del Proyecto</Label>
                                <Input
                                    placeholder="Ej. Fabricación de Estructura Principal..."
                                    value={projectName}
                                    onChange={(e) => setProjectName(e.target.value)}
                                    className="bg-muted/50 border-border shadow-sm h-10 transition-all hover:bg-card focus:border-primary/50"
                                />
                            </div>
                            <div className="space-y-2.5 md:col-span-1" id="project-items-count">
                                <Label className="text-muted-foreground font-medium text-xs uppercase tracking-wider">No. de filas</Label>
                                <Input
                                    id="items-to-generate"
                                    type="number"
                                    min={1}
                                    value={itemsToGenerate}
                                    onChange={(e) => setItemsToGenerate(parseInt(e.target.value) || 1)}
                                    disabled={loading || stagingFiles.length > 0 || showPreview}
                                    className={cn(
                                        "bg-background border-zinc-500/20 focus:ring-red-500/20",
                                        (stagingFiles.length > 0 || showPreview) && "opacity-70 bg-muted cursor-not-allowed"
                                    )}
                                />
                            </div>
                        </div>

                        {/* Dropzone for Files - Hidden when staging exists, but visible in tour */}
                        {((stagingFiles.length === 0 && !showPreview) || (generatedItems.some(i => i.isDemo))) && (
                            <div className="md:col-span-4" id="project-dropzone-section">
                                <Dropzone
                                    onFilesSelected={onFilesSelected}
                                    isUploading={isUploadingFiles}
                                    className="h-48"
                                />
                            </div>
                        )}

                        {/* STAGING AREA (Zona de Selección) - MOVED INSIDE CARD */}
                        <AnimatePresence>
                            {((stagingFiles.length > 0 && !showPreview) || (generatedItems.some(i => i.isDemo))) && (
                                <motion.div
                                    id="project-staging-area"
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="space-y-4 mb-8"
                                >
                                    <Dropzone
                                        onFilesSelected={onFilesSelected}
                                        isUploading={isUploadingFiles}
                                        className="bg-muted/10 p-6 rounded-3xl border border-dashed border-zinc-500/20"
                                    >
                                        <div className="flex items-center justify-between px-2 mb-4">
                                            <h3 className="text-xl font-bold flex items-center gap-2 text-foreground">
                                                <span className="bg-red-500/10 text-red-600 p-2 rounded-lg"><ImageIcon className="w-5 h-5" /></span>
                                                Zona de Selección
                                                <span className="text-sm font-normal text-muted-foreground ml-2">({stagingFiles.filter(f => f.selected).length} archivos cargados)</span>
                                            </h3>
                                            <div className="flex gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setStagingFiles([])}
                                                    className="text-muted-foreground hover:text-red-500"
                                                >
                                                    <Trash2 className="w-4 h-4 mr-1" /> Limpiar Todo
                                                </Button>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-y-8 gap-x-4 max-h-[400px] overflow-y-auto p-5 custom-scrollbar">
                                            {stagingFiles.map(file => (
                                                <div
                                                    key={file.id}
                                                    className={cn(
                                                        "relative group border border-zinc-500/10 rounded-2xl overflow-hidden transition-all duration-300 aspect-[3/4] bg-muted/40 backdrop-blur-sm shadow-md",
                                                        file.selected ? "ring-2 ring-zinc-500/30 scale-[1.02] bg-muted/60" : "hover:border-zinc-500/30 hover:scale-[1.02]"
                                                    )}
                                                >
                                                    <div className="absolute top-3 right-3 z-10">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => {
                                                                setStagingFiles(prev => prev.filter(f => f.id !== file.id));
                                                            }}
                                                            className="h-8 w-8 bg-black/20 hover:bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-md"
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </Button>
                                                    </div>

                                                    <div className="w-full h-full flex items-center justify-center p-6 pb-12">
                                                        {file.thumbnail ? (
                                                            <img
                                                                src={file.thumbnail}
                                                                alt={file.name}
                                                                className="w-full h-full object-contain drop-shadow-lg rounded-sm"
                                                                referrerPolicy="no-referrer"
                                                            />
                                                        ) : (
                                                            <div className="flex flex-col items-center gap-2">
                                                                <FileText className="w-12 h-12 text-zinc-500 opacity-50" />
                                                                <span className="text-[10px] text-zinc-500 font-mono">PDF</span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="absolute bottom-0 left-0 w-full bg-background/80 backdrop-blur-md p-2.5 text-[10px] font-medium truncate border-t border-zinc-500/5 text-center text-muted-foreground uppercase tracking-tighter">
                                                        {file.name}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </Dropzone>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div className="mt-10 flex justify-end">
                            <Button
                                id="project-generate-btn"
                                onClick={handleGeneratePreview}
                                disabled={loading || !selectedClient || !projectName || showPreview}
                                className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white shadow-lg shadow-red-500/20 px-8 h-12 rounded-full transition-all duration-300 hover:scale-[1.02] font-bold uppercase tracking-wide group"
                            >
                                {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <RefreshCw className="w-5 h-5 mr-2 group-hover:rotate-180 transition-transform duration-500" />}
                                {stagingFiles.length > 0 ? `Generar Partidas desde Archivos (${stagingFiles.length})` : "Generar Vista Previa Manual"}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </motion.div>

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
                                <SharedItemsTable
                                    mode="project"
                                    quoteType="pieces"
                                    items={generatedItems as unknown as SharedItemProps[]}
                                    units={units.map(u => ({ value: u.name, label: u.name }))}
                                    materials={materialsList}
                                    treatments={treatmentsList}
                                    onReorder={(newItems) => setGeneratedItems(resequenceItems(newItems as any, projectCode || "PRJ"))}
                                    onUpdateItem={(indexOrId, data) => {
                                        // SharedItemsTable passes 'id' if available, else 'index'
                                        // For generatedItems, we match by id, or update by index depending
                                        const updateRecord = (id: string | number, field: string, value: any) => {
                                            const newItems = [...generatedItems];
                                            const idx = newItems.findIndex(i => i.id === id);
                                            if (idx !== -1) {
                                                newItems[idx] = { ...newItems[idx], [field]: value };
                                                setGeneratedItems(newItems);
                                            }
                                        }

                                        Object.entries(data).forEach(([key, val]) => {
                                            updateRecord(indexOrId, key, val);
                                        });

                                        // Ensure resequencing if sub_item swapped
                                        if ('is_sub_item' in data) {
                                            setGeneratedItems(prev => resequenceItems(prev, projectCode || "PRJ"));
                                        }
                                    }}
                                    onDeleteItem={(indexOrId) => {
                                        setGeneratedItems(prev => {
                                            const updated = prev.filter(i => i.id !== indexOrId);
                                            return resequenceItems(updated, projectCode || "PRJ");
                                        });
                                    }}
                                    onCreateUnit={async (name) => {
                                        // If units creation is needed
                                        const upperName = name.toUpperCase();
                                        return upperName;
                                    }}
                                    onCreateMaterial={async (name) => {
                                        const upperName = name.toUpperCase();
                                        const newId = await createMaterialEntry(upperName);
                                        setMaterialsList([...materialsList, { value: newId, label: upperName }]);
                                        return newId;
                                    }}
                                    onCreateTreatment={async (name) => {
                                        const upperName = name.toUpperCase();
                                        const newId = await createTreatmentEntry(upperName);
                                        setTreatmentsList([...treatmentsList, { value: newId, label: upperName }]);
                                        return newId;
                                    }}
                                    onViewDocument={(url, title) => {
                                        setViewerUrl(url);
                                        setViewerTitle(title || "Plano");
                                    }}
                                    formatCurrency={(val) => val.toString()}
                                    getLotNumber={(idx) => getLotNumber(idx, generatedItems)}
                                />
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
            <DrawingViewer
                url={viewerUrl}
                onClose={() => {
                    setViewerUrl(null);
                    setViewerType(undefined);
                }}
                title={viewerTitle}
                type={viewerType}
            />
        </div >
    );
}
