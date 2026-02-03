"use client";

import { useEffect, useState } from "react";
import { Search, FileEdit, Printer, ArrowLeft, History, Filter, Copy, Trash2, Loader2, ArrowUpDown } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardHeader } from "@/components/dashboard-header";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { getQuotesHistory, deleteQuote, getCatalogData, getQuoteById } from "../actions";
import { toast } from "sonner";
import dynamic from "next/dynamic";
import { QuotePDF } from "../components/QuotePDF";

import { pdf } from "@react-pdf/renderer";

interface QuoteSummary {
    id: string;
    quote_number: number;
    issue_date: string;
    total: number;
    currency: string;
    client: { name: string };
    contact: { name: string };
}

export default function QuoteHistoryPage() {
    const [quotes, setQuotes] = useState<QuoteSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [clientFilter, setClientFilter] = useState("all");
    const [clients, setClients] = useState<{ id: string, name: string }[]>([]);
    const [deleteReason, setDeleteReason] = useState("");
    const [isDeleting, setIsDeleting] = useState(false);
    const [fetchingQuoteId, setFetchingQuoteId] = useState<string | null>(null);
    const [quoteToPrint, setQuoteToPrint] = useState<any>(null);
    const [positions, setPositions] = useState<{ id: string, name: string }[]>([]);
    const [areas, setAreas] = useState<{ id: string, name: string }[]>([]);
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [history, catalogs] = await Promise.all([
                getQuotesHistory(),
                getCatalogData()
            ]);
            setQuotes(history as any);
            setClients(catalogs.clients);
            setPositions(catalogs.positions);
            setAreas(catalogs.areas);
        } catch (error: any) {
            toast.error("Error al cargar datos: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!deleteReason.trim()) {
            toast.error("Debes proporcionar una razón para borrar.");
            return;
        }
        setIsDeleting(true);
        try {
            await deleteQuote(id, deleteReason.toUpperCase());
            toast.success("Cotización borrada (el folio ha sido invalidado).");
            setDeleteReason("");
            loadData();
        } catch (error: any) {
            toast.error("Error al borrar: " + error.message);
        } finally {
            setIsDeleting(false);
        }
    };

    const handlePrintRequest = async (quote: QuoteSummary) => {
        setFetchingQuoteId(quote.id);
        try {
            const fullQuote = await getQuoteById(quote.id);
            const doc = (
                <QuotePDF
                    data={{
                        ...fullQuote,
                        client_name: fullQuote.client?.name || clients.find(c => c.id === fullQuote.client_id)?.name || "",
                        contact_name: fullQuote.contact?.name || "",
                        position_name: positions.find(p => p.id === fullQuote.position_id)?.name || "",
                        area_name: areas.find(a => a.id === fullQuote.area_id)?.name || "",
                    }}
                    items={fullQuote.items.map((i: any) => ({
                        ...i,
                        total: i.total_price
                    }))}
                />
            );

            const blob = await pdf(doc).toBlob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `Cotizacion_COT-${quote.quote_number}.pdf`;
            link.click();
            URL.revokeObjectURL(url);

            toast.success("PDF generado exitosamente.");
        } catch (error: any) {
            toast.error("Error al generar PDF: " + error.message);
        } finally {
            setFetchingQuoteId(null);
        }
    };

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const getSortedQuotes = (quotesToSort: QuoteSummary[]) => {
        if (!sortConfig) return quotesToSort;

        return [...quotesToSort].sort((a: any, b: any) => {
            let aValue = a[sortConfig.key];
            let bValue = b[sortConfig.key];

            // Handle nested properties (e.g. client.name)
            if (sortConfig.key === 'client.name') {
                aValue = a.client?.name || "";
                bValue = b.client?.name || "";
            }

            if (aValue < bValue) {
                return sortConfig.direction === 'asc' ? -1 : 1;
            }
            if (aValue > bValue) {
                return sortConfig.direction === 'asc' ? 1 : -1;
            }
            return 0;
        });
    };

    const filteredAndSortedQuotes = getSortedQuotes(quotes.filter(q => {
        const search = searchTerm.toLowerCase();
        const matchesClient = clientFilter === "all" || q.client?.name === clients.find(c => c.id === clientFilter)?.name;

        return matchesClient && (
            `COT-${q.quote_number}`.toLowerCase().includes(search) ||
            q.client?.name.toLowerCase().includes(search)
        );
    }));

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: 'MXN'
        }).format(val);
    };

    if (loading) return <div className="p-8 text-center text-muted-foreground">Cargando historial...</div>;

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-20">
            <DashboardHeader
                title="Historial de Cotizaciones"
                description="Búsqueda, edición y descarga de cotizaciones"
                icon={<History className="w-8 h-8 text-red-500" />}
                backUrl="/dashboard/ventas"
                iconClassName="text-red-500"
                children={
                    <Link href="/dashboard/ventas/cotizador">
                        <Button className="bg-red-600 hover:bg-red-700 text-white font-bold">
                            Nueva Cotización
                        </Button>
                    </Link>
                }
            />

            {/* Filters */}
            <Card className="bg-card border-border border-l-4 border-l-red-500 shadow-sm">
                <CardContent className="pt-6">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar por Folio (COT-...) o Texto..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 bg-background/50 border-border focus:border-red-500 transition-colors uppercase"
                            />
                        </div>
                        <div className="w-full md:w-[250px]">
                            <Select value={clientFilter} onValueChange={setClientFilter}>
                                <SelectTrigger className="bg-background/50 border-border uppercase text-xs font-bold">
                                    <SelectValue placeholder="Filtrar por Cliente" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">TODOS LOS CLIENTES</SelectItem>
                                    {clients.map(c => (
                                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* History Table */}
            <Card className="bg-card border-border overflow-hidden">
                <Table>
                    <TableHeader className="bg-muted/30">
                        <TableRow className="border-border">
                            <TableHead
                                className="w-[120px] font-bold text-red-500 uppercase cursor-pointer hover:bg-muted/50 transition-colors"
                                onClick={() => handleSort('quote_number')}
                            >
                                <div className="flex items-center gap-2">
                                    Folio
                                    <ArrowUpDown className="w-3 h-3 text-muted-foreground" />
                                </div>
                            </TableHead>
                            <TableHead
                                className="font-bold text-foreground cursor-pointer hover:bg-muted/50 transition-colors"
                                onClick={() => handleSort('issue_date')}
                            >
                                <div className="flex items-center gap-2">
                                    Fecha
                                    <ArrowUpDown className="w-3 h-3 text-muted-foreground" />
                                </div>
                            </TableHead>
                            <TableHead
                                className="font-bold text-foreground cursor-pointer hover:bg-muted/50 transition-colors"
                                onClick={() => handleSort('client.name')}
                            >
                                <div className="flex items-center gap-2">
                                    Cliente
                                    <ArrowUpDown className="w-3 h-3 text-muted-foreground" />
                                </div>
                            </TableHead>
                            <TableHead
                                className="text-right font-bold text-foreground cursor-pointer hover:bg-muted/50 transition-colors"
                                onClick={() => handleSort('total')}
                            >
                                <div className="flex items-center justify-end gap-2">
                                    Monto
                                    <ArrowUpDown className="w-3 h-3 text-muted-foreground" />
                                </div>
                            </TableHead>
                            <TableHead className="w-[200px] text-center font-bold text-foreground">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredAndSortedQuotes.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-12 text-muted-foreground italic">
                                    No se encontraron cotizaciones coincidentes.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredAndSortedQuotes.map((q) => (
                                <TableRow key={q.id} className="border-border hover:bg-muted/50 transition-colors">
                                    <TableCell className="font-mono font-bold text-red-400">
                                        COT-{q.quote_number}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {new Date(q.issue_date + "T12:00:00").toLocaleDateString('es-MX', {
                                            day: '2-digit',
                                            month: 'short',
                                            year: 'numeric'
                                        }).toUpperCase()}
                                    </TableCell>
                                    <TableCell className="font-medium uppercase">
                                        {q.client?.name || "---"}
                                    </TableCell>
                                    <TableCell className="text-right font-mono font-bold text-foreground">
                                        {formatCurrency(q.total)} <span className="text-[10px] text-muted-foreground ml-1">{q.currency}</span>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center justify-center gap-2">
                                            <Link href={`/dashboard/ventas/cotizador?id=${q.id}&clone=true`}>
                                                <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-blue-500 hover:bg-blue-500/10 font-semibold text-xs uppercase">
                                                    <Copy className="w-3.5 h-3.5" />
                                                    Duplicar
                                                </Button>
                                            </Link>

                                            <Link href={`/dashboard/ventas/cotizador?id=${q.id}`}>
                                                <Button size="sm" variant="outline" className="h-8 gap-1.5 border-zinc-500/30 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-foreground font-semibold text-xs uppercase">
                                                    <FileEdit className="w-3.5 h-3.5" />
                                                    Editar
                                                </Button>
                                            </Link>

                                            {/* We don't have all data here for PDF, but we could fetch it or just redirect to generator in edit mode */}
                                            {/* For now, just a button that links back to editor where PDF can be generated */}
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-8 gap-1.5 text-zinc-500 hover:bg-zinc-500/10 uppercase text-[10px] font-bold"
                                                disabled={fetchingQuoteId === q.id}
                                                onClick={() => handlePrintRequest(q)}
                                            >
                                                {fetchingQuoteId === q.id ? (
                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                ) : (
                                                    <Printer className="w-3.5 h-3.5" />
                                                )}
                                                {fetchingQuoteId === q.id ? "GENERANDO..." : "IMPRIMIR"}
                                            </Button>

                                            <Dialog>
                                                <DialogTrigger asChild>
                                                    <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-red-500 hover:bg-red-500/10 uppercase text-[10px] font-bold">
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                        Borrar
                                                    </Button>
                                                </DialogTrigger>
                                                <DialogContent className="bg-card border-border">
                                                    <DialogHeader>
                                                        <DialogTitle className="text-red-500 font-bold uppercase">Borrar Cotización COT-{q.quote_number}</DialogTitle>
                                                        <DialogDescription className="text-muted-foreground">
                                                            Esta acción invalidará el folio permanentemente. Debes proporcionar una razón para este fallo.
                                                        </DialogDescription>
                                                    </DialogHeader>
                                                    <div className="py-4">
                                                        <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1 block">Razón del Borrado</label>
                                                        <Textarea
                                                            placeholder="EJ. ERROR EN PRECIOS, CLIENTE CANCELÓ, ETC..."
                                                            value={deleteReason}
                                                            onChange={(e) => setDeleteReason(e.target.value.toUpperCase())}
                                                            className="bg-background border-border uppercase text-sm"
                                                        />
                                                    </div>
                                                    <DialogFooter>
                                                        <Button variant="ghost" className="hover:bg-muted font-bold text-xs" onClick={() => setDeleteReason("")}>CANCELAR</Button>
                                                        <Button
                                                            variant="destructive"
                                                            className="bg-red-600 hover:bg-red-700 font-bold text-xs"
                                                            disabled={isDeleting || !deleteReason.trim()}
                                                            onClick={() => handleDelete(q.id)}
                                                        >
                                                            {isDeleting ? "BORRANDO..." : "CONFIRMAR BORRADO"}
                                                        </Button>
                                                    </DialogFooter>
                                                </DialogContent>
                                            </Dialog>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </Card>
        </div>
    );
}
