"use client";

import { useEffect, useState } from "react";
import { Search, FileEdit, Printer, ArrowLeft, History, Filter, Copy, Trash2, Loader2, ArrowUpDown, CheckCircle, FolderPlus, Download, XCircle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardHeader } from "@/components/dashboard-header";
import { useTour } from "@/hooks/use-tour";
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
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { getQuotesHistory, deleteQuote, getCatalogData, getQuoteById, convertQuoteToProject, updateQuoteStatus } from "../actions";
import { toast } from "sonner";
import { useRealtime } from "@/hooks/use-realtime";
import dynamic from "next/dynamic";
import { QuotePDF } from "@/components/sales/quote-pdf";
import { Badge } from "@/components/ui/badge";
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

import { pdf } from "@react-pdf/renderer";

interface QuoteSummary {
    id: string;
    quote_number: number;
    issue_date: string;
    total: number;
    currency: string;
    status: string;
    quote_type: "services" | "pieces";
    client: { name: string };
    contact: { name: string };
}

export default function QuoteHistoryPage() {
    const [quotes, setQuotes] = useState<QuoteSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [clientFilter, setClientFilter] = useState("all");
    const [clients, setClients] = useState<{ id: string, name: string }[]>([]);
    const [statusFilter, setStatusFilter] = useState("all");
    const [deleteReason, setDeleteReason] = useState("");
    const [isDeleting, setIsDeleting] = useState(false);
    const [fetchingQuoteId, setFetchingQuoteId] = useState<string | null>(null);
    const [quoteToPrint, setQuoteToPrint] = useState<any>(null);
    const [positions, setPositions] = useState<{ id: string, name: string }[]>([]);
    const [areas, setAreas] = useState<{ id: string, name: string }[]>([]);
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
    const [convertingId, setConvertingId] = useState<string | null>(null);
    const [isConvertDialogOpen, setIsConvertDialogOpen] = useState(false);
    const [projectNameInput, setProjectNameInput] = useState("");
    const [quoteToConvert, setQuoteToConvert] = useState<QuoteSummary | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    // Subscribe to real-time changes
    useRealtime("sales_quotes", () => {
        loadData();
    });

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

    const handleConvertToProject = async () => {
        if (!quoteToConvert || !projectNameInput.trim()) return;

        setConvertingId(quoteToConvert.id);
        try {
            const result = await convertQuoteToProject(quoteToConvert.id, projectNameInput.trim().toUpperCase());
            toast.success(`Cotización convertida a proyecto: ${result.projectCode}`);
            setIsConvertDialogOpen(false);
            setProjectNameInput("");
            setQuoteToConvert(null);
            loadData();
        } catch (error: any) {
            toast.error("Error al convertir: " + error.message);
        } finally {
            setConvertingId(null);
        }
    };

    const openConvertDialog = (quote: QuoteSummary) => {
        setQuoteToConvert(quote);
        setProjectNameInput(`COT-${quote.quote_number} - ${quote.client?.name || ""}`);
        setIsConvertDialogOpen(true);
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
        const matchesStatus = statusFilter === "all" || q.status === statusFilter;

        const matchesSearch =
            q.quote_number.toString().includes(searchTerm) ||
            q.client?.name.toLowerCase().includes(searchTerm.toLowerCase());

        return matchesClient && matchesStatus && matchesSearch;
    }));

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: 'MXN'
        }).format(val);
    };

    // --- HELP TOUR HANDLER ---
    const { startTour } = useTour();

    const handleStartTour = () => {
        const isDemo = quotes.length === 0;

        if (isDemo) {
            setQuotes([
                {
                    id: "demo-id",
                    quote_number: 1234,
                    issue_date: new Date().toISOString().split('T')[0],
                    total: 25000.50,
                    currency: "MXN",
                    status: "active",
                    quote_type: "services",
                    client: { name: "Cliente Demo S.A." },
                    contact: { name: "Juan Demo" }
                }
            ]);
        }

        const cleanup = () => {
            if (isDemo) setQuotes([]);
        };

        startTour([
            {
                element: "#history-new-quote-btn",
                popover: { title: "Nueva Cotización", description: "Crea una nueva cotización desde cero pulsando este botón.", side: "left", align: "start" }
            },
            {
                element: "#history-search-filter",
                popover: { title: "Búsqueda y Filtros", description: "Encuentra cotizaciones rápidamente buscando por Folio (COT-...) o Cliente.", side: "bottom", align: "start" }
            },
            {
                element: "#history-table",
                popover: { title: "Listado de Historial", description: "Aquí se muestran todas las cotizaciones ordenadas. Puedes reordenar las columnas haciendo clic en sus encabezados.", side: "top", align: "center" }
            },
            {
                element: "#history-actions-header",
                popover: { title: "Acciones", description: "En esta columna encontrarás botones para: Duplicar (Crear copia), Editar, Imprimir PDF o Borrar.", side: "left", align: "center" }
            }
        ], cleanup);
    };

    if (loading) return <div className="p-8 text-center text-muted-foreground">Cargando historial...</div>;

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-20">
            <DashboardHeader
                title="Historial de Cotizaciones"
                description="Búsqueda, edición y descarga de cotizaciones"
                icon={<History className="w-8 h-8" />}
                backUrl="/dashboard/ventas"
                colorClass="text-red-500"
                bgClass="bg-red-500/10"
                onHelp={handleStartTour}
                children={
                    <Link href="/dashboard/ventas/cotizador">
                        <Button id="history-new-quote-btn" className="bg-red-600 hover:bg-red-700 text-white font-bold">
                            Nueva Cotización
                        </Button>
                    </Link>
                }
            />

            {/* Search and Advanced Filters */}
            <Card className="bg-card border-border border-l-4 border-l-red-500 shadow-sm" id="history-search-filter">
                <CardContent className="pt-6">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar por Folio (COT-...) o Cliente..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 bg-background/50 border-border focus:border-red-500 transition-colors uppercase"
                            />
                        </div>

                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className="bg-background/50 border-border font-bold text-xs uppercase flex gap-2">
                                    <Filter className="w-4 h-4" />
                                    Filtros {(clientFilter !== 'all' || statusFilter !== 'all') && (
                                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] text-white">
                                            {(clientFilter !== 'all' ? 1 : 0) + (statusFilter !== 'all' ? 1 : 0)}
                                        </span>
                                    )}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="bg-card border-border sm:w-[350px]" align="end">
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 border-b border-border pb-2">
                                        <Filter className="w-4 h-4 text-red-500" />
                                        <span className="text-xs font-bold uppercase text-red-500">Filtros Avanzados</span>
                                    </div>
                                    <div className="grid gap-4 py-2">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Cliente</label>
                                            <Select value={clientFilter} onValueChange={setClientFilter}>
                                                <SelectTrigger className="bg-background/50 border-border uppercase text-xs font-bold w-full">
                                                    <SelectValue placeholder="Filtrar por Cliente" />
                                                </SelectTrigger>
                                                <SelectContent position="popper" className="max-h-[var(--radix-select-content-available-height)]">
                                                    <SelectItem value="all">TODOS LOS CLIENTES</SelectItem>
                                                    {clients.map(c => (
                                                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Estado</label>
                                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                                <SelectTrigger className="bg-background/50 border-border uppercase text-xs font-bold w-full">
                                                    <SelectValue placeholder="Estatus" />
                                                </SelectTrigger>
                                                <SelectContent position="popper">
                                                    <SelectItem value="all">TODOS LOS ESTADOS</SelectItem>
                                                    <SelectItem value="active">ACTIVA</SelectItem>
                                                    <SelectItem value="approved">PROYECTO</SelectItem>
                                                    <SelectItem value="cancelled">CANCELADA</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <div className="flex justify-end gap-2 border-t border-border pt-4">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-[10px] font-bold uppercase hover:bg-muted h-8"
                                            onClick={() => {
                                                setClientFilter("all");
                                                setStatusFilter("all");
                                                setSearchTerm("");
                                            }}
                                        >
                                            Limpiar Todo
                                        </Button>
                                        <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white font-bold text-[10px] uppercase h-8 px-6">
                                            Aplicar
                                        </Button>
                                    </div>
                                </div>
                            </PopoverContent>
                        </Popover>
                    </div>
                </CardContent>
            </Card>

            {/* History Table */}
            <Card className="bg-card border-border overflow-hidden" id="history-table">
                <div className="overflow-x-auto">
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
                                        Cliente / Proyecto
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
                                <TableHead
                                    className="font-bold text-foreground cursor-pointer hover:bg-muted/50 transition-colors text-center"
                                    onClick={() => handleSort('status')}
                                >
                                    <div className="flex items-center justify-center gap-2">
                                        Estatus
                                        <ArrowUpDown className="w-3 h-3 text-muted-foreground" />
                                    </div>
                                </TableHead>
                                <TableHead className="w-[180px] text-center font-bold text-foreground" id="history-actions-header">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredAndSortedQuotes.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground italic">
                                        No se encontraron cotizaciones coincidentes.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredAndSortedQuotes.map((q) => (
                                    <TableRow key={q.id} className="border-border hover:bg-muted/50 transition-colors">
                                        <TableCell className="font-mono font-bold text-red-500">
                                            COT-{q.quote_number}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground text-xs font-medium">
                                            {new Date(q.issue_date + "T12:00:00").toLocaleDateString('es-MX', {
                                                day: '2-digit',
                                                month: 'short',
                                                year: 'numeric'
                                            }).toUpperCase()}
                                        </TableCell>
                                        <TableCell className="py-3">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-sm uppercase text-foreground">{q.client?.name || "---"}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right font-mono font-bold text-foreground">
                                            {formatCurrency(q.total)} <span className="text-[10px] text-muted-foreground ml-1">{q.currency}</span>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Badge className={cn(
                                                "font-bold px-3 py-1 uppercase tracking-wider",
                                                q.status === 'approved'
                                                    ? "bg-green-600 text-white hover:bg-green-700"
                                                    : q.status === 'cancelled'
                                                        ? "bg-zinc-500 text-white hover:bg-zinc-600"
                                                        : "bg-blue-600 text-white hover:bg-blue-700"
                                            )}>
                                                {q.status === 'approved' ? 'PROYECTO' : q.status === 'cancelled' ? 'CANCELADA' : 'ACTIVA'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center justify-center gap-2">
                                                {q.status === 'active' && (
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        disabled={convertingId === q.id}
                                                        className="h-8 w-8 p-0 text-green-500 hover:bg-green-500/10"
                                                        title="Convertir a Proyecto"
                                                        onClick={() => openConvertDialog(q)}
                                                    >
                                                        {convertingId === q.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FolderPlus className="w-4 h-4" />}
                                                    </Button>
                                                )}

                                                {q.status === 'active' && (
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                className="h-8 w-8 p-0 text-zinc-400 hover:text-red-500 hover:bg-red-500/10"
                                                                title="Cancelar Cotización"
                                                            >
                                                                <XCircle className="w-4 h-4" />
                                                            </Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent className="bg-card border-border">
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle className="text-red-500 font-bold uppercase">¿Cancelar Cotización COT-{q.quote_number}?</AlertDialogTitle>
                                                                <AlertDialogDescription className="text-muted-foreground">
                                                                    Esta acción marcará la cotización como CANCELADA. Podrás seguir viéndola en el historial filtrando por este estado.
                                                                </AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel className="bg-muted hover:bg-muted font-bold text-xs">VOLVER</AlertDialogCancel>
                                                                <AlertDialogAction
                                                                    className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs"
                                                                    onClick={async () => {
                                                                        try {
                                                                            await updateQuoteStatus(q.id, 'cancelled');
                                                                            toast.success("Cotización cancelada.");
                                                                            loadData();
                                                                        } catch (error: any) {
                                                                            toast.error("Error: " + error.message);
                                                                        }
                                                                    }}
                                                                >
                                                                    CONFIRMAR CANCELACIÓN
                                                                </AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                )}

                                                <Link href={`/dashboard/ventas/cotizador?id=${q.id}&clone=true`}>
                                                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-blue-500 hover:bg-blue-500/10" title="Duplicar">
                                                        <Copy className="w-3.5 h-3.5" />
                                                    </Button>
                                                </Link>

                                                <Link href={`/dashboard/ventas/cotizador?id=${q.id}`}>
                                                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-zinc-500 hover:bg-muted" title="Editar">
                                                        <FileEdit className="w-3.5 h-3.5" />
                                                    </Button>
                                                </Link>

                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-8 w-8 p-0 text-muted-foreground hover:bg-muted"
                                                    disabled={fetchingQuoteId === q.id}
                                                    onClick={() => handlePrintRequest(q)}
                                                    title="Imprimir"
                                                >
                                                    {fetchingQuoteId === q.id ? (
                                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                    ) : (
                                                        <Printer className="w-3.5 h-3.5" />
                                                    )}
                                                </Button>

                                                {q.status !== 'approved' && (
                                                    <Dialog>
                                                        <DialogTrigger asChild>
                                                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-500/50 hover:text-red-500 hover:bg-red-500/10" title="Borrar">
                                                                <Trash2 className="w-3.5 h-3.5" />
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
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </Card>

            {/* Conversion Dialog with Project Name Prompt */}
            <Dialog open={isConvertDialogOpen} onOpenChange={setIsConvertDialogOpen}>
                <DialogContent className="bg-card border-border sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle className="text-green-500 font-bold uppercase flex items-center gap-2">
                            <FolderPlus className="w-5 h-5" />
                            Convertir a Proyecto
                        </DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            Define el nombre del nuevo proyecto basado en la cotización <span className="text-red-500 font-bold">COT-{quoteToConvert?.quote_number}</span> para <span className="font-bold">{quoteToConvert?.client?.name}</span>.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-6 space-y-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                                Nombre del Proyecto <span className="text-red-500">*</span>
                            </label>
                            <Input
                                placeholder="EJ. MOLDE DE INYECCIÓN - PROYECTO X"
                                value={projectNameInput}
                                onChange={(e) => setProjectNameInput(e.target.value.toUpperCase())}
                                className="bg-background border-border focus:border-green-500 transition-colors uppercase font-bold"
                                autoFocus
                            />
                        </div>

                        <div className="bg-muted/30 p-4 rounded-lg border border-border space-y-2 text-xs">
                            <p className="font-bold text-muted-foreground uppercase">Este proceso realizará:</p>
                            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                                <li>Generación automática de folio de proyecto.</li>
                                <li>Migración de partidas a producción.</li>
                                <li>Marca la cotización como <span className="text-green-500 font-bold">APROBADA</span>.</li>
                            </ul>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="ghost"
                            className="hover:bg-muted font-bold text-xs"
                            onClick={() => setIsConvertDialogOpen(false)}
                        >
                            CANCELAR
                        </Button>
                        <Button
                            className="bg-green-600 hover:bg-green-700 text-white font-bold text-xs px-8"
                            disabled={convertingId !== null || !projectNameInput.trim()}
                            onClick={handleConvertToProject}
                        >
                            {convertingId ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    CONVIRTIENDO...
                                </>
                            ) : (
                                "CONFIRMAR CONVERSIÓN"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
