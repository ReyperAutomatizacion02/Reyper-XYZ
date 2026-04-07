"use client";

import React, { useEffect, useState, useRef, forwardRef, type ReactNode } from "react";
import {
    Plus,
    Trash2,
    Save,
    FileText,
    ArrowLeft,
    Loader2,
    Printer,
    ChevronLeft,
    ChevronRight,
    Eye,
    Copy,
    FileEdit,
    FileCheck,
    UploadCloud,
    ZoomIn,
    ZoomOut,
    Maximize,
    X,
    GripVertical,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { DateSelector } from "@/components/ui/date-selector";
import { Label } from "@/components/ui/label";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { SharedItemsTable, SharedItemProps } from "../components/shared-items-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardHeader } from "@/components/dashboard-header";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import dynamic from "next/dynamic";

import { ComboboxCreatable, Option } from "@/components/sales/combobox-creatable";
import {
    createClientEntry,
    createContactEntry,
    createPositionEntry,
    createAreaEntry,
    createUnitEntry,
    createMaterialEntry,
    createTreatmentEntry,
    getCatalogData,
    saveQuote,
    getQuoteById,
    updateQuote,
} from "../actions";
import { getErrorMessage } from "@/lib/action-result";

import { QuotePDF } from "@/components/sales/quote-pdf";
import { DrawingViewer } from "@/components/sales/drawing-viewer";
import { createClient } from "@/utils/supabase/client";
import { useTour } from "@/hooks/use-tour";
import { Dropzone } from "@/components/sales/dropzone";

const PDFDownloadLink = dynamic(() => import("@react-pdf/renderer").then((mod) => mod.PDFDownloadLink), {
    ssr: false,
    loading: () => (
        <Button disabled variant="outline">
            Cargando PDF...
        </Button>
    ),
});

type QuoteItem = {
    id: string; // Temporary ID for UI
    description: string;
    part_name?: string;
    material?: string;
    material_id?: string;
    treatment_id?: string;
    treatment_name?: string;
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
    const [allContacts, setAllContacts] = useState<{ id: string; name: string; client_id?: string | null }[]>([]);
    const [positions, setPositions] = useState<Option[]>([]);
    const [areas, setAreas] = useState<Option[]>([]);
    const [units, setUnits] = useState<{ value: string; label: string }[]>([]);
    const [materials, setMaterials] = useState<Option[]>([]);
    const [treatments, setTreatments] = useState<Option[]>([]);
    const dropzoneRef = useRef<HTMLInputElement>(null);

    // Form State
    const [formData, setFormData] = useState<IQuoteForm>({
        quote_as: "DMR",
        quote_type: "services",
        requisition_no: "",
        part_no: "",
        issue_date: new Date().toISOString().split("T")[0],
        delivery_date: "",
        currency: "MXN",
        client_id: "",
        contact_id: "",
        payment_terms_days: 30,
        position_id: "",
        area_id: "",
        validity_days: 30,
        tax_rate: 16,
    });

    // Filtered Contacts Logic
    const filteredContacts = allContacts
        .filter((c) => !formData.client_id || c.client_id === formData.client_id)
        .map((c) => ({ value: c.id, label: c.name }));

    // Items State
    const [items, setItems] = useState<QuoteItem[]>([
        {
            id: "1",
            description: "",
            part_name: "",
            material: "",
            material_id: "",
            treatment_id: "",
            treatment_name: "",
            quantity: 1,
            unit: "PZA",
            unit_price: 0,
            total: 0,
        },
    ]);

    // Totals
    const [totals, setTotals] = useState({ subtotal: 0, tax: 0, total: 0 });
    const [savedQuote, setSavedQuote] = useState<{ id: string; quote_number: number } | null>(null);
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
            total: sub + tax,
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

        files.forEach((file) => {
            const fileName = file.name.substring(0, file.name.lastIndexOf(".")) || file.name;
            const upperName = fileName.toUpperCase();

            // Check if this file name already exists as an item WITH a drawing_url (already uploaded or blob)
            const exists = items.some(
                (item) =>
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
                description: "", // Leave blank for the user
                part_name: "",
                material: "",
                treatment_id: "",
                design_no: upperName, // Assignment here instead of description
                quantity: 1,
                unit: "PZA",
                unit_price: 0,
                total: 0,
                drawing_url:
                    URL.createObjectURL(file) +
                    (file.type.includes("pdf") || file.name.toLowerCase().endsWith(".pdf") ? "#pdf" : ""),
            });
        });

        if (newItems.length === 0) {
            if (ignoredFiles.length > 0) {
                toast.info("Los archivos ya existen en la lista y no fueron agregados de nuevo.");
            }
            return;
        }

        // Update pendingFiles once
        setPendingFiles((prev) => {
            const updated = new Map(prev);
            newPendingFiles.forEach((file, id) => updated.set(id, file));
            return updated;
        });

        setItems((prev) => {
            // Remove initial empty item if it's there and empty
            const filtered = prev.filter((i) => i.description !== "" || i.unit_price > 0);
            return [...filtered, ...newItems];
        });

        if (ignoredFiles.length > 0) {
            toast.success(
                `${processedFiles.length} archivos agregados. ${ignoredFiles.length} omitidos por ya existir.`
            );
        } else {
            toast.success(`${processedFiles.length} archivos procesados localmente.`);
        }
        setIsDirty(true);
    };

    const uploadPendingFiles = async (quoteId: string): Promise<Record<string, string>> => {
        const results: Record<string, string> = {};

        for (const [id, file] of pendingFiles.entries()) {
            const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;
            const filePath = `${quoteId}/${fileName}`;

            const { error: uploadError } = await supabase.storage.from("quotes").upload(filePath, file);

            if (uploadError) {
                console.error(`Error uploading ${file.name}:`, uploadError);
                throw new Error(`Fallo al subir ${file.name}`);
            }

            const {
                data: { publicUrl },
            } = supabase.storage.from("quotes").getPublicUrl(filePath);

            results[id] = publicUrl;
        }

        return results;
    };

    // Helper to format numbers with commas
    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat("es-MX", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(val);
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
            const missingPartNames: string[] = [];
            const missingMaterials: string[] = [];
            const missingTreatments: string[] = [];
            const invalidQuantities: string[] = [];
            const invalidPrices: string[] = [];

            items.forEach((item, idx) => {
                const lot = getLotNumber(idx);
                // description is now optional, removed validation

                if (formData.quote_type === "pieces") {
                    if (!item.part_name?.trim()) missingPartNames.push(lot);
                    if (!item.material?.trim()) missingMaterials.push(lot);
                    if (!item.treatment_id?.trim()) missingTreatments.push(lot);
                }
                if (item.quantity <= 0) invalidQuantities.push(lot);
                if (item.unit_price <= 0) invalidPrices.push(lot);
            });

            if (missingPartNames.length > 0) {
                errors.push(`Nombre de Pieza vacío: Partida ${missingPartNames.join(", ")}`);
            }
            if (missingMaterials.length > 0) {
                errors.push(`Material vacío: Partida ${missingMaterials.join(", ")}`);
            }
            if (missingTreatments.length > 0) {
                errors.push(`Tratamiento vacío: Partida ${missingTreatments.join(", ")}`);
            }
            if (invalidQuantities.length > 0) {
                errors.push(`Cantidad inválida: Partida ${invalidQuantities.join(", ")}`);
            }
            if (invalidPrices.length > 0) {
                errors.push(`Precio Unitario inválido o vacío: Partida ${invalidPrices.join(", ")}`);
            }
        }
        return errors;
    };

    const validationErrors = getValidationErrors();

    // Load Catalogs & Existing Quote on Mount
    useEffect(() => {
        async function loadAll() {
            try {
                const catalog = await getCatalogData();
                setClients(catalog.clients.map((c) => ({ value: c.id, label: c.name })));
                setAllContacts(catalog.contacts); // Store raw contacts for filtering
                setPositions(catalog.positions.map((c) => ({ value: c.id, label: c.name })));
                setAreas(catalog.areas.map((c) => ({ value: c.id, label: c.name })));
                setUnits(catalog.units.map((c) => ({ value: c.name, label: c.name })));
                setMaterials(catalog.materials.map((c) => ({ value: c.id, label: c.name })));
                setTreatments(catalog.treatments.map((c) => ({ value: c.id, label: c.name })));

                if (editingId) {
                    const existing = await getQuoteById(editingId);
                    // Pre-fill form
                    setFormData({
                        quote_as: existing.quote_as ?? "",
                        quote_type: (existing.quote_type as "services" | "pieces") || "services",
                        requisition_no: existing.requisition_no ?? "",
                        part_no: existing.part_no ?? "",
                        issue_date: existing.issue_date ?? "",
                        delivery_date: existing.delivery_date ?? "",
                        currency: existing.currency ?? "",
                        client_id: existing.client_id ?? "",
                        contact_id: existing.contact_id ?? "",
                        payment_terms_days: existing.payment_terms_days ?? 0,
                        position_id: existing.position_id ?? "",
                        area_id: existing.area_id ?? "",
                        validity_days: existing.validity_days ?? 0,
                        tax_rate: (existing.tax_rate ?? 0) * 100, // Convert back to %
                    });

                    // Pre-fill items
                    setItems(
                        existing.items.map((i: any) => ({
                            id: Math.random().toString(),
                            description: i.description,
                            part_name: i.part_name || "",
                            material: i.material || "",
                            material_id: i.material_id || "",
                            treatment_id: i.treatment_id || "",
                            treatment_name: i.treatment || i.treatment_name || "",
                            quantity: i.quantity,
                            unit: i.unit,
                            unit_price: i.unit_price,
                            total: i.total_price,
                            design_no: i.design_no,
                            drawing_url: i.drawing_url,
                            is_sub_item: i.is_sub_item || false,
                        }))
                    );

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
            const currentContact = allContacts.find((c) => c.id === formData.contact_id);
            if (currentContact && currentContact.client_id !== updates.client_id) {
                updates.contact_id = "";
            }
        }
        setFormData((prev) => ({ ...prev, ...updates }));
        setIsDirty(true);
    };

    // Logic: Add Item
    const addItem = () => {
        setIsDirty(true);
        setItems([
            ...items,
            {
                id: Math.random().toString(),
                description: "",
                part_name: "",
                material: "",
                material_id: "",
                treatment_id: "",
                treatment_name: "",
                quantity: 1,
                unit: "PZA",
                unit_price: 0,
                total: 0,
            },
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
            if (itemToRemove.drawing_url?.startsWith("blob:")) {
                URL.revokeObjectURL(itemToRemove.drawing_url.split("#")[0]);
                setPendingFiles((prev) => {
                    const updated = new Map(prev);
                    updated.delete(itemToRemove.id);
                    return updated;
                });
            }

            const resetItem: QuoteItem = {
                id: Math.random().toString(36).substr(2, 9),
                description: "",
                part_name: "",
                material: "",
                treatment_id: "",
                quantity: 1,
                unit: "PZA",
                unit_price: 0,
                total: 0,
                drawing_url: undefined,
            };
            setItems([resetItem]);
            if (hadFile) {
                toast.info("Plano removido de la partida", {
                    icon: <FileText className="h-4 w-4 text-zinc-500" />,
                    duration: 2000,
                });
            }
            return;
        }

        // Cleanup if it was a pending file
        if (itemToRemove.drawing_url?.startsWith("blob:")) {
            URL.revokeObjectURL(itemToRemove.drawing_url.split("#")[0]);
            setPendingFiles((prev) => {
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
                icon: <Trash2 className="h-4 w-4 text-red-500" />,
                duration: 2000,
            });
        }
    };

    // Logic: Update Item
    const updateItem = (index: number, updates: Partial<QuoteItem>) => {
        setIsDirty(true);
        setItems((prevItems) => {
            const newItems = [...prevItems];
            const item = { ...newItems[index], ...updates };

            // Force uppercase for description if updated
            if (updates.description !== undefined && typeof updates.description === "string") {
                item.description = updates.description.toUpperCase();
            }

            // Recalculate row total
            if (updates.quantity !== undefined || updates.unit_price !== undefined) {
                item.total = item.quantity * item.unit_price;
            }

            newItems[index] = item;
            return newItems;
        });
    };

    // Logic: Full Reset (Nuevo) - Clears everything including ID/Folio to start fresh
    const handleNewQuote = () => {
        setFormData({
            quote_as: "DMR",
            quote_type: "services",
            requisition_no: "",
            part_no: "",
            issue_date: new Date().toISOString().split("T")[0],
            delivery_date: "",
            currency: "MXN",
            client_id: "",
            contact_id: "",
            payment_terms_days: 30,
            position_id: "",
            area_id: "",
            validity_days: 30,
            tax_rate: 16,
        });
        setItems([
            {
                id: "1",
                description: "",
                part_name: "",
                material: "",
                material_id: "",
                treatment_id: "",
                treatment_name: "",
                quantity: 1,
                unit: "PZA",
                unit_price: 0,
                total: 0,
            },
        ]);
        setSavedQuote(null);
        setIsDirty(false);
        // If we were editing, we should probably push to the base URL to clear the ID query param
        if (editingId) {
            router.push("/dashboard/ventas/cotizador");
        }
        document.getElementById("cotizador-top")?.scrollIntoView({ behavior: "smooth" });
        toast.info("Nueva cotización iniciada.");
    };

    // Logic: Reset Fields (Reiniciar) - Clears inputs but keeps current session/folio if exists
    const handleResetFields = () => {
        setFormData({
            quote_as: "DMR",
            quote_type: "services",
            requisition_no: "",
            part_no: "",
            issue_date: new Date().toISOString().split("T")[0],
            delivery_date: "",
            currency: "MXN",
            client_id: "",
            contact_id: "",
            payment_terms_days: 30,
            position_id: "",
            area_id: "",
            validity_days: 30,
            tax_rate: 16,
        });
        setItems([{ id: "1", description: "", quantity: 1, unit: "PZA", unit_price: 0, total: 0 }]);
        // Do NOT clear savedQuote or editingId
        setIsDirty(false);
        document.getElementById("cotizador-top")?.scrollIntoView({ behavior: "smooth" });
        toast.info("Formulario reiniciado (Folio conservado).");
    };

    const handleSave = async () => {
        if (validationErrors.length > 0) {
            document.getElementById("quote-totals-section")?.scrollIntoView({ behavior: "smooth", block: "center" });
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
                quote_as: formData.quote_as || "DMR", // Default fallback
            };

            // Prepare Items for DB (remove UI id, keep others)
            const dbItems = items.map((i) => ({
                description: i.description,
                part_name: i.part_name || "",
                material: i.material || "",
                material_id: i.material_id || null,
                treatment: i.treatment_name || "",
                treatment_id: i.treatment_id || null,
                quantity: i.quantity,
                unit: i.unit,
                unit_price: i.unit_price,
                total_price: i.total,
                design_no: i.design_no,
                drawing_url: i.drawing_url,
                is_sub_item: i.is_sub_item || false,
            }));

            // Determine if we are updating an existing quote
            // We update if we have a URL id (editingId) or if we just saved it in this session (savedQuote.id)
            const currentId = editingId && !isClone ? editingId : savedQuote?.id;

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

                const updateResult = await updateQuote(currentId, dbQuote, finalItems);
                if (!updateResult.success) {
                    toast.error(getErrorMessage(updateResult.error));
                    setSaving(false);
                    return;
                }

                // CRITICAL: Update items state with real URLs so subsequent saves don't use stale blob: URLs
                setItems((prev) =>
                    prev.map((item, idx) => {
                        const realUrl = drawingUrls[item.id];
                        if (realUrl) {
                            // Revoke the old blob URL to free memory
                            if (item.drawing_url?.startsWith("blob:")) {
                                URL.revokeObjectURL(item.drawing_url.split("#")[0]);
                            }
                            return { ...item, drawing_url: realUrl };
                        }
                        return item;
                    })
                );

                toast.success(`Cotización #${savedQuote?.quote_number || ""} actualizada.`);
                setPendingFiles(new Map());
                setIsDirty(false);
            } else {
                // For NEW quotes, we need an ID first to upload files
                // 1. Save initial quote to get ID
                const saveResult = await saveQuote(dbQuote, []); // Insert with NO items first to avoid RLS/Dup issues
                if (!saveResult.success) {
                    toast.error(getErrorMessage(saveResult.error));
                    setSaving(false);
                    return;
                }
                const result = saveResult.data;

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

                const updateResult2 = await updateQuote(result.id, dbQuote, finalItems);
                if (!updateResult2.success) {
                    toast.error(getErrorMessage(updateResult2.error));
                    setSaving(false);
                    return;
                }

                // CRITICAL: Update items state with real URLs so subsequent saves don't use stale blob: URLs
                setItems((prev) =>
                    prev.map((item) => {
                        const realUrl = drawingUrls[item.id];
                        if (realUrl) {
                            if (item.drawing_url?.startsWith("blob:")) {
                                URL.revokeObjectURL(item.drawing_url.split("#")[0]);
                            }
                            return { ...item, drawing_url: realUrl };
                        }
                        return item;
                    })
                );

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
        setLoading(true);
        try {
            const result = await createClientEntry(name);
            if (result.success) {
                const newClientOption = { value: result.data, label: name };
                setClients((prev) => [...prev, newClientOption].sort((a, b) => a.label.localeCompare(b.label)));
                toast.success(`Cliente "${name}" creado exitosamente.`);
                return result.data;
            } else {
                toast.error(getErrorMessage(result.error));
                return null;
            }
        } finally {
            setLoading(false);
        }
    };

    const handleCreateContact = async (name: string) => {
        if (!formData.client_id) {
            toast.error("Selecciona un cliente primero para asociar el usuario.");
            return null;
        }
        setLoading(true);
        try {
            const result = await createContactEntry(name, formData.client_id);
            if (result.success) {
                const newContact = { id: result.data, name: name, client_id: formData.client_id };
                setAllContacts((prev) => [...prev, newContact].sort((a, b) => a.name.localeCompare(b.name)));
                toast.success(`Usuario "${name}" creado exitosamente.`);
                return result.data;
            } else {
                toast.error(getErrorMessage(result.error));
                return null;
            }
        } finally {
            setLoading(false);
        }
    };

    // --- TOUR HANDLER WITH DEMO MODE ---
    const handleStartTour = () => {
        const originalItems = [...items];
        const originalFormData = { ...formData };

        // Inject demo data to ensure all features are visible for the tour
        const exists = items.some((i) => i.id === "tour-demo");
        if (!exists) {
            const demoItem: QuoteItem = {
                id: "tour-demo",
                description: "PIEZA DE PRUEBA (SOLO TOUR)",
                quantity: 5,
                unit: "PZA",
                unit_price: 1250,
                total: 6250,
                drawing_url: "demo-tour-url", // This shows the Eye Icon
                is_sub_item: false,
            };
            setItems([demoItem, ...items]);
        }

        // Ensure we are in pieces mode to show dropzone/upload options
        setFormData((prev) => ({ ...prev, quote_type: "pieces" }));

        startTour(
            [
                {
                    element: "#quote-header-inputs",
                    popover: {
                        title: "Datos de Encabezado",
                        description: "Define quién cotiza, número de parte y requisición.",
                        side: "bottom",
                        align: "start",
                    },
                },
                {
                    element: "#quote-dates-inputs",
                    popover: {
                        title: "Fechas y Moneda",
                        description: "Emisión, entrega estimada y moneda de la oferta.",
                        side: "bottom",
                        align: "start",
                    },
                },
                {
                    element: "#quote-client-inputs",
                    popover: {
                        title: "Cliente y Usuario",
                        description: "Selecciona el cliente y contacto. Puedes crearlos si no existen.",
                        side: "top",
                        align: "start",
                    },
                },
                {
                    element: "#quote-extra-inputs",
                    popover: {
                        title: "Detalles Adicionales",
                        description:
                            "Define el puesto, área y vigencia de la oferta para completar el perfil del cliente.",
                        side: "top",
                        align: "start",
                    },
                },
                {
                    element: "#quote-mode-container",
                    popover: {
                        title: "Modo de Cotización",
                        description:
                            "Crucial: Elige 'Servicios' para venta libre o 'Piezas' si vas a cargar planos detallados.",
                        side: "bottom",
                        align: "end",
                    },
                },
                {
                    element: "#quote-item-grip",
                    popover: {
                        title: "Reordenar Partidas",
                        description:
                            "Puedes arrastrar las filas desde este icono para cambiar su orden en cualquier momento.",
                        side: "right",
                        align: "center",
                    },
                },
                {
                    element: "#quote-items-section",
                    popover: {
                        title: "Detalle de Partidas",
                        description:
                            "Aquí editas descripción, cantidades y precios. Escribe en mayúsculas por estándar.",
                        side: "top",
                        align: "center",
                    },
                },
                {
                    element: "#quote-subitem-toggle",
                    popover: {
                        title: "Uso de Subpartidas",
                        description:
                            "Activa este switch para indentar partidas y desglosar componentes de una pieza principal.",
                        side: "top",
                        align: "center",
                    },
                },
                {
                    element: "#quote-view-drawing-btn",
                    popover: {
                        title: "Visor de Planos",
                        description:
                            "El icono del ojo aparece cuando hay un plano. Úsalo para previsualizar sin salir.",
                        side: "left",
                        align: "center",
                    },
                },
                {
                    element: "#quote-pieces-options",
                    popover: {
                        title: "Opciones de Ingeniería",
                        description:
                            "En modo 'Piezas', puedes cargar planos arrastrándolos a la tabla o usando el botón.",
                        side: "top",
                        align: "end",
                    },
                },
                {
                    element: "#quote-totals-section",
                    popover: {
                        title: "Cálculos e IVA",
                        description: "Verifica montos finales y alertas de validación si faltan datos mandatorios.",
                        side: "left",
                        align: "center",
                    },
                },
                {
                    element: "#quote-final-actions",
                    popover: {
                        title: "Guardado y PDF",
                        description:
                            "Guarda para obtener el folio oficial. Tras guardar, el botón de 'Imprimir PDF' se activará.",
                        side: "top",
                        align: "end",
                    },
                },
            ],
            () => {
                // Callback: Restore original state when tour ends
                setItems(originalItems);
                setFormData(originalFormData);
                setIsDirty(false);
            }
        );
    };

    return (
        <div id="cotizador-top" className="mx-auto max-w-7xl space-y-6 pb-20">
            {/* Header / Nav */}
            <DashboardHeader
                title="Nueva Cotización"
                description="Generar una nueva cotización detallada para clientes"
                icon={<FileText className="h-8 w-8" />}
                onBack={handleBack}
                colorClass="text-red-500"
                bgClass="bg-red-500/10"
                onHelp={handleStartTour}
            />

            {/* General Info Card */}
            <Card id="quote-client-section" className="border-border bg-card">
                <CardHeader className="border-b border-border pb-4">
                    <CardTitle className="flex items-center gap-2 text-lg font-semibold text-red-500">
                        <FileText className="h-5 w-5" />
                        Información General
                    </CardTitle>
                </CardHeader>
                <CardContent id="quote-details-section" className="grid gap-6 pt-6 md:grid-cols-3">
                    {/* Row 1 */}
                    <div
                        id="quote-header-inputs"
                        className="col-span-1 grid grid-cols-1 gap-6 md:col-span-3 md:grid-cols-3"
                    >
                        <div className="space-y-2">
                            <label className="text-xs font-semibold uppercase text-red-500">Cotizar como</label>
                            <Select
                                value={formData.quote_as}
                                onValueChange={(value) => handleFormChange({ quote_as: value })}
                            >
                                <SelectTrigger className="border-input bg-background text-foreground">
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
                            <label className="text-xs font-semibold uppercase text-red-500">No. Parte</label>
                            <Input
                                value={formData.part_no}
                                onChange={(e) => handleFormChange({ part_no: e.target.value.toUpperCase() })}
                                placeholder="PN-X99"
                                className="border-input bg-background uppercase text-foreground"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-semibold uppercase text-red-500">No. Requisición</label>
                            <Input
                                value={formData.requisition_no}
                                onChange={(e) => handleFormChange({ requisition_no: e.target.value.toUpperCase() })}
                                placeholder="Ej. REQ-12345..."
                                className="border-input bg-background uppercase text-foreground"
                            />
                        </div>
                    </div>

                    {/* Row 2 */}
                    <div
                        id="quote-dates-inputs"
                        className="col-span-1 grid grid-cols-1 gap-6 md:col-span-3 md:grid-cols-3"
                    >
                        <div className="space-y-2">
                            <DateSelector
                                label="Fecha de Emisión"
                                labelClassName="text-xs font-semibold text-red-500 uppercase tracking-normal"
                                buttonClassName="bg-background border-input shadow-none"
                                date={formData.issue_date ? new Date(formData.issue_date + "T12:00:00") : undefined}
                                onSelect={(d) => handleFormChange({ issue_date: d ? format(d, "yyyy-MM-dd") : "" })}
                            />
                        </div>
                        <div className="space-y-2">
                            <DateSelector
                                label="Fecha de Entrega"
                                labelClassName="text-xs font-semibold text-red-500 uppercase tracking-normal"
                                buttonClassName="bg-background border-input shadow-none"
                                date={
                                    formData.delivery_date ? new Date(formData.delivery_date + "T12:00:00") : undefined
                                }
                                onSelect={(d) => handleFormChange({ delivery_date: d ? format(d, "yyyy-MM-dd") : "" })}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-semibold uppercase text-red-500">Moneda</label>
                            <Select
                                value={formData.currency}
                                onValueChange={(value) => handleFormChange({ currency: value })}
                            >
                                <SelectTrigger className="border-input bg-background text-foreground">
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
                    <div
                        id="quote-client-inputs"
                        className="col-span-1 grid grid-cols-1 gap-6 md:col-span-3 md:grid-cols-3"
                    >
                        <div className="space-y-2">
                            <label className="text-xs font-semibold uppercase text-red-500">Cliente</label>
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
                            <label className="text-xs font-semibold uppercase text-red-500">Usuario (Contacto)</label>
                            <ComboboxCreatable
                                options={filteredContacts}
                                value={formData.contact_id}
                                onSelect={(val) => handleFormChange({ contact_id: val })}
                                onCreate={handleCreateContact}
                                createLabel="Crear Contacto"
                                placeholder={
                                    formData.client_id ? "Seleccionar Usuario..." : "Selecciona Cliente primero"
                                }
                                disabled={!formData.client_id}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-semibold uppercase text-red-500">
                                Condiciones de Pago (Días)
                            </label>
                            <Input
                                type="number"
                                step={5}
                                value={formData.payment_terms_days}
                                onChange={(e) => handleFormChange({ payment_terms_days: parseInt(e.target.value) })}
                                className="border-input bg-background text-foreground"
                            />
                        </div>
                    </div>

                    {/* Row 4 */}
                    <div
                        id="quote-extra-inputs"
                        className="col-span-1 grid grid-cols-1 gap-6 md:col-span-3 md:grid-cols-3"
                    >
                        <div className="space-y-2">
                            <label className="text-xs font-semibold uppercase text-red-500">Puesto</label>
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
                            <label className="text-xs font-semibold uppercase text-red-500">Área</label>
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
                            <label className="text-xs font-semibold uppercase text-red-500">Vigencia (Días)</label>
                            <Input
                                type="number"
                                step={5}
                                value={formData.validity_days}
                                onChange={(e) => handleFormChange({ validity_days: parseInt(e.target.value) })}
                                className="border-input bg-background text-foreground"
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Items Table Card */}
            <Card className="border-border bg-card">
                <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-4">
                    <CardTitle className="text-lg font-semibold text-red-500">Lotes y/o Items</CardTitle>
                    <div id="quote-mode-container" className="flex items-center gap-3">
                        <label className="text-[10px] font-bold uppercase text-muted-foreground">Modo:</label>
                        <Select
                            value={formData.quote_type}
                            onValueChange={(value: "services" | "pieces") => handleFormChange({ quote_type: value })}
                        >
                            <SelectTrigger className="h-8 w-[200px] border-zinc-500/20 bg-background text-xs font-bold uppercase transition-all focus:ring-red-500/20">
                                <SelectValue placeholder="Seleccionar..." />
                            </SelectTrigger>
                            <SelectContent className="border-border bg-card">
                                <SelectItem value="services" className="text-xs font-bold uppercase">
                                    Servicios (Venta Libre)
                                </SelectItem>
                                <SelectItem value="pieces" className="text-xs font-bold uppercase">
                                    Piezas (Planos)
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardHeader>
                <CardContent className="relative px-0 pt-0">
                    <Dropzone
                        onFilesSelected={onFilesSelected}
                        isUploading={isUploadingFiles}
                        className="rounded-none border-0 p-0 hover:bg-transparent"
                        ref={dropzoneRef}
                    >
                        <div id="quote-items-section" className="group/table relative flex min-h-full flex-col p-0">
                            <div className="flex-1 overflow-x-auto">
                                <SharedItemsTable
                                    mode="quote"
                                    quoteType={formData.quote_type}
                                    items={items as SharedItemProps[]}
                                    units={units}
                                    materials={materials}
                                    treatments={treatments}
                                    onReorder={(newItems) => setItems(newItems as unknown as QuoteItem[])}
                                    onUpdateItem={(indexOrId, data) =>
                                        updateItem(indexOrId as number, data as Partial<QuoteItem>)
                                    }
                                    onDeleteItem={(indexOrId) => removeItem(indexOrId as number)}
                                    onCreateUnit={async (name) => {
                                        const upperName = name.toUpperCase();
                                        await createUnitEntry(upperName);
                                        setUnits([...units, { value: upperName, label: upperName }]);
                                        return upperName;
                                    }}
                                    onCreateMaterial={async (name) => {
                                        const upperName = name.toUpperCase();
                                        const newId = await createMaterialEntry(upperName);
                                        setMaterials([...materials, { value: newId, label: upperName }]);
                                        return newId;
                                    }}
                                    onCreateTreatment={async (name) => {
                                        const upperName = name.toUpperCase();
                                        const newId = await createTreatmentEntry(upperName);
                                        setTreatments([...treatments, { value: newId, label: upperName }]);
                                        return newId;
                                    }}
                                    onViewDocument={(url, title) => {
                                        setViewerUrl(url);
                                        setViewerTitle(title || "Plano sin nombre");
                                    }}
                                    formatCurrency={formatCurrency}
                                    getLotNumber={getLotNumber}
                                />
                            </div>

                            <div id="quote-items-footer" className="flex flex-col gap-4 border-t border-border p-4">
                                <div className="flex items-center justify-between">
                                    <Button
                                        id="quote-add-item-btn"
                                        onClick={addItem}
                                        variant="outline"
                                        className="border-zinc-500/20 text-muted-foreground shadow-sm hover:bg-muted hover:text-foreground"
                                    >
                                        <Plus className="mr-2 h-4 w-4" />
                                        Agregar Fila
                                    </Button>

                                    {formData.quote_type === "pieces" && (
                                        <div id="quote-pieces-options" className="flex items-center gap-3">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => dropzoneRef.current?.click()}
                                                className="h-8 border-red-500/20 text-[10px] font-bold uppercase text-red-500 shadow-sm hover:bg-red-500/10 hover:text-red-600"
                                            >
                                                <UploadCloud className="mr-1.5 h-3.5 w-3.5" />
                                                Cargar Planos
                                            </Button>

                                            <div className="flex items-center gap-3">
                                                <div className="flex items-center gap-2 rounded border border-green-500/20 bg-green-500/10 px-2 py-1 text-[10px] font-bold uppercase text-green-600">
                                                    <FileCheck className="h-3.5 w-3.5" />
                                                    {items.filter((i) => i.drawing_url).length} Planos cargados
                                                </div>
                                                <p className="hidden text-[10px] font-bold uppercase tracking-tight text-muted-foreground opacity-70 sm:block">
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
                <Card id="quote-totals-section" className="w-full border-border bg-card md:w-[350px]">
                    <CardContent className="space-y-4 pt-6">
                        {validationErrors.length > 0 && (
                            <div className="mb-4 rounded-md border border-red-500/20 bg-red-500/10 p-3">
                                <p className="mb-2 text-xs font-bold uppercase text-red-500">Campos Faltantes:</p>
                                <ul className="list-inside list-disc space-y-1">
                                    {validationErrors.map((err, i) => (
                                        <li key={i} className="text-[10px] font-medium leading-tight text-red-400">
                                            {err}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        <div className="flex items-center justify-between text-muted-foreground">
                            <span>Subtotal:</span>
                            <span className="font-mono text-lg text-foreground">
                                ${formatCurrency(totals.subtotal)}
                            </span>
                        </div>
                        <div className="flex items-center justify-between text-muted-foreground">
                            <div className="flex items-center gap-2">
                                <span>IVA</span>
                                <Input
                                    type="number"
                                    value={formData.tax_rate === 0 ? "" : formData.tax_rate}
                                    onChange={(e) =>
                                        handleFormChange({
                                            tax_rate: e.target.value === "" ? 0 : parseFloat(e.target.value),
                                        })
                                    }
                                    className="h-6 w-16 border-input bg-background px-1 text-center text-xs text-foreground"
                                    placeholder="0"
                                />
                                <span>%:</span>
                            </div>
                            <span className="font-mono text-lg text-foreground">${formatCurrency(totals.tax)}</span>
                        </div>
                        <Separator className="bg-border" />
                        <div className="flex items-center justify-between">
                            <span className="text-xl font-bold uppercase text-red-500">Total:</span>
                            <span className="font-mono text-2xl font-bold text-red-500">
                                ${formatCurrency(totals.total)}
                            </span>
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
                        <AlertDialogContent className="border-border bg-card">
                            <AlertDialogHeader>
                                <AlertDialogTitle className="font-bold uppercase text-red-500">
                                    ¿Reiniciar Campos?
                                </AlertDialogTitle>
                                <AlertDialogDescription className="text-muted-foreground">
                                    Se borrará la información capturada en el formulario actual.
                                    {savedQuote ? " El folio de la cotización se mantendrá." : ""}
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel className="border-border text-xs font-bold uppercase hover:bg-muted">
                                    Cancelar
                                </AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={handleResetFields}
                                    className="bg-red-600 text-xs font-bold uppercase text-white hover:bg-red-700"
                                >
                                    Sí, Reiniciar
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>

                    {/* New Quote Button (Nueva) - Only visible if saved or editing */}
                    {(savedQuote || editingId) && (
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button
                                    variant="outline"
                                    className="border-blue-500/30 font-semibold uppercase text-blue-500 hover:bg-blue-500/10"
                                >
                                    <Plus className="mr-2 h-4 w-4" />
                                    Nueva
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="border-border bg-card">
                                <AlertDialogHeader>
                                    <AlertDialogTitle className="font-bold uppercase text-blue-500">
                                        ¿Nueva Cotización?
                                    </AlertDialogTitle>
                                    <AlertDialogDescription className="text-muted-foreground">
                                        Se cerrará la cotización actual y se iniciará una completamente nueva con un
                                        folio distinto. Asegúrate de haber guardado cambios.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel className="border-border text-xs font-bold uppercase hover:bg-muted">
                                        Cancelar
                                    </AlertDialogCancel>
                                    <AlertDialogAction
                                        onClick={handleNewQuote}
                                        className="bg-blue-600 text-xs font-bold uppercase text-white hover:bg-blue-700"
                                    >
                                        Sí, Crear Nueva
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    )}

                    <div className="flex gap-2">
                        {/* Imprimir PDF - Only visible if saved AND not modified */}
                        {(savedQuote || (editingId && !isClone)) && !isDirty && (
                            <PDFDownloadLink
                                document={
                                    <QuotePDF
                                        data={{
                                            ...formData,
                                            ...totals,
                                            quote_number: savedQuote?.quote_number || 0,
                                            client_name:
                                                clients.find((c) => c.value === formData.client_id)?.label || "",
                                            contact_name:
                                                allContacts.find((c) => c.id === formData.contact_id)?.name || "",
                                            position_name:
                                                positions.find((c) => c.value === formData.position_id)?.label || "",
                                            area_name: areas.find((c) => c.value === formData.area_id)?.label || "",
                                        }}
                                        items={items}
                                    />
                                }
                                fileName={`Cotizacion_COT-${savedQuote?.quote_number}.pdf`}
                            >
                                {/* @ts-ignore - render prop issues in some versions */}
                                {({ loading: pdfLoading }) => (
                                    <Button className="h-12 min-w-[200px] bg-green-600 text-lg font-bold text-white shadow-lg shadow-green-500/20 duration-300 animate-in fade-in zoom-in hover:bg-green-700">
                                        {pdfLoading ? (
                                            <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                                        ) : (
                                            <Printer className="mr-3 h-5 w-5" />
                                        )}
                                        Imprimir PDF
                                    </Button>
                                )}
                            </PDFDownloadLink>
                        )}

                        {/* Save/Update Button - Hidden if saved AND not modified (no changes to save) */}
                        {(!savedQuote || (editingId && !isClone) || isDirty) && (
                            <Button
                                onClick={handleSave}
                                disabled={
                                    saving || (!isDirty && (Boolean(savedQuote) || Boolean(editingId && !isClone)))
                                }
                                className={cn(
                                    "h-12 min-w-[220px] text-lg font-bold shadow-lg transition-all duration-300",
                                    (savedQuote || (editingId && !isClone)) && isDirty
                                        ? "bg-red-600 text-white shadow-red-500/20 animate-in slide-in-from-right-4 hover:bg-red-700"
                                        : "bg-red-600 text-white shadow-red-500/20 hover:bg-red-700"
                                )}
                            >
                                {saving ? (
                                    <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                                ) : (
                                    <Save className="mr-3 h-5 w-5" />
                                )}
                                {(savedQuote || (editingId && !isClone)) && isDirty
                                    ? "Actualizar Cambios"
                                    : "Guardar Cotización"}
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {/* Confirmation Modal for Back Bridge */}
            <AlertDialog open={showBackConfirm} onOpenChange={setShowBackConfirm}>
                <AlertDialogContent className="border-border bg-card">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="font-bold uppercase text-red-500">
                            ¿Salir sin guardar?
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-muted-foreground">
                            Tienes cambios sin guardar. Si sales ahora, perderás la información capturada en el
                            formulario.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="border-border text-xs font-bold uppercase hover:bg-muted">
                            Continuar Editando
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                setIsDirty(false);
                                router.push("/dashboard/ventas");
                            }}
                            className="bg-red-600 text-xs font-bold uppercase text-white hover:bg-red-700"
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
                onNext={() => {
                    const attachments = items.filter((i) => i.drawing_url);
                    const currentIdx = attachments.findIndex((i) => i.drawing_url === viewerUrl);
                    if (currentIdx !== -1 && currentIdx < attachments.length - 1) {
                        const nextItem = attachments[currentIdx + 1];
                        setViewerUrl(nextItem.drawing_url!);
                        setViewerTitle(nextItem.description || nextItem.design_no || "Sin nombre");
                    }
                }}
                onPrevious={() => {
                    const attachments = items.filter((i) => i.drawing_url);
                    const currentIdx = attachments.findIndex((i) => i.drawing_url === viewerUrl);
                    if (currentIdx > 0) {
                        const prevItem = attachments[currentIdx - 1];
                        setViewerUrl(prevItem.drawing_url!);
                        setViewerTitle(prevItem.description || prevItem.design_no || "Sin nombre");
                    }
                }}
                hasNext={
                    items.filter((i) => i.drawing_url).findIndex((i) => i.drawing_url === viewerUrl) <
                    items.filter((i) => i.drawing_url).length - 1
                }
                hasPrevious={items.filter((i) => i.drawing_url).findIndex((i) => i.drawing_url === viewerUrl) > 0}
            />
        </div>
    );
}
