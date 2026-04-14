"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Database, type Json } from "@/utils/supabase/types";

type InventoryItem = Database["public"]["Tables"]["inventory_items"]["Row"];

const PAGE_SIZE = 50;

function getBrand(metadata: Json | null): string | null {
    if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
        const brand = (metadata as Record<string, Json>)["brand"];
        return typeof brand === "string" ? brand : null;
    }
    return null;
}

export function InventoryView() {
    const supabase = createClient();
    const [searchTerm, setSearchTerm] = useState("");
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [page, setPage] = useState(0);
    const [totalCount, setTotalCount] = useState(0);

    const fetchInventory = useCallback(
        async (currentPage: number, search: string) => {
            setLoading(true);
            setFetchError(null);

            const from = currentPage * PAGE_SIZE;
            const to = from + PAGE_SIZE - 1;

            let query = supabase
                .from("inventory_items")
                .select("*", { count: "exact" })
                .order("key", { ascending: true })
                .range(from, to);

            if (search) {
                query = supabase
                    .from("inventory_items")
                    .select("*", { count: "exact" })
                    .or(`key.ilike.%${search}%,name.ilike.%${search}%,description.ilike.%${search}%`)
                    .order("key", { ascending: true })
                    .range(from, to);
            }

            const { data, error, count } = await query;

            if (error) {
                setFetchError("No se pudo cargar el inventario. Intenta de nuevo.");
            } else {
                setItems(data ?? []);
                setTotalCount(count ?? 0);
            }
            setLoading(false);
        },
        [supabase]
    );

    // Reset to page 0 whenever the search term changes
    useEffect(() => {
        setPage(0);
    }, [searchTerm]);

    // Debounced fetch — runs when page or searchTerm changes
    useEffect(() => {
        const timer = setTimeout(() => {
            fetchInventory(page, searchTerm);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchTerm, page, fetchInventory]);

    const totalPages = Math.ceil(totalCount / PAGE_SIZE);

    return (
        <div className="space-y-4">
            <div className="flex gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por clave, nombre o descripción..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-8"
                    />
                </div>
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[150px]">Clave</TableHead>
                            <TableHead>Descripción</TableHead>
                            <TableHead className="w-[100px]">Marca</TableHead>
                            <TableHead className="w-[100px]">Stock</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={4} className="h-24 text-center">
                                    Cargando...
                                </TableCell>
                            </TableRow>
                        ) : fetchError ? (
                            <TableRow>
                                <TableCell colSpan={4} className="h-24 text-center text-destructive">
                                    {fetchError}
                                </TableCell>
                            </TableRow>
                        ) : items.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="h-24 text-center">
                                    No se encontraron resultados.
                                </TableCell>
                            </TableRow>
                        ) : (
                            items.map((item) => (
                                <TableRow key={item.id}>
                                    <TableCell className="font-mono text-xs font-medium">{item.key}</TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-medium">{item.name}</span>
                                            {item.description && item.name !== item.description && (
                                                <span className="max-w-[400px] truncate text-xs text-muted-foreground">
                                                    {item.description}
                                                </span>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {getBrand(item.metadata) && (
                                            <Badge variant="outline" className="text-xs">
                                                {getBrand(item.metadata)}
                                            </Badge>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <Badge
                                                variant={
                                                    item.stock_quantity <= item.min_stock ? "destructive" : "secondary"
                                                }
                                            >
                                                {item.stock_quantity}
                                            </Badge>
                                            {item.stock_quantity <= item.min_stock && (
                                                <AlertTriangle className="h-3 w-3 text-destructive" />
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                    {totalCount > 0
                        ? `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, totalCount)} de ${totalCount} ítems`
                        : "Sin resultados"}
                </span>
                {totalPages > 1 && (
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
                            disabled={page === 0 || loading}
                            onClick={() => setPage((p) => p - 1)}
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span>
                            Página {page + 1} de {totalPages}
                        </span>
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
                            disabled={page >= totalPages - 1 || loading}
                            onClick={() => setPage((p) => p + 1)}
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
