"use client";

import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ComboboxCreatable } from "@/components/sales/combobox-creatable";
import { Reorder } from "framer-motion";
import { Eye, GripVertical, Trash2 } from "lucide-react";

export type SharedItemMode = "quote" | "project";

export interface SharedItemProps {
    id: string | number; // To handle both DB IDs and generic IDs
    part_code?: string;
    part_name?: string;
    description?: string;
    quantity: number;
    unit?: string;
    material_id?: string;
    material?: string;
    treatment_id?: string;
    treatment_name?: string;
    design_no?: string;
    unit_price?: number;
    total?: number;
    is_sub_item?: boolean;
    drawing_url?: string;
    // For project viewing mode backwards compat
    code?: string;
    url?: string;
    mimeType?: string;
    stableId?: string;
}

export interface SharedItemsTableProps {
    mode: SharedItemMode;
    // In quote mode, items can be services or pieces. In project mode, it's always pieces behavior.
    quoteType?: "services" | "pieces";
    items: SharedItemProps[];
    units: { value: string, label: string }[];
    materials: { value: string, label: string }[];
    treatments: { value: string, label: string }[];

    // Actions
    onReorder: (newItems: SharedItemProps[]) => void;
    onUpdateItem: (indexOrId: number | string, data: Partial<SharedItemProps>) => void;
    onDeleteItem?: (indexOrId: number | string) => void;
    onCreateUnit?: (name: string) => Promise<string>;
    onCreateMaterial?: (name: string) => Promise<string>;
    onCreateTreatment?: (name: string) => Promise<string>;

    // Viewers
    onViewDocument?: (url: string, title: string, type?: "pdf") => void;

    // Formatting
    formatCurrency?: (value: number) => string;
    getLotNumber: (index: number) => string;
}

export function SharedItemsTable({
    mode,
    quoteType = "pieces",
    items,
    units,
    materials,
    treatments,
    onReorder,
    onUpdateItem,
    onDeleteItem,
    onCreateUnit,
    onCreateMaterial,
    onCreateTreatment,
    onViewDocument,
    formatCurrency = (v) => v.toString(),
    getLotNumber
}: SharedItemsTableProps) {
    const isPieces = mode === "project" || quoteType === "pieces";

    return (
        <div className="overflow-x-auto flex-1">
            <Table className="min-w-[1200px]">
                <TableHeader className="bg-table-header-bg">
                    <TableRow className="hover:bg-transparent border-b-border/50">
                        <TableHead className="w-[40px]"></TableHead>
                        <TableHead className="w-[80px] text-muted-foreground">Partida</TableHead>

                        {isPieces && (
                            <TableHead className="text-muted-foreground min-w-[200px]">Nombre Pza.</TableHead>
                        )}

                        <TableHead className="text-muted-foreground min-w-[300px]">Descripción</TableHead>
                        <TableHead className="text-muted-foreground w-[100px]">Cant.</TableHead>
                        <TableHead className="text-muted-foreground w-[120px]">U.M</TableHead>

                        {isPieces && (
                            <>
                                <TableHead className="text-muted-foreground w-[200px]">Material</TableHead>
                                <TableHead className="text-muted-foreground w-[200px]">Tratamiento</TableHead>
                                <TableHead className="text-muted-foreground w-[200px]">No. Diseño</TableHead>
                            </>
                        )}

                        {mode === "quote" && (
                            <>
                                <TableHead className="min-w-[150px] text-muted-foreground">Precio Unit.</TableHead>
                                <TableHead className="min-w-[150px] text-muted-foreground">Total</TableHead>
                            </>
                        )}

                        <TableHead className="text-muted-foreground w-[80px]">Subp.</TableHead>

                        <TableHead className="w-[120px] text-muted-foreground">Eliminar</TableHead>
                    </TableRow>
                </TableHeader>
                <Reorder.Group
                    axis="y"
                    values={items}
                    onReorder={onReorder}
                    as="tbody"
                    className="contents"
                >
                    {items.map((item, index) => {
                        const identifier = mode === "project" ? item.id : index;
                        const dragKey = item.stableId || item.id || index.toString();

                        return (
                            <Reorder.Item
                                key={dragKey}
                                value={item}
                                as="tr"
                                className={cn(
                                    "transition-colors bg-card",
                                    mode === "project" ? "border-border/50 hover:bg-muted/50" : "border-border hover:bg-muted/50",
                                    item.is_sub_item && (mode === "project" ? "bg-zinc-500/5" : "bg-zinc-50/30 dark:bg-zinc-900/10")
                                )}
                            >
                                <TableCell className="cursor-grab active:cursor-grabbing text-muted-foreground/30 hover:text-red-500 transition-colors w-[40px] p-0 text-center align-top pt-4">
                                    <div id={index === 0 ? "quote-item-grip" : undefined} className="flex justify-center items-center h-full">
                                        <GripVertical className="w-4 h-4" />
                                    </div>
                                </TableCell>

                                <TableCell className={cn(
                                    "font-mono font-bold align-top text-center w-[80px] pt-4",
                                    item.is_sub_item ? "text-red-500 text-xs" : "text-muted-foreground"
                                )}>
                                    {getLotNumber(index)}
                                </TableCell>

                                {isPieces && (
                                    <TableCell className="min-w-[200px] align-top pt-2">
                                        <Textarea
                                            value={item.part_name || ""}
                                            onChange={(e) => onUpdateItem(identifier, { part_name: e.target.value.toUpperCase() })}
                                            placeholder="N. CORTO..."
                                            rows={1}
                                            className="w-full bg-transparent border-none shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 px-0 py-1.5 text-foreground placeholder:text-muted-foreground uppercase resize-none overflow-hidden min-h-[32px] m-0"
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
                                )}

                                <TableCell className="align-top pt-2 min-w-[300px]">
                                    <div className="flex items-start gap-2">
                                        {item.is_sub_item && <span className="text-red-500 mt-1.5">↳</span>}
                                        <Textarea
                                            value={item.description || ""}
                                            onChange={(e) => onUpdateItem(identifier, { description: e.target.value })}
                                            placeholder="DESCRIPCIÓN DETALLADA DEL ARTÍCULO..."
                                            className="w-full bg-transparent border-none shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 px-0 py-1.5 text-foreground placeholder:text-muted-foreground min-h-[32px] resize-none overflow-hidden uppercase m-0"
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

                                <TableCell className="align-top pt-2 w-[120px] px-1 text-center">
                                    <Input
                                        type="number"
                                        min={1}
                                        value={item.quantity}
                                        onChange={(e) => onUpdateItem(identifier, { quantity: parseFloat(e.target.value) || 0 })}
                                        className="h-8 bg-transparent border-none shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 font-medium text-center w-full hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                    />
                                </TableCell>

                                <TableCell className="align-top pt-2">
                                    <ComboboxCreatable
                                        options={units}
                                        value={item.unit || ""}
                                        onSelect={(val: string) => onUpdateItem(identifier, { unit: val })}
                                        onCreate={async (name: string) => {
                                            const upperName = name.toUpperCase();
                                            if (onCreateUnit) {
                                                await onCreateUnit(upperName);
                                            }
                                            return upperName;
                                        }}
                                        createLabel="Crear U.M."
                                        placeholder="U.M."
                                        searchPlaceholder="Buscar unidad..."
                                        className="w-full h-8 bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800 border-none shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 px-2 text-center"
                                    />
                                </TableCell>

                                {isPieces && (
                                    <>
                                        <TableCell className="align-top pt-2 min-w-[200px] px-1">
                                            <ComboboxCreatable
                                                options={materials}
                                                value={item.material_id || ""}
                                                onSelect={(val: string) => {
                                                    const selected = materials.find(m => m.value === val);
                                                    onUpdateItem(identifier, { material_id: val, material: selected?.label || "" });
                                                }}
                                                onCreate={async (name: string) => {
                                                    const upperName = name.toUpperCase();
                                                    if (onCreateMaterial) {
                                                        const newId = await onCreateMaterial(upperName);
                                                        onUpdateItem(identifier, { material_id: newId, material: upperName });
                                                        return newId;
                                                    }
                                                    return "";
                                                }}
                                                createLabel="Crear Material"
                                                placeholder="MATERIAL"
                                                searchPlaceholder="Buscar material..."
                                                className="w-full h-8 bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800 border-none shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 px-2 text-center uppercase"
                                            />
                                        </TableCell>

                                        <TableCell className="align-top pt-2 min-w-[200px] px-1">
                                            <ComboboxCreatable
                                                options={treatments}
                                                value={item.treatment_id || ""}
                                                onSelect={(val: string) => {
                                                    const selected = treatments.find(t => t.value === val);
                                                    onUpdateItem(identifier, { treatment_id: val, treatment_name: selected?.label || "" });
                                                }}
                                                onCreate={async (name: string) => {
                                                    const upperName = name.toUpperCase();
                                                    if (onCreateTreatment) {
                                                        const newId = await onCreateTreatment(upperName);
                                                        onUpdateItem(identifier, { treatment_id: newId, treatment_name: upperName });
                                                        return newId;
                                                    }
                                                    return "";
                                                }}
                                                createLabel="Crear Tratamiento"
                                                placeholder="TRATAMIENTO"
                                                searchPlaceholder="Buscar tratamiento..."
                                                className="w-full h-8 bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800 border-none shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 px-2 text-center uppercase"
                                            />
                                        </TableCell>

                                        <TableCell className="min-w-[200px] align-top pt-2">
                                            <div className="flex items-start justify-center gap-1">
                                                {(item.drawing_url || item.url) && onViewDocument && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => {
                                                            const url = item.drawing_url || item.url || "";
                                                            const title = mode === "project" ? `${item.code || ""} - ${item.design_no || ""}` : (item.description || item.design_no || "Plano sin nombre");
                                                            const type = (item.mimeType?.includes('pdf') ? 'pdf' : undefined) as "pdf" | undefined;
                                                            onViewDocument(url, title, type);
                                                        }}
                                                        id={index === 0 ? "quote-view-drawing-btn" : undefined}
                                                        className={cn(
                                                            "h-8 w-8 shrink-0 mt-0.5 text-red-500 hover:text-red-600 hover:bg-red-500/10 transition-colors",
                                                            mode === "project" && "rounded-full viewer-btn-tour h-9 w-9"
                                                        )}
                                                        title="Ver Plano"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </Button>
                                                )}
                                                <Textarea
                                                    value={item.design_no || ""}
                                                    onChange={(e) => onUpdateItem(identifier, { design_no: e.target.value.toUpperCase() })}
                                                    placeholder="D-101..."
                                                    rows={1}
                                                    className={cn(
                                                        "w-full bg-transparent border-none shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 px-0 py-1.5 text-foreground placeholder:text-muted-foreground font-bold uppercase resize-none overflow-hidden m-0 text-center",
                                                        mode === "project" ? "min-w-[150px] max-w-[350px] min-h-[36px] hover:bg-zinc-100 dark:hover:bg-zinc-800" : "min-h-[32px]"
                                                    )}
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
                                    </>
                                )}

                                {mode === "quote" && (
                                    <>
                                        <TableCell className="align-top pt-2">
                                            <Input
                                                type="text"
                                                defaultValue={item.unit_price === 0 ? "" : formatCurrency(item.unit_price || 0)}
                                                key={`${item.id}-${item.unit_price}`}
                                                onBlur={(e) => {
                                                    const rawValue = e.target.value.replace(/,/g, '');
                                                    if (!rawValue) {
                                                        onUpdateItem(identifier, { unit_price: 0 });
                                                        return;
                                                    }
                                                    const numericValue = parseFloat(rawValue);
                                                    if (isNaN(numericValue)) {
                                                        onUpdateItem(identifier, { unit_price: 0 });
                                                        return;
                                                    }
                                                    onUpdateItem(identifier, { unit_price: numericValue });
                                                }}
                                                onInput={(e) => {
                                                    const val = e.currentTarget.value;
                                                    if (/[^0-9.,]/.test(val)) {
                                                        e.currentTarget.value = val.replace(/[^0-9.,]/g, '');
                                                    }
                                                }}
                                                placeholder="0.00"
                                                className="w-full h-8 bg-transparent border-none shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 text-left text-foreground font-mono"
                                            />
                                        </TableCell>
                                        <TableCell className="text-left font-mono text-foreground align-top pt-3.5 min-w-[150px]">
                                            ${formatCurrency(item.total || 0)}
                                        </TableCell>
                                    </>
                                )}

                                <TableCell className="align-top pt-2 px-4 text-center border-l border-zinc-50 dark:border-zinc-800/10 w-[80px]">
                                    <div className="flex items-center justify-center">
                                        <Switch
                                            checked={item.is_sub_item}
                                            onCheckedChange={(checked) => onUpdateItem(identifier, { is_sub_item: checked })}
                                            className={cn("data-[state=checked]:bg-red-500", mode === "quote" ? "scale-75" : "")}
                                            title="Marcar como sub-partida"
                                        />
                                    </div>
                                </TableCell>

                                <TableCell className="align-top pt-1.5 px-4 text-center">
                                    <div className="flex items-center justify-center">
                                        <button
                                            onClick={() => onDeleteItem && onDeleteItem(identifier)}
                                            className="p-2 text-muted-foreground/40 hover:text-red-500 hover:bg-red-500/10 rounded-md transition-colors"
                                            title="Eliminar ítem"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </TableCell>
                            </Reorder.Item>
                        );
                    })}
                </Reorder.Group>
            </Table>
        </div>
    );
}
