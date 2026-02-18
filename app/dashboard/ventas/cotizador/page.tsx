"use client";

import React, { useEffect, useState, useRef, forwardRef, type ReactNode } from "react";
import { Plus, Trash2, Save, FileText, ArrowLeft, Loader2, Printer, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Eye, Copy, FileEdit, FileCheck, UploadCloud, ZoomIn, ZoomOut, Maximize, X, GripVertical } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardHeader } from "@/components/dashboard-header";
import { Separator } from "@/components/ui/separator";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import dynamic from "next/dynamic";

import { ComboboxCreatable, Option } from "@/components/sales/combobox-creatable";
import {
    createClientEntry,
    createContactEntry,
    createPositionEntry,
    createAreaEntry,
    createUnitEntry,
    getCatalogData,
    saveQuote,
    getQuoteById,
    updateQuote
} from "../actions";

import { QuotePDF } from "@/components/sales/quote-pdf";
import { DrawingViewer } from "@/components/sales/drawing-viewer";
import { createClient } from "@/utils/supabase/client";
import { useTour } from "@/hooks/use-tour";

const Dropzone = forwardRef<HTMLInputElement, {
    onFilesSelected: (files: File[]) => void,
    isUploading: boolean,
    children?: ReactNode,
    className?: string
}>(({
    onFilesSelected,
    isUploading,
    children,
    className
}, ref) => {
    const internalRef = useRef<HTMLInputElement>(null);
    const fileInputRef = (ref as React.RefObject<HTMLInputElement>) || internalRef;
    const [isDragging, setIsDragging] = useState(false);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            onFilesSelected(Array.from(e.dataTransfer.files));
        }
    };

    return (
        <div
            className={cn(
                "relative transition-all duration-200",
                !children && "w-full flex flex-col items-center justify-center border-2 border-dashed border-zinc-500/30 rounded-2xl p-8 hover:bg-zinc-500/5 cursor-pointer group",
                isDragging && "border-red-500 bg-red-500/5 ring-4 ring-red-500/10",
                className
            )}
            onClick={(e) => {
                if (!children) {
                    fileInputRef.current?.click();
                }
            }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,image/*"
                className="hidden"
                onChange={(e) => {
                    if (e.target.files) onFilesSelected(Array.from(e.target.files));
                }}
            />
            {isDragging && children && (
                <div className="absolute inset-0 z-[100] bg-red-500/10 backdrop-blur-[2px] border-2 border-dashed border-red-500 flex items-center justify-center rounded-xl pointer-events-none animate-in fade-in zoom-in duration-200">
                    <div className="bg-background/90 border border-red-500/20 px-6 py-4 rounded-2xl shadow-2xl flex flex-col items-center gap-2 scale-110">
                        <UploadCloud className="w-10 h-10 text-red-500 animate-bounce" />
                        <p className="text-sm font-bold uppercase text-red-600">Suelta tus planos aquí</p>
                    </div>
                </div>
            )}
            {children ? children : (
                <>
                    <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        {isUploading ? <Loader2 className="w-6 h-6 text-red-500 animate-spin" /> : <Plus className="w-6 h-6 text-red-500" />}
                    </div>
                    <p className="text-sm font-bold uppercase tracking-tight">{isUploading ? "Subiendo archivos..." : "Sube tus archivos aquí o arrástralos"}</p>
                    <p className="text-[10px] text-muted-foreground mt-1 uppercase">PDF o imágenes únicamente</p>
                </>
            )}
        </div>
    );
});
Dropzone.displayName = "Dropzone";

const PDFDownloadLink = dynamic(
    () => import("@react-pdf/renderer").then((mod) => mod.PDFDownloadLink),
    {
        ssr: false,
        loading: () => <Button disabled variant="outline">Cargando PDF...</Button>,
    }
);

// Custom Date Selector Component - Manual Absolute Positioning
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

    return (
        <div className="space-y-2 relative" ref={containerRef}>
            <label className="text-xs font-semibold text-red-500 uppercase">{label}</label>
            <Button
                variant={"outline"}
                className={cn(
                    "w-full justify-start text-left font-normal bg-background border-input shadow-none transition-all duration-200",
                    !date && "text-muted-foreground"
                )}
                onClick={() => setIsOpen(!isOpen)}
            >
                <CalendarIcon className="mr-2 h-4 w-4 text-red-500" />
                {date ? format(date, "PPP", { locale: es }) : <span>Seleccionar</span>}
            </Button>

            <AnimatePresence>
                {isOpen && (
                    <>
                        <div
                            className="fixed inset-0 z-[9998] bg-transparent"
                            onClick={() => setIsOpen(false)}
                        />
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

type QuoteItem = {
    id: string; // Temporary ID for UI
    description: string;
    quantity: number;
    unit: string;
    unit_price: number;
    total: number;
    design_no?: string;
    drawing_url?: string;
    is_sub_item?: boolean;
};

interface IQuoteForm {
    quote_as: string;
    quote_type: "services" | "pieces";
    requisition_no: string;
    part_no: string;
    issue_date: string;
    delivery_date: string;
    currency: string;
    client_id: string;
    contact_id: string;
    payment_terms_days: number;
    position_id: string;
    area_id: string;
    validity_days: number;
    tax_rate: number;
}

export default function QuoteGeneratorPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Cargando...</div>}>
            <QuoteGeneratorContent />
        </Suspense>
    );
}

function QuoteGeneratorContent() {
    const { startTour } = useTour();
    const router = useRouter();
    const searchParams = useSearchParams();
    const editingId = searchParams.get("id");
    const isClone = searchParams.get("clone") === "true";

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [showBackConfirm, setShowBackConfirm] = useState(false);
    const [viewerUrl, setViewerUrl] = useState<string | null>(null);
    const [viewerTitle, setViewerTitle] = useState<string>("");

    // Catalogs
    const [clients, setClients] = useState<Option[]>([]);
    const [allContacts, setAllContacts] = useState<{ id: string, name: string, client_id?: string | null }[]>([]);
    const [positions, setPositions] = useState<Option[]>([]);
    const [areas, setAreas] = useState<Option[]>([]);
    const dropzoneRef = useRef<HTMLInputElement>(null);
    const [units, setUnits] = useState<{ value: string; label: string }[]>([]);

    // Form State
    const [formData, setFormData] = useState<IQuoteForm>({
        quote_as: "DMR",
        quote_type: "services",
        requisition_no: "",
        part_no: "",
        issue_date: new Date().toISOString().split('T')[0],
        delivery_date: "",
        currency: "MXN",
        client_id: "",
        contact_id: "",
        payment_terms_days: 30,
        position_id: "",
        area_id: "",
        validity_days: 30,
        tax_rate: 16
    });

    // Filtered Contacts Logic
    const filteredContacts = allContacts
        .filter(c => !formData.client_id || c.client_id === formData.client_id)
        .map(c => ({ value: c.id, label: c.name }));

    // Items State
    const [items, setItems] = useState<QuoteItem[]>([
        { id: "1", description: "", quantity: 1, unit: "PZA", unit_price: 0, total: 0 }
    ]);

    // Totals
    const [totals, setTotals] = useState({ subtotal: 0, tax: 0, total: 0 });
    const [savedQuote, setSavedQuote] = useState<{ id: string, quote_number: number } | null>(null);
    const [pendingFiles, setPendingFiles] = useState<Map<string, File>>(new Map());
    const [isUploadingFiles, setIsUploadingFiles] = useState(false);
    const supabase = createClient();

    // Calculate Grand Totals
    useEffect(() => {
        const sub = items.reduce((acc, item) => acc + item.total, 0);
        const tax = sub * (formData.tax_rate / 100);
        setTotals({
            subtotal: sub,
            tax: tax,
            total: sub + tax
        });
    }, [items, formData.tax_rate]);

    // Handle beforeunload to warn about unsaved changes
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (isDirty) {
                e.preventDefault();
                e.returnValue = "";
            }
        };
        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }, [isDirty]);

    const handleBack = () => {
        if (isDirty) {
            setShowBackConfirm(true);
        } else {
            router.push("/dashboard/ventas");
        }
    };

    const onFilesSelected = (files: File[]) => {
        if (files.length === 0) return;

        const newPendingFiles = new Map<string, File>();
        const processedFiles: string[] = [];
        const ignoredFiles: string[] = [];

        // Auto-generate items from filenames
        const newItems: QuoteItem[] = [];

        files.forEach(file => {
            const fileName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
            const upperName = fileName.toUpperCase();

            // Check if this file name already exists as an item WITH a drawing_url (already uploaded or blob)
            const exists = items.some(item =>
                item.description.toUpperCase().trim() === upperName.trim() &&
                (item.drawing_url || pendingFiles.has(item.id))
            );

            if (exists) {
                ignoredFiles.push(file.name);
                return;
            }

            const tempId = `temp_${Math.random().toString(36).substring(7)}`;

            // Add to the local batch of pending files
            newPendingFiles.set(tempId, file);
            processedFiles.push(file.name);

            newItems.push({
                id: tempId,
                description: upperName,
                quantity: 1,
                unit: "PZA",
                unit_price: 0,
                total: 0,
                drawing_url: URL.createObjectURL(file) + (file.type.includes('pdf') || file.name.toLowerCase().endsWith('.pdf') ? '#pdf' : '') // Hint for viewer
            });
        });

        if (newItems.length === 0) {
            if (ignoredFiles.length > 0) {
                toast.info("Los archivos ya existen en la lista y no fueron agregados de nuevo.");
            }
            return;
        }

        // Update pendingFiles once
        setPendingFiles(prev => {
            const updated = new Map(prev);
            newPendingFiles.forEach((file, id) => updated.set(id, file));
            return updated;
        });

        setItems(prev => {
            // Remove initial empty item if it's there and empty
            const filtered = prev.filter(i => i.description !== "" || i.unit_price > 0);
            return [...filtered, ...newItems];
        });

        if (ignoredFiles.length > 0) {
            toast.success(`${processedFiles.length} archivos agregados. ${ignoredFiles.length} omitidos por ya existir.`);
        } else {
            toast.success(`${processedFiles.length} archivos procesados localmente.`);
        }
        setIsDirty(true);
    };

    const uploadPendingFiles = async (quoteId: string): Promise<Record<string, string>> => {
        const results: Record<string, string> = {};

        for (const [id, file] of pendingFiles.entries()) {
            const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
            const filePath = `${quoteId}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from("quotes")
                .upload(filePath, file);

            if (uploadError) {
                console.error(`Error uploading ${file.name}:`, uploadError);
                throw new Error(`Fallo al subir ${file.name}`);
            }

            const { data: { publicUrl } } = supabase.storage
                .from("quotes")
                .getPublicUrl(filePath);

            results[id] = publicUrl;
        }

        return results;
    };

    // Helper to format numbers with commas
    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('es-MX', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(val);
    };

    // Form Validation Logic
    const getValidationErrors = () => {
        const errors: string[] = [];
        if (!formData.client_id) errors.push("Cliente requerido");
        if (!formData.contact_id) errors.push("Contacto/Usuario requerido");
        if (!formData.requisition_no) errors.push("No. Requisición requerido");
        if (!formData.part_no) errors.push("No. Parte requerido");
        if (!formData.delivery_date) errors.push("Fecha de entrega requerida");
        if (!formData.position_id) errors.push("Puesto requerido");
        if (!formData.area_id) errors.push("Área requerida");

        if (items.length === 0) {
            errors.push("Debe haber al menos 1 partida");
        } else {
            items.forEach((item, idx) => {
                const itemNum = idx + 1;
                if (!item.description.trim()) errors.push(`Descripción vacía en el LOT ${itemNum}`);
                if (item.quantity <= 0) errors.push(`Cantidad inválida en el LOT ${itemNum}`);
                if (item.unit_price <= 0) errors.push(`Precio Unitario inválido o vacío en el LOT ${itemNum}`);
            });
        }
        return errors;
    };

    const validationErrors = getValidationErrors();

    // Load Catalogs & Existing Quote on Mount
    useEffect(() => {
        async function loadAll() {
            try {
                const catalog = await getCatalogData();
                setClients(catalog.clients.map(c => ({ value: c.id, label: c.name })));
                setAllContacts(catalog.contacts); // Store raw contacts for filtering
                setPositions(catalog.positions.map(c => ({ value: c.id, label: c.name })));
                setAreas(catalog.areas.map(c => ({ value: c.id, label: c.name })));
                setUnits(catalog.units.map(c => ({ value: c.name, label: c.name })));

                if (editingId) {
                    const existing = await getQuoteById(editingId);
                    // Pre-fill form
                    setFormData({
                        quote_as: existing.quote_as,
                        quote_type: existing.quote_type || "services",
                        requisition_no: existing.requisition_no,
                        part_no: existing.part_no,
                        issue_date: existing.issue_date,
                        delivery_date: existing.delivery_date,
                        currency: existing.currency,
                        client_id: existing.client_id,
                        contact_id: existing.contact_id,
                        payment_terms_days: existing.payment_terms_days,
                        position_id: existing.position_id,
                        area_id: existing.area_id,
                        validity_days: existing.validity_days,
                        tax_rate: existing.tax_rate * 100 // Convert back to %
                    });

                    // Pre-fill items
                    setItems(existing.items.map((i: any) => ({
                        id: Math.random().toString(),
                        description: i.description,
                        quantity: i.quantity,
                        unit: i.unit,
                        unit_price: i.unit_price,
                        total: i.total_price,
                        design_no: i.design_no,
                        drawing_url: i.drawing_url,
                        is_sub_item: i.is_sub_item || false
                    })));

                    // Prepare ID for PDF download (only if not cloning)
                    if (!isClone) {
                        setSavedQuote({ id: existing.id, quote_number: existing.quote_number });
                    }
                }
            } catch (error) {
                toast.error("Error al cargar datos.");
            } finally {
                setLoading(false);
            }
        }
        loadAll();
    }, [editingId, isClone]);

    const handleFormChange = (updates: Partial<typeof formData>) => {
        // If client changes, clear contact if it doesn't belong to the new client
        if (updates.client_id && updates.client_id !== formData.client_id) {
            // We can check if the current contact is valid for the new client.
            // But simpler: just clear it if the client changes, forcing re-selection.
            // Or verify against allContacts (which is available here).
            const currentContact = allContacts.find(c => c.id === formData.contact_id);
            if (currentContact && currentContact.client_id !== updates.client_id) {
                updates.contact_id = "";
            }
        }
        setFormData(prev => ({ ...prev, ...updates }));
        setIsDirty(true);
    };

    // Logic: Add Item
    const addItem = () => {
        setIsDirty(true);
        setItems([
            ...items,
            { id: Math.random().toString(), description: "", quantity: 1, unit: "PZA", unit_price: 0, total: 0 }
        ]);
    };

    // Logic: Remove Item
    const removeItem = (index: number) => {
        setIsDirty(true);
        const itemToRemove = items[index];
        const hadFile = !!itemToRemove.drawing_url;

        // If it's the last item, don't remove it, just reset its values
        if (items.length === 1) {
            // Cleanup if it was a pending file
            if (itemToRemove.drawing_url?.startsWith('blob:')) {
                URL.revokeObjectURL(itemToRemove.drawing_url.split('#')[0]);
                setPendingFiles(prev => {
                    const updated = new Map(prev);
                    updated.delete(itemToRemove.id);
                    return updated;
                });
            }

            const resetItem: QuoteItem = {
                id: Math.random().toString(36).substr(2, 9),
                description: '',
                quantity: 1,
                unit: 'PZA',
                unit_price: 0,
                total: 0,
                drawing_url: undefined
            };
            setItems([resetItem]);
            if (hadFile) {
                toast.info("Plano removido de la partida", {
                    icon: <FileText className="w-4 h-4 text-zinc-500" />,
                    duration: 2000
                });
            }
            return;
        }

        // Cleanup if it was a pending file
        if (itemToRemove.drawing_url?.startsWith('blob:')) {
            URL.revokeObjectURL(itemToRemove.drawing_url.split('#')[0]);
            setPendingFiles(prev => {
                const updated = new Map(prev);
                updated.delete(itemToRemove.id);
                return updated;
            });
        }

        const newItems = [...items];
        newItems.splice(index, 1);
        setItems(newItems);

        if (hadFile) {
            toast.info("Partida y plano asociado eliminados", {
                icon: <Trash2 className="w-4 h-4 text-red-500" />,
                duration: 2000
            });
        }
    };

    // Logic: Update Item
    const updateItem = (index: number, field: keyof QuoteItem, value: any) => {
        setIsDirty(true);
        const newItems = [...items];
        const item = { ...newItems[index] };

        // Force uppercase for description
        if (field === 'description' && typeof value === 'string') {
            value = value.toUpperCase();
        }

        (item as any)[field] = value;

        // Recalculate row total
        if (field === "quantity" || field === "unit_price") {
            item.total = item.quantity * item.unit_price;
        }

        newItems[index] = item; // Update the item in the array
        setItems(newItems);
    };

    const getLotNumber = (index: number) => {
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

    // Logic: Full Reset (Nuevo) - Clears everything including ID/Folio to start fresh
    const handleNewQuote = () => {
        setFormData({
            quote_as: "DMR",
            quote_type: "services",
            requisition_no: "",
            part_no: "",
            issue_date: new Date().toISOString().split('T')[0],
            delivery_date: "",
            currency: "MXN",
            client_id: "",
            contact_id: "",
            payment_terms_days: 30,
            position_id: "",
            area_id: "",
            validity_days: 30,
            tax_rate: 16
        });
        setItems([
            { id: "1", description: "", quantity: 1, unit: "PZA", unit_price: 0, total: 0 }
        ]);
        setSavedQuote(null);
        setIsDirty(false);
        // If we were editing, we should probably push to the base URL to clear the ID query param
        if (editingId) {
            router.push("/dashboard/ventas/cotizador");
        }
        document.getElementById('cotizador-top')?.scrollIntoView({ behavior: 'smooth' });
        toast.info("Nueva cotización iniciada.");
    };

    // Logic: Reset Fields (Reiniciar) - Clears inputs but keeps current session/folio if exists
    const handleResetFields = () => {
        setFormData({
            quote_as: "DMR",
            quote_type: "services",
            requisition_no: "",
            part_no: "",
            issue_date: new Date().toISOString().split('T')[0],
            delivery_date: "",
            currency: "MXN",
            client_id: "",
            contact_id: "",
            payment_terms_days: 30,
            position_id: "",
            area_id: "",
            validity_days: 30,
            tax_rate: 16
        });
        setItems([
            { id: "1", description: "", quantity: 1, unit: "PZA", unit_price: 0, total: 0 }
        ]);
        // Do NOT clear savedQuote or editingId
        setIsDirty(false);
        document.getElementById('cotizador-top')?.scrollIntoView({ behavior: 'smooth' });
        toast.info("Formulario reiniciado (Folio conservado).");
    };

    const handleSave = async () => {
        if (validationErrors.length > 0) {
            toast.error("Por favor completa todos los campos requeridos antes de guardar.");
            return;
        }

        setSaving(true);
        try {
            // Prepare Quote Data
            const dbQuote = {
                ...formData,
                subtotal: totals.subtotal,
                tax_amount: totals.tax,
                tax_rate: formData.tax_rate / 100, // DB expects 0.16
                total: totals.total,
                quote_as: formData.quote_as || "DMR" // Default fallback
            };

            // Prepare Items for DB (remove UI id, keep others)
            const dbItems = items.map(i => ({
                description: i.description,
                quantity: i.quantity,
                unit: i.unit,
                unit_price: i.unit_price,
                total_price: i.total,
                design_no: i.design_no,
                drawing_url: i.drawing_url,
                is_sub_item: i.is_sub_item || false
            }));

            // Determine if we are updating an existing quote
            // We update if we have a URL id (editingId) or if we just saved it in this session (savedQuote.id)
            const currentId = (editingId && !isClone) ? editingId : savedQuote?.id;

            if (currentId) {
                // If we have pending files, upload them now
                let drawingUrls: Record<string, string> = {};
                if (pendingFiles.size > 0) {
                    setIsUploadingFiles(true);
                    try {
                        drawingUrls = await uploadPendingFiles(currentId);
                    } catch (err: any) {
                        toast.error("Fallo al subir archivos: " + err.message);
                        setSaving(false);
                        return;
                    } finally {
                        setIsUploadingFiles(false);
                    }
                }

                // Update items with real URLs if any were uploaded
                const finalItems = dbItems.map((item, idx) => {
                    const tempId = items[idx].id;
                    if (drawingUrls[tempId]) {
                        return { ...item, drawing_url: drawingUrls[tempId] };
                    }
                    return item;
                });

                await updateQuote(currentId, dbQuote, finalItems);

                // CRITICAL: Update items state with real URLs so subsequent saves don't use stale blob: URLs
                setItems(prev => prev.map((item, idx) => {
                    const realUrl = drawingUrls[item.id];
                    if (realUrl) {
                        // Revoke the old blob URL to free memory
                        if (item.drawing_url?.startsWith('blob:')) {
                            URL.revokeObjectURL(item.drawing_url.split('#')[0]);
                        }
                        return { ...item, drawing_url: realUrl };
                    }
                    return item;
                }));

                toast.success(`Cotización #${savedQuote?.quote_number || ""} actualizada.`);
                setPendingFiles(new Map());
                setIsDirty(false);
            } else {
                // For NEW quotes, we need an ID first to upload files
                // 1. Save initial quote to get ID
                const result = await saveQuote(dbQuote, []); // Insert with NO items first to avoid RLS/Dup issues

                // 2. Upload files for this new ID
                let drawingUrls: Record<string, string> = {};
                if (pendingFiles.size > 0) {
                    setIsUploadingFiles(true);
                    try {
                        drawingUrls = await uploadPendingFiles(result.id);
                    } catch (err: any) {
                        toast.error("Error al subir archivos: " + err.message);
                    } finally {
                        setIsUploadingFiles(false);
                    }
                }

                // 3. Now update with ALL items correctly
                const finalItems = dbItems.map((item, idx) => {
                    const tempId = items[idx].id;
                    if (drawingUrls[tempId]) {
                        return { ...item, drawing_url: drawingUrls[tempId] };
                    }
                    return item;
                });

                await updateQuote(result.id, dbQuote, finalItems);

                // CRITICAL: Update items state with real URLs so subsequent saves don't use stale blob: URLs
                setItems(prev => prev.map(item => {
                    const realUrl = drawingUrls[item.id];
                    if (realUrl) {
                        if (item.drawing_url?.startsWith('blob:')) {
                            URL.revokeObjectURL(item.drawing_url.split('#')[0]);
                        }
                        return { ...item, drawing_url: realUrl };
                    }
                    return item;
                }));

                toast.success(`Cotización #${result.quote_number} generada exitosamente.`);
                setSavedQuote(result);
                setPendingFiles(new Map());
                setIsDirty(false);

                // If it was a clone, clean up the URL to point to the new ID
                if (isClone) {
                    router.replace(`/dashboard/ventas/cotizador?id=${result.id}`);
                }
            }

        } catch (error: any) {
            console.error(error);
            toast.error("Error al guardar la cotización: " + error.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-muted-foreground">Cargando catálogos...</div>;

    const handleCreateClient = async (name: string) => {
        try {
            setLoading(true);
            const newId = await createClientEntry(name);
            if (newId) {
                const newClientOption = { value: newId, label: name };
                setClients(prev => [...prev, newClientOption].sort((a, b) => a.label.localeCompare(b.label)));
                toast.success(`Cliente "${name}" creado exitosamente.`);
                return newId;
            }
            return null;
        } catch (error: any) {
            toast.error("Error al crear cliente: " + error.message);
            return null;
        } finally {
            setLoading(false);
        }
    };

    const handleCreateContact = async (name: string) => {
        try {
            if (!formData.client_id) {
                toast.error("Selecciona un cliente primero para asociar el usuario.");
                return null;
            }
            setLoading(true);
            const newId = await createContactEntry(name, formData.client_id);
            if (newId) {
                const newContact = { id: newId, name: name, client_id: formData.client_id };
                setAllContacts(prev => [...prev, newContact].sort((a, b) => a.name.localeCompare(b.name)));
                toast.success(`Usuario "${name}" creado exitosamente.`);
                return newId;
            }
            return null;
        } catch (error: any) {
            toast.error("Error al crear usuario: " + error.message);
            return null;
        } finally {
            setLoading(false);
        }
    };

    return (
        <div id="cotizador-top" className="space-y-6 max-w-7xl mx-auto pb-20">
            {/* Header / Nav */}
            <DashboardHeader
                title="Generar Cotización"
                description="Ventas / Nueva Cotización"
                icon={<FileText className="w-8 h-8" />}
                onBack={handleBack}
                colorClass="text-red-500"
                bgClass="bg-red-500/10"
                onHelp={() => startTour([
                    {
                        element: "#quote-header-inputs",
                        popover: {
                            title: "Datos de Encabezado",
                            description: "Define cómo cotizar (DMR/Inversa), el número de requisición y el número de parte.",
                            side: "bottom",
                            align: "start"
                        }
                    },
                    {
                        element: "#quote-dates-inputs",
                        popover: {
                            title: "Fechas y Moneda",
                            description: "Establece la fecha de emisión, la entrega estimada y la moneda de la cotización.",
                            side: "bottom",
                            align: "start"
                        }
                    },
                    {
                        element: "#quote-client-inputs",
                        popover: {
                            title: "Cliente y Usuario",
                            description: "Selecciona al cliente y el contacto. Si no existen, puedes crearlos escribiendo el nombre y haciendo clic en 'Crear'.",
                            side: "top",
                            align: "start"
                        }
                    },
                    {
                        element: "#quote-extra-inputs",
                        popover: {
                            title: "Detalles Adicionales",
                            description: "Información complementaria como Puesto, Área y vigencia de la oferta.",
                            side: "top",
                            align: "start"
                        }
                    },
                    {
                        element: "#quote-items-section",
                        popover: {
                            title: "Listado de Partidas",
                            description: "Aquí agregas los productos. Define descripción, cantidad, unidad (creables) y precio.",
                            side: "top",
                            align: "center"
                        }
                    },
                    {
                        element: "#quote-add-item-btn",
                        popover: {
                            title: "Agregar Más Partidas",
                            description: "Usa este botón para añadir más filas a tu cotización.",
                            side: "right",
                            align: "center"
                        }
                    },
                    {
                        element: "#quote-totals-section",
                        popover: {
                            title: "Validación y Totales",
                            description: "Verifica los subtotales e impuestos. Si faltan datos, aquí aparecerán las alertas de validación.",
                            side: "left",
                            align: "center"
                        }
                    },
                    {
                        element: "#quote-final-actions",
                        popover: {
                            title: "Guardar o Imprimir",
                            description: "Finaliza guardando la cotización. Podrás generar el PDF una vez guardada.",
                            side: "top",
                            align: "end"
                        }
                    }
                ])}
            />

            {/* General Info Card */}
            <Card id="quote-client-section" className="bg-card border-border">
                <CardHeader className="pb-4 border-b border-border">
                    <CardTitle className="text-red-500 font-semibold text-lg flex items-center gap-2">
                        <FileText className="w-5 h-5" />
                        Información General
                    </CardTitle>
                </CardHeader>
                <CardContent id="quote-details-section" className="pt-6 grid gap-6 md:grid-cols-3">
                    {/* Row 1 */}
                    <div id="quote-header-inputs" className="grid grid-cols-1 md:grid-cols-3 gap-6 col-span-1 md:col-span-3">
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-red-500 uppercase">Cotizar como</label>
                            <Select
                                value={formData.quote_as}
                                onValueChange={(value) => handleFormChange({ quote_as: value })}
                            >
                                <SelectTrigger className="bg-background border-input text-foreground">
                                    <SelectValue placeholder="Seleccionar..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="DMR">DMR</SelectItem>
                                    <SelectItem value="JOSE DE JESUS">JOSE DE JESUS</SelectItem>
                                    <SelectItem value="INVERSA">INVERSA</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-red-500 uppercase">No. Parte</label>
                            <Input
                                value={formData.part_no}
                                onChange={e => handleFormChange({ part_no: e.target.value.toUpperCase() })}
                                placeholder="PN-X99"
                                className="bg-background border-input text-foreground uppercase"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-red-500 uppercase">No. Requisición</label>
                            <Input
                                value={formData.requisition_no}
                                onChange={e => handleFormChange({ requisition_no: e.target.value.toUpperCase() })}
                                placeholder="Ej. REQ-12345..."
                                className="bg-background border-input text-foreground uppercase"
                            />
                        </div>
                    </div>

                    {/* Row 2 */}
                    <div id="quote-dates-inputs" className="grid grid-cols-1 md:grid-cols-3 gap-6 col-span-1 md:col-span-3">
                        <div className="space-y-2">
                            <DateSelector
                                label="Fecha de Emisión"
                                date={formData.issue_date ? new Date(formData.issue_date + 'T12:00:00') : undefined}
                                onSelect={(d) => handleFormChange({ issue_date: d ? format(d, 'yyyy-MM-dd') : '' })}
                            />
                        </div>
                        <div className="space-y-2">
                            <DateSelector
                                label="Fecha de Entrega"
                                date={formData.delivery_date ? new Date(formData.delivery_date + 'T12:00:00') : undefined}
                                onSelect={(d) => handleFormChange({ delivery_date: d ? format(d, 'yyyy-MM-dd') : '' })}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-red-500 uppercase">Moneda</label>
                            <Select
                                value={formData.currency}
                                onValueChange={(value) => handleFormChange({ currency: value })}
                            >
                                <SelectTrigger className="bg-background border-input text-foreground">
                                    <SelectValue placeholder="Seleccionar..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="MXN">MXN</SelectItem>
                                    <SelectItem value="USD">USD</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Row 3 - Dynamic Comboboxes */}
                    <div id="quote-client-inputs" className="grid grid-cols-1 md:grid-cols-3 gap-6 col-span-1 md:col-span-3">
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-red-500 uppercase">Cliente</label>
                            <ComboboxCreatable
                                options={clients}
                                value={formData.client_id}
                                onSelect={(val) => handleFormChange({ client_id: val })}
                                onCreate={handleCreateClient}
                                createLabel="Crear Cliente"
                                placeholder="Seleccionar Cliente..."
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-red-500 uppercase">Usuario (Contacto)</label>
                            <ComboboxCreatable
                                options={filteredContacts}
                                value={formData.contact_id}
                                onSelect={(val) => handleFormChange({ contact_id: val })}
                                onCreate={handleCreateContact}
                                createLabel="Crear Contacto"
                                placeholder={formData.client_id ? "Seleccionar Usuario..." : "Selecciona Cliente primero"}
                                disabled={!formData.client_id}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-red-500 uppercase">Condiciones de Pago (Días)</label>
                            <Input
                                type="number"
                                step={5}
                                value={formData.payment_terms_days}
                                onChange={e => handleFormChange({ payment_terms_days: parseInt(e.target.value) })}
                                className="bg-background border-input text-foreground"
                            />
                        </div>
                    </div>

                    {/* Row 4 */}
                    <div id="quote-extra-inputs" className="grid grid-cols-1 md:grid-cols-3 gap-6 col-span-1 md:col-span-3">
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-red-500 uppercase">Puesto</label>
                            <ComboboxCreatable
                                options={positions}
                                value={formData.position_id}
                                onSelect={(val) => handleFormChange({ position_id: val })}
                                onCreate={async (name) => {
                                    const upperName = name.toUpperCase();
                                    const id = await createPositionEntry(upperName);
                                    setPositions([...positions, { value: id!, label: upperName }]);
                                    return id || null;
                                }}
                                createLabel="Crear Puesto"
                                placeholder="Ej. Mantenimiento..."
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-red-500 uppercase">Área</label>
                            <ComboboxCreatable
                                options={areas}
                                value={formData.area_id}
                                onSelect={(val) => handleFormChange({ area_id: val })}
                                onCreate={async (name) => {
                                    const upperName = name.toUpperCase();
                                    const id = await createAreaEntry(upperName);
                                    setAreas([...areas, { value: id!, label: upperName }]);
                                    return id || null;
                                }}
                                createLabel="Crear Área"
                                placeholder="Ej. Producción..."
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-red-500 uppercase">Vigencia (Días)</label>
                            <Input
                                type="number"
                                step={5}
                                value={formData.validity_days}
                                onChange={e => handleFormChange({ validity_days: parseInt(e.target.value) })}
                                className="bg-background border-input text-foreground"
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Items Table Card */}
            <Card className="bg-card border-border">
                <CardHeader className="pb-4 border-b border-border flex flex-row items-center justify-between">
                    <CardTitle className="text-red-500 font-semibold text-lg">Lotes y/o Items</CardTitle>
                    <div className="flex items-center gap-3">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase">Modo:</label>
                        <Select
                            value={formData.quote_type}
                            onValueChange={(value: "services" | "pieces") => handleFormChange({ quote_type: value })}
                        >
                            <SelectTrigger className="h-8 w-[200px] bg-background border-zinc-500/20 text-xs font-bold uppercase transition-all focus:ring-red-500/20">
                                <SelectValue placeholder="Seleccionar..." />
                            </SelectTrigger>
                            <SelectContent className="bg-card border-border">
                                <SelectItem value="services" className="text-xs font-bold uppercase">Servicios (Venta Libre)</SelectItem>
                                <SelectItem value="pieces" className="text-xs font-bold uppercase">Piezas (Planos)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardHeader>
                <CardContent className="pt-0 px-0 relative">
                    <Dropzone
                        onFilesSelected={onFilesSelected}
                        isUploading={isUploadingFiles}
                        className="border-0 p-0 rounded-none hover:bg-transparent"
                        ref={dropzoneRef}
                    >
                        <div id="quote-items-section" className="relative group/table p-0 flex flex-col min-h-full">
                            <div className="overflow-x-auto flex-1">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="border-border hover:bg-muted/50">
                                            <TableHead className="w-[40px]"></TableHead>
                                            <TableHead className="w-[60px] text-muted-foreground text-center">LOT</TableHead>
                                            <TableHead className="text-muted-foreground">Descripción</TableHead>
                                            <TableHead className="w-[120px] text-muted-foreground text-center">Cant</TableHead>
                                            <TableHead className="w-[100px] text-muted-foreground text-center">U.M</TableHead>
                                            <TableHead className="w-[150px] text-muted-foreground text-right">Precio Unit.</TableHead>
                                            <TableHead className="w-[150px] text-muted-foreground text-right">Total</TableHead>
                                            <TableHead className="w-[80px] text-muted-foreground text-center">Subp.</TableHead>
                                            <TableHead className="w-[100px] text-muted-foreground"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <Reorder.Group axis="y" values={items} onReorder={setItems} as="tbody" className="contents">
                                        {items.map((item, index) => (
                                            <Reorder.Item
                                                key={item.id}
                                                value={item}
                                                as="tr"
                                                className={cn(
                                                    "border-border hover:bg-muted/50 transition-colors bg-card",
                                                    item.is_sub_item && "bg-zinc-50/30 dark:bg-zinc-900/10"
                                                )}
                                            >
                                                <TableCell className="w-[40px] cursor-grab active:cursor-grabbing text-muted-foreground/30 hover:text-muted-foreground transition-colors p-0 text-center">
                                                    <div className="flex justify-center items-center h-full">
                                                        <GripVertical className="w-4 h-4" />
                                                    </div>
                                                </TableCell>
                                                <TableCell className={cn(
                                                    "font-mono text-center font-bold",
                                                    item.is_sub_item ? "text-red-500 text-xs" : "text-muted-foreground"
                                                )}>
                                                    {getLotNumber(index)}
                                                </TableCell>
                                                <TableCell>
                                                    <div className={cn("flex items-start gap-2", item.is_sub_item && "pl-6")}>
                                                        {item.is_sub_item && <span className="text-red-500 mt-2">↳</span>}
                                                        <Textarea
                                                            value={item.description}
                                                            onChange={(e) => updateItem(index, 'description', e.target.value)}
                                                            placeholder="DESCRIPCIÓN DETALLADA DEL ARTÍCULO..."
                                                            className="bg-transparent border-none shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 px-0 text-foreground placeholder:text-muted-foreground min-h-[40px] resize-none overflow-hidden uppercase"
                                                            ref={(el) => {
                                                                if (el) {
                                                                    el.style.height = 'auto';
                                                                    el.style.height = el.scrollHeight + 'px';
                                                                }
                                                            }}
                                                            onInput={(e) => {
                                                                const target = e.target as HTMLTextAreaElement;
                                                                target.style.height = 'auto';
                                                                target.style.height = target.scrollHeight + 'px';
                                                            }}
                                                        />
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center justify-center">
                                                        <Input
                                                            type="number"
                                                            min={1}
                                                            value={item.quantity}
                                                            onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                                                            className="w-20 bg-transparent border-none shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 text-center text-foreground"
                                                        />
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex justify-center">
                                                        <ComboboxCreatable
                                                            options={units}
                                                            value={item.unit}
                                                            onSelect={(val) => {
                                                                // Find label for the value if needed, or just use val if we store name directly
                                                                updateItem(index, 'unit', val);
                                                            }}
                                                            onCreate={async (name) => {
                                                                const upperName = name.toUpperCase();
                                                                await createUnitEntry(upperName);
                                                                setUnits([...units, { value: upperName, label: upperName }]);
                                                                return upperName;
                                                            }}
                                                            createLabel="Crear U.M."
                                                            placeholder="U.M."
                                                            searchPlaceholder="Buscar unidad..."
                                                            className="w-24 bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800 border-none shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 px-2 text-center"
                                                        />
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Input
                                                        type="text"
                                                        defaultValue={item.unit_price === 0 ? "" : formatCurrency(item.unit_price)}
                                                        key={`${item.id}-${item.unit_price}`}
                                                        onBlur={(e) => {
                                                            const rawValue = e.target.value.replace(/,/g, '');
                                                            if (!rawValue) {
                                                                updateItem(index, 'unit_price', 0);
                                                                return;
                                                            }
                                                            const numericValue = parseFloat(rawValue);
                                                            if (isNaN(numericValue)) {
                                                                updateItem(index, 'unit_price', 0);
                                                                return;
                                                            }
                                                            updateItem(index, 'unit_price', numericValue);
                                                        }}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            if (/[^0-9.,]/.test(val)) {
                                                                e.target.value = val.replace(/[^0-9.,]/g, '');
                                                            }
                                                        }}
                                                        placeholder="0.00"
                                                        className="bg-transparent border-none shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 text-right text-foreground font-mono"
                                                    />
                                                </TableCell>
                                                <TableCell className="text-right font-mono text-foreground">
                                                    ${formatCurrency(item.total)}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center justify-center">
                                                        <button
                                                            type="button"
                                                            onClick={() => updateItem(index, 'is_sub_item', !item.is_sub_item)}
                                                            className={cn(
                                                                "w-10 h-6 rounded-full transition-colors relative flex items-center px-1 shadow-inner",
                                                                item.is_sub_item ? "bg-red-500" : "bg-zinc-300 dark:bg-zinc-700"
                                                            )}
                                                        >
                                                            <div
                                                                className={cn(
                                                                    "w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200",
                                                                    item.is_sub_item ? "translate-x-4" : "translate-x-0"
                                                                )}
                                                            />
                                                        </button>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center justify-center gap-1">
                                                        {item.drawing_url && (
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => {
                                                                    setViewerUrl(item.drawing_url || null);
                                                                    setViewerTitle(item.description || "Plano sin nombre");
                                                                }}
                                                                className="h-8 w-8 text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                                                                title="Ver Plano"
                                                            >
                                                                <Eye className="w-4 h-4" />
                                                            </Button>
                                                        )}
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => removeItem(index)}
                                                            className="h-8 w-8 p-0 text-red-500/50 hover:text-red-500 hover:bg-red-500/10"
                                                            title="Eliminar"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </Reorder.Item>
                                        ))}
                                    </Reorder.Group>
                                </Table>
                            </div>

                            <div id="quote-items-footer" className="p-4 border-t border-border flex flex-col gap-4">
                                <div className="flex items-center justify-between">
                                    <Button id="quote-add-item-btn" onClick={addItem} variant="outline" className="border-zinc-500/20 text-muted-foreground hover:bg-muted hover:text-foreground shadow-sm">
                                        <Plus className="w-4 h-4 mr-2" />
                                        Agregar Fila
                                    </Button>

                                    {formData.quote_type === 'pieces' && (
                                        <div className="flex items-center gap-3">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => dropzoneRef.current?.click()}
                                                className="h-8 border-red-500/20 text-red-500 hover:bg-red-500/10 hover:text-red-600 font-bold uppercase text-[10px] shadow-sm"
                                            >
                                                <UploadCloud className="w-3.5 h-3.5 mr-1.5" />
                                                Cargar Planos
                                            </Button>

                                            <div className="flex items-center gap-3">
                                                <div className="flex items-center gap-2 text-[10px] font-bold text-green-600 uppercase bg-green-500/10 px-2 py-1 rounded border border-green-500/20">
                                                    <FileCheck className="w-3.5 h-3.5" />
                                                    {items.filter(i => i.drawing_url).length} Planos cargados
                                                </div>
                                                <p className="hidden sm:block text-[10px] text-muted-foreground uppercase font-bold tracking-tight opacity-70">
                                                    O arrastra archivos a la tabla
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </Dropzone>
                </CardContent>
            </Card>

            {/* Totals Section */}
            <div className="flex flex-col items-end gap-6">
                <Card id="quote-totals-section" className="w-full md:w-[350px] bg-card border-border">
                    <CardContent className="pt-6 space-y-4">
                        {validationErrors.length > 0 && (
                            <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-md mb-4">
                                <p className="text-red-500 text-xs font-bold uppercase mb-2">Campos Faltantes:</p>
                                <ul className="list-disc list-inside space-y-1">
                                    {validationErrors.map((err, i) => (
                                        <li key={i} className="text-red-400 text-[10px] leading-tight font-medium">{err}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        <div className="flex justify-between items-center text-muted-foreground">
                            <span>Subtotal:</span>
                            <span className="font-mono text-foreground text-lg">${formatCurrency(totals.subtotal)}</span>
                        </div>
                        <div className="flex justify-between items-center text-muted-foreground">
                            <div className="flex items-center gap-2">
                                <span>IVA</span>
                                <Input
                                    type="number"
                                    value={formData.tax_rate === 0 ? "" : formData.tax_rate}
                                    onChange={e => handleFormChange({ tax_rate: e.target.value === "" ? 0 : parseFloat(e.target.value) })}
                                    className="w-16 h-6 px-1 text-center bg-background border-input text-foreground text-xs"
                                    placeholder="0"
                                />
                                <span>%:</span>
                            </div>
                            <span className="font-mono text-foreground text-lg">${formatCurrency(totals.tax)}</span>
                        </div>
                        <Separator className="bg-border" />
                        <div className="flex justify-between items-center">
                            <span className="text-red-500 font-bold text-xl uppercase">Total:</span>
                            <span className="font-mono text-red-500 font-bold text-2xl">${formatCurrency(totals.total)}</span>
                        </div>
                    </CardContent>
                </Card>

                <div id="quote-final-actions" className="flex items-center gap-4">
                    {/* Reset Button (Reiniciar) - Always visible */}
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="outline" className="border-zinc-500/30 font-semibold uppercase">
                                Reiniciar
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="bg-card border-border">
                            <AlertDialogHeader>
                                <AlertDialogTitle className="text-red-500 font-bold uppercase">¿Reiniciar Campos?</AlertDialogTitle>
                                <AlertDialogDescription className="text-muted-foreground">
                                    Se borrará la información capturada en el formulario actual.
                                    {savedQuote ? " El folio de la cotización se mantendrá." : ""}
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel className="border-border hover:bg-muted font-bold uppercase text-xs">Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={handleResetFields} className="bg-red-600 hover:bg-red-700 text-white font-bold uppercase text-xs">
                                    Sí, Reiniciar
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>

                    {/* New Quote Button (Nueva) - Only visible if saved or editing */}
                    {(savedQuote || editingId) && (
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="outline" className="border-blue-500/30 text-blue-500 hover:bg-blue-500/10 font-semibold uppercase">
                                    <Plus className="w-4 h-4 mr-2" />
                                    Nueva
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="bg-card border-border">
                                <AlertDialogHeader>
                                    <AlertDialogTitle className="text-blue-500 font-bold uppercase">¿Nueva Cotización?</AlertDialogTitle>
                                    <AlertDialogDescription className="text-muted-foreground">
                                        Se cerrará la cotización actual y se iniciará una completamente nueva con un folio distinto. Asegúrate de haber guardado cambios.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel className="border-border hover:bg-muted font-bold uppercase text-xs">Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleNewQuote} className="bg-blue-600 hover:bg-blue-700 text-white font-bold uppercase text-xs">
                                        Sí, Crear Nueva
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    )}

                    <div className="flex gap-2">
                        {/* Imprimir PDF - Only visible if saved AND not modified */}
                        {((savedQuote || (editingId && !isClone)) && !isDirty) && (
                            <PDFDownloadLink
                                document={
                                    <QuotePDF
                                        data={{
                                            ...formData,
                                            ...totals,
                                            quote_number: savedQuote?.quote_number || 0,
                                            client_name: clients.find(c => c.value === formData.client_id)?.label || "",
                                            contact_name: allContacts.find(c => c.id === formData.contact_id)?.name || "",
                                            position_name: positions.find(c => c.value === formData.position_id)?.label || "",
                                            area_name: areas.find(c => c.value === formData.area_id)?.label || "",
                                        }}
                                        items={items}
                                    />
                                }
                                fileName={`Cotizacion_COT-${savedQuote?.quote_number}.pdf`}
                            >
                                {/* @ts-ignore - render prop issues in some versions */}
                                {({ loading: pdfLoading }) => (
                                    <Button className="bg-green-600 hover:bg-green-700 text-white min-w-[200px] h-12 text-lg font-bold shadow-lg shadow-green-500/20 animate-in fade-in zoom-in duration-300">
                                        {pdfLoading ? <Loader2 className="w-5 h-5 mr-3 animate-spin" /> : <Printer className="w-5 h-5 mr-3" />}
                                        Imprimir PDF
                                    </Button>
                                )}
                            </PDFDownloadLink>
                        )}

                        {/* Save/Update Button - Hidden if saved AND not modified (no changes to save) */}
                        {(!savedQuote || (editingId && !isClone) || isDirty) && (
                            <Button
                                onClick={handleSave}
                                disabled={saving || (!isDirty && (Boolean(savedQuote) || Boolean(editingId && !isClone)))}
                                className={cn(
                                    "min-w-[220px] h-12 text-lg font-bold shadow-lg transition-all duration-300",
                                    (savedQuote || (editingId && !isClone)) && isDirty
                                        ? "bg-red-600 hover:bg-red-700 text-white shadow-red-500/20 animate-in slide-in-from-right-4"
                                        : "bg-red-600 hover:bg-red-700 text-white shadow-red-500/20"
                                )}
                            >
                                {saving ? <Loader2 className="w-5 h-5 mr-3 animate-spin" /> : <Save className="w-5 h-5 mr-3" />}
                                {(savedQuote || (editingId && !isClone)) && isDirty ? "Actualizar Cambios" : "Guardar Cotización"}
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {/* Confirmation Modal for Back Bridge */}
            <AlertDialog open={showBackConfirm} onOpenChange={setShowBackConfirm}>
                <AlertDialogContent className="bg-card border-border">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-red-500 font-bold uppercase">¿Salir sin guardar?</AlertDialogTitle>
                        <AlertDialogDescription className="text-muted-foreground">
                            Tienes cambios sin guardar. Si sales ahora, perderás la información capturada en el formulario.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="border-border hover:bg-muted font-bold uppercase text-xs">Continuar Editando</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                setIsDirty(false);
                                router.push("/dashboard/ventas");
                            }}
                            className="bg-red-600 hover:bg-red-700 text-white font-bold uppercase text-xs"
                        >
                            Salir y Perder Cambios
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <DrawingViewer
                url={viewerUrl}
                title={viewerTitle}
                onClose={() => {
                    setViewerUrl(null);
                    setViewerTitle("");
                }}
            />
        </div>
    );
}
