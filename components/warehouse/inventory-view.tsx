
"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Search, Package, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function InventoryView() {
    const supabase = createClient();
    const [searchTerm, setSearchTerm] = useState("");
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchInventory = async () => {
        setLoading(true);
        let query = supabase
            .from('inventory_items')
            .select('*')
            .order('key', { ascending: true })
            .limit(100);

        if (searchTerm) {
            query = supabase
                .from('inventory_items')
                .select('*')
                .or(`key.ilike.%${searchTerm}%,name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`)
                .limit(100);
        }

        const { data, error } = await query;
        if (data) setItems(data);
        setLoading(false);
    };

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            fetchInventory();
        }, 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);

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
                        ) : items.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="h-24 text-center">
                                    No se encontraron resultados.
                                </TableCell>
                            </TableRow>
                        ) : (
                            items.map((item) => (
                                <TableRow key={item.id}>
                                    <TableCell className="font-medium font-mono text-xs">
                                        {item.key}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-medium">{item.name}</span>
                                            {item.name !== item.description && (
                                                <span className="text-xs text-muted-foreground truncate max-w-[400px]">
                                                    {item.description}
                                                </span>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {item.metadata?.brand && (
                                            <Badge variant="outline" className="text-xs">
                                                {item.metadata.brand}
                                            </Badge>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <Badge variant={item.stock_quantity <= item.min_stock ? "destructive" : "secondary"}>
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
            <div className="text-xs text-muted-foreground text-center">
                Mostrando los primeros {items.length} resultados. Usa el buscador para encontrar ítems específicos.
            </div>
        </div>
    );
}
