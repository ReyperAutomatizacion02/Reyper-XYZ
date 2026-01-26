"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Save, FileText, ArrowLeft, Loader2, Printer } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { toast } from "sonner";
import dynamic from "next/dynamic";

import { ComboboxCreatable, Option } from "../components/ComboboxCreatable";
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

import { QuotePDF } from "../components/QuotePDF";

const PDFDownloadLink = dynamic(
    () => import("@react-pdf/renderer").then((mod) => mod.PDFDownloadLink),
    {
        ssr: false,
        loading: () => <Button disabled variant="outline">Cargando PDF...</Button>,
    }
);

type QuoteItem = {
    id: string; // Temporary ID for UI
    description: string;
    quantity: number;
    unit: string;
    unit_price: number;
    total: number;
};

export default function QuoteGeneratorPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Cargando...</div>}>
            <QuoteGeneratorContent />
        </Suspense>
    );
}

function QuoteGeneratorContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const editingId = searchParams.get("id");
    const isClone = searchParams.get("clone") === "true";

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [showBackConfirm, setShowBackConfirm] = useState(false);

    // Catalogs
    const [clients, setClients] = useState<Option[]>([]);
    const [contacts, setContacts] = useState<Option[]>([]);
    const [positions, setPositions] = useState<Option[]>([]);
    const [areas, setAreas] = useState<Option[]>([]);
    const [units, setUnits] = useState<Option[]>([]);

    // Form State
    const [formData, setFormData] = useState({
        quote_as: "DMR",
        requisition_no: "",
        part_no: "",
        issue_date: new Date().toISOString().split('T')[0],
        delivery_date: "",
        currency: "MXN",
        client_id: "",
        contact_id: "", // User/Contact Name
        payment_terms_days: 30,
        position_id: "",
        area_id: "",
        validity_days: 30,
        tax_rate: 16
    });

    // Items State
    const [items, setItems] = useState<QuoteItem[]>([
        { id: "1", description: "", quantity: 1, unit: "PZA", unit_price: 0, total: 0 }
    ]);

    // Totals
    const [totals, setTotals] = useState({ subtotal: 0, tax: 0, total: 0 });
    const [savedQuote, setSavedQuote] = useState<{ id: string, quote_number: number } | null>(null);

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
                if (item.unit_price <= 0) errors.push(`Precio Unitario inválido en el LOT ${itemNum}`);
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
                setContacts(catalog.contacts.map(c => ({ value: c.id, label: c.name })));
                setPositions(catalog.positions.map(c => ({ value: c.id, label: c.name })));
                setAreas(catalog.areas.map(c => ({ value: c.id, label: c.name })));
                setUnits(catalog.units.map(c => ({ value: c.name, label: c.name })));

                if (editingId) {
                    const existing = await getQuoteById(editingId);
                    // Pre-fill form
                    setFormData({
                        quote_as: existing.quote_as,
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
                        total: i.total_price
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
    }, [editingId]);

    const handleFormChange = (updates: Partial<typeof formData>) => {
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
        const newItems = [...items];
        newItems.splice(index, 1);
        setItems(newItems);
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

    const resetForm = () => {
        setFormData({
            quote_as: "DMR",
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
        document.getElementById('cotizador-top')?.scrollIntoView({ behavior: 'smooth' });
        toast.info("Formulario reiniciado.");
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
            // The `saveQuote` action expects items without the temporary 'id'
            const dbItems = items.map(i => ({
                description: i.description,
                quantity: i.quantity,
                unit: i.unit,
                unit_price: i.unit_price,
                total_price: i.total
            }));

            if (editingId && !isClone) {
                await updateQuote(editingId, dbQuote, dbItems);
                toast.success(`Cotización #${savedQuote?.quote_number} actualizada.`);
                setIsDirty(false);
            } else {
                const result = await saveQuote(dbQuote, dbItems);
                toast.success(`Cotización #${result.quote_number} generada exitosamente.`);
                setSavedQuote(result);
                setIsDirty(false);
                // If it was a clone, we now have a real ID, so stop cloning mode
                if (isClone) {
                    router.replace(`/dashboard/ventas/cotizador?id=${result.id}`);
                }
            }
            // Do NOT scroll to top here on save

        } catch (error: any) { // Added type for error
            console.error(error);
            toast.error("Error al guardar la cotización: " + error.message); // Added error message
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-muted-foreground">Cargando catálogos...</div>;

    return (
        <div id="cotizador-top" className="space-y-6 max-w-7xl mx-auto pb-20">
            {/* Header / Nav */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={handleBack}>
                        <ArrowLeft className="w-5 h-5 text-muted-foreground" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-foreground">Generar Cotización</h1>
                        <p className="text-muted-foreground">Ventas / Nueva Cotización</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Buttons moved to bottom */}
                </div>
            </div>

            {/* General Info Card */}
            <Card className="bg-card border-border">
                <CardHeader className="pb-4 border-b border-border">
                    <CardTitle className="text-red-500 font-semibold text-lg flex items-center gap-2">
                        <FileText className="w-5 h-5" />
                        Información General
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 grid gap-6 md:grid-cols-3">
                    {/* Row 1 */}
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
                        <label className="text-xs font-semibold text-red-500 uppercase"># No. Requisición</label>
                        <Input
                            value={formData.requisition_no}
                            onChange={e => handleFormChange({ requisition_no: e.target.value.toUpperCase() })}
                            placeholder="REQ-001"
                            className="bg-background border-input text-foreground uppercase"
                        />
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

                    {/* Row 2 */}
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-red-500 uppercase">Fecha de Emisión</label>
                        <Input
                            type="date"
                            value={formData.issue_date}
                            onChange={e => handleFormChange({ issue_date: e.target.value })}
                            className="bg-background border-input text-foreground"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-red-500 uppercase">Fecha de Entrega</label>
                        <Input
                            type="date"
                            value={formData.delivery_date}
                            onChange={e => handleFormChange({ delivery_date: e.target.value })}
                            className="bg-background border-input text-foreground"
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

                    {/* Row 3 - Dynamic Comboboxes */}
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-red-500 uppercase">Cliente</label>
                        <ComboboxCreatable
                            options={clients}
                            value={formData.client_id}
                            onSelect={(val) => handleFormChange({ client_id: val })}
                            onCreate={async (name) => {
                                const upperName = name.toUpperCase();
                                const id = await createClientEntry(upperName);
                                setClients([...clients, { value: id!, label: upperName }]);
                                return id || null;
                            }}
                            createLabel="Crear Cliente"
                            placeholder="Seleccionar Cliente..."
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-red-500 uppercase">Usuario (Contacto)</label>
                        <ComboboxCreatable
                            options={contacts}
                            value={formData.contact_id}
                            onSelect={(val) => handleFormChange({ contact_id: val })}
                            onCreate={async (name) => {
                                const upperName = name.toUpperCase();
                                const id = await createContactEntry(upperName);
                                setContacts([...contacts, { value: id!, label: upperName }]);
                                return id || null;
                            }}
                            createLabel="Crear Contacto"
                            placeholder="Nombre Completo..."
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

                    {/* Row 4 */}
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
                </CardContent>
            </Card>

            {/* Items Table Card */}
            <Card className="bg-card border-border">
                <CardHeader className="pb-4 border-b border-border flex flex-row items-center justify-between">
                    <CardTitle className="text-red-500 font-semibold text-lg">Lotes y/o Items</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 px-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-border hover:bg-muted/50">
                                <TableHead className="w-[50px] text-muted-foreground">LOT</TableHead>
                                <TableHead className="text-muted-foreground">Descripción</TableHead>
                                <TableHead className="w-[120px] text-muted-foreground text-center">Cant</TableHead>
                                <TableHead className="w-[100px] text-muted-foreground text-center">U.M</TableHead>
                                <TableHead className="w-[150px] text-muted-foreground text-right">Precio Unit.</TableHead>
                                <TableHead className="w-[150px] text-muted-foreground text-right">Total</TableHead>
                                <TableHead className="w-[50px] text-muted-foreground"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {items.map((item, index) => (
                                <TableRow key={item.id} className="border-border hover:bg-muted/50">
                                    <TableCell className="font-mono text-muted-foreground text-center font-bold">{index + 1}</TableCell>
                                    <TableCell>
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
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => removeItem(index)}
                                            className="text-red-500/50 hover:text-red-500 hover:bg-red-500/10"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>

                    <div className="p-4 border-t border-border">
                        <Button onClick={addItem} variant="outline" className="border-zinc-500/20 text-muted-foreground hover:bg-muted hover:text-foreground">
                            <Plus className="w-4 h-4 mr-2" />
                            Agregar Fila
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Totals Section */}
            <div className="flex flex-col items-end gap-6">
                <Card className="w-full md:w-[350px] bg-card border-border">
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

                <div className="flex items-center gap-4">
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="outline" className="border-zinc-500/30 font-semibold uppercase">
                                Reiniciar / Nuevo
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="bg-card border-border">
                            <AlertDialogHeader>
                                <AlertDialogTitle className="text-red-500 font-bold uppercase">¿Reiniciar Formulario?</AlertDialogTitle>
                                <AlertDialogDescription className="text-muted-foreground">
                                    Se borrará toda la información capturada y el formulario quedará en blanco. Esta acción no se puede deshacer.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel className="border-border hover:bg-muted font-bold uppercase text-xs">Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={resetForm} className="bg-red-600 hover:bg-red-700 text-white font-bold uppercase text-xs">
                                    Sí, Reiniciar
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>

                    <div className="flex gap-2">
                        {((editingId && !isClone) || savedQuote) && (
                            <PDFDownloadLink
                                document={
                                    <QuotePDF
                                        data={{
                                            ...formData,
                                            ...totals,
                                            quote_number: savedQuote?.quote_number || 0,
                                            client_name: clients.find(c => c.value === formData.client_id)?.label || "",
                                            contact_name: contacts.find(c => c.value === formData.contact_id)?.label || "",
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
                                    <Button className="bg-green-600 hover:bg-green-700 text-white min-w-[180px] h-12 text-lg font-bold shadow-lg shadow-green-500/20">
                                        {pdfLoading ? <Loader2 className="w-5 h-5 mr-3 animate-spin" /> : <Printer className="w-5 h-5 mr-3" />}
                                        Imprimir PDF
                                    </Button>
                                )}
                            </PDFDownloadLink>
                        )}

                        {(!savedQuote || editingId) && (
                            <Button
                                onClick={handleSave}
                                disabled={saving}
                                className="bg-red-600 hover:bg-red-700 text-white min-w-[220px] h-12 text-lg font-bold shadow-lg shadow-red-500/20"
                            >
                                {saving ? <Loader2 className="w-5 h-5 mr-3 animate-spin" /> : <Save className="w-5 h-5 mr-3" />}
                                {editingId && !isClone ? "Actualizar Cambios" : "Guardar Cotización"}
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
        </div>
    );
}
