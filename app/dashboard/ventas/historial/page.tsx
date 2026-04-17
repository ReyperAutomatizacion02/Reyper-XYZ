"use client";

import { useEffect, useState } from "react";
import {
    Search,
    FileEdit,
    Printer,
    ArrowLeft,
    History,
    Filter,
    Copy,
    Trash2,
    Loader2,
    ArrowUpDown,
    CheckCircle,
    FolderPlus,
    Download,
    XCircle,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardHeader } from "@/components/dashboard-header";
import { useTour } from "@/hooks/use-tour";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
    getQuotesHistory,
    deleteQuote,
    getCatalogData,
    getQuoteById,
    convertQuoteToProject,
    updateQuoteStatus,
} from "../actions";
import { getErrorMessage } from "@/lib/action-result";
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
} from "@/components/ui/alert-dialog";

import { pdf } from "@react-pdf/renderer";
import { CancelQuoteDialog, DeleteQuoteDialog } from "@/components/sales/quote-action-dialogs";
import { QuoteHistoryFilters } from "@/components/sales/quote-history-filters";

interface QuoteSummary {
    id: string;
    quote_number: number;
    issue_date: string | null;
    total: number | null;
    currency: string | null;
    status: string | null;
    quote_type: string | null;
    client: { name: string } | null;
    contact: { name: string } | null;
}

export default function QuoteHistoryPage() {
    const [quotes, setQuotes] = useState<QuoteSummary[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [historyLimit, setHistoryLimit] = useState(0);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [clientFilter, setClientFilter] = useState("all");
    const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
    const [statusFilter, setStatusFilter] = useState("all");
    const [deleteReason, setDeleteReason] = useState("");
    const [isDeleting, setIsDeleting] = useState(false);
    const [fetchingQuoteId, setFetchingQuoteId] = useState<string | null>(null);
    const [quoteToPrint, setQuoteToPrint] = useState<any>(null);
    const [positions, setPositions] = useState<{ id: string; name: string }[]>([]);
    const [areas, setAreas] = useState<{ id: string; name: string }[]>([]);
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);

    // Global dialog states for better performance
    const [quoteToDelete, setQuoteToDelete] = useState<QuoteSummary | null>(null);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    const [quoteToCancel, setQuoteToCancel] = useState<QuoteSummary | null>(null);
    const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    // Subscribe to real-time changes
    useRealtime("sales_quotes", () => {
        loadData();
    });

    const loadData = async () => {
        try {
            const [history, catalogs] = await Promise.all([getQuotesHistory(), getCatalogData()]);
            setQuotes(history.data as QuoteSummary[]);
            setTotalCount(history.totalCount);
            setHistoryLimit(history.limit);
            setClients(catalogs.clients);
            setPositions(catalogs.positions);
            setAreas(catalogs.areas);
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : "Error desconocido";
            toast.error("Error al cargar datos: " + msg);
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
        const deleteResult = await deleteQuote(id, deleteReason.toUpperCase());
        if (deleteResult.success) {
            toast.success("Cotización borrada (el folio ha sido invalidado).");
            setDeleteReason("");
            setIsDeleteDialogOpen(false);
            setQuoteToDelete(null);
            loadData();
        } else {
            toast.error(getErrorMessage(deleteResult.error));
        }
        setIsDeleting(false);
    };

    const handleCancelQuote = async (id: string) => {
        const result = await updateQuoteStatus(id, "cancelled");
        if (result.success) {
            toast.success("Cotización cancelada.");
            setIsCancelDialogOpen(false);
            setQuoteToCancel(null);
            loadData();
        } else {
            toast.error(getErrorMessage(result.error));
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
                        client_name:
                            fullQuote.client?.name || clients.find((c) => c.id === fullQuote.client_id)?.name || "",
                        contact_name: fullQuote.contact?.name || "",
                        position_name: positions.find((p) => p.id === fullQuote.position_id)?.name || "",
                        area_name: areas.find((a) => a.id === fullQuote.area_id)?.name || "",
                    }}
                    items={fullQuote.items.map((i: any) => ({
                        ...i,
                        total: i.total_price,
                    }))}
                />
            );

            const blob = await pdf(doc).toBlob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
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
        let direction: "asc" | "desc" = "asc";
        if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") {
            direction = "desc";
        }
        setSortConfig({ key, direction });
    };

    const getSortedQuotes = (quotesToSort: QuoteSummary[]) => {
        if (!sortConfig) return quotesToSort;

        return [...quotesToSort].sort((a: any, b: any) => {
            let aValue = a[sortConfig.key];
            let bValue = b[sortConfig.key];

            // Handle nested properties (e.g. client.name)
            if (sortConfig.key === "client.name") {
                aValue = a.client?.name || "";
                bValue = b.client?.name || "";
            }

            if (aValue < bValue) {
                return sortConfig.direction === "asc" ? -1 : 1;
            }
            if (aValue > bValue) {
                return sortConfig.direction === "asc" ? 1 : -1;
            }
            return 0;
        });
    };

    const filteredAndSortedQuotes = getSortedQuotes(
        quotes.filter((q) => {
            const search = searchTerm.toLowerCase();
            const matchesClient =
                clientFilter === "all" || q.client?.name === clients.find((c) => c.id === clientFilter)?.name;
            const matchesStatus = statusFilter === "all" || q.status === statusFilter;

            const matchesSearch =
                q.quote_number.toString().includes(searchTerm) ||
                q.client?.name.toLowerCase().includes(searchTerm.toLowerCase());

            return matchesClient && matchesStatus && matchesSearch;
        })
    );

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat("es-MX", {
            style: "currency",
            currency: "MXN",
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
                    issue_date: new Date().toISOString().split("T")[0],
                    total: 25000.5,
                    currency: "MXN",
                    status: "active",
                    quote_type: "services",
                    client: { name: "Cliente Demo S.A." },
                    contact: { name: "Juan Demo" },
                },
            ]);
        }

        const cleanup = () => {
            if (isDemo) setQuotes([]);
        };

        startTour(
            [
                {
                    element: "#history-new-quote-btn",
                    popover: {
                        title: "Nueva Cotización",
                        description: "Crea una nueva cotización desde cero pulsando este botón.",
                        side: "left",
                        align: "start",
                    },
                },
                {
                    element: "#history-search-filter",
                    popover: {
                        title: "Búsqueda y Filtros",
                        description: "Encuentra cotizaciones rápidamente buscando por Folio (COT-...) o Cliente.",
                        side: "bottom",
                        align: "start",
                    },
                },
                {
                    element: "#history-table",
                    popover: {
                        title: "Listado de Historial",
                        description:
                            "Aquí se muestran todas las cotizaciones ordenadas. Puedes reordenar las columnas haciendo clic en sus encabezados.",
                        side: "top",
                        align: "center",
                    },
                },
                {
                    element: "#history-actions-header",
                    popover: {
                        title: "Acciones",
                        description:
                            "En esta columna encontrarás botones para: Duplicar (Crear copia), Editar, Imprimir PDF o Borrar.",
                        side: "left",
                        align: "center",
                    },
                },
            ],
            cleanup
        );
    };

    if (loading) return <div className="p-8 text-center text-muted-foreground">Cargando historial...</div>;

    return (
        <div className="mx-auto max-w-7xl space-y-6 pb-20">
            <DashboardHeader
                title="Historial de Cotizaciones"
                description="Búsqueda, edición y descarga de cotizaciones"
                icon={<History className="h-8 w-8" />}
                backUrl="/dashboard/ventas"
                colorClass="text-red-500"
                bgClass="bg-red-500/10"
                onHelp={handleStartTour}
                children={
                    <Link href="/dashboard/ventas/cotizador">
                        <Button id="history-new-quote-btn" className="bg-red-600 font-bold text-white hover:bg-red-700">
                            Nueva Cotización
                        </Button>
                    </Link>
                }
            />

            <QuoteHistoryFilters
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                clientFilter={clientFilter}
                setClientFilter={setClientFilter}
                statusFilter={statusFilter}
                setStatusFilter={setStatusFilter}
                clients={clients}
            />

            {/* Truncation banner — shown when total records exceed the loaded limit */}
            {totalCount > historyLimit && (
                <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-600 dark:text-amber-400">
                    <Filter className="h-4 w-4 shrink-0" />
                    Mostrando las últimas <strong>{historyLimit}</strong> cotizaciones de <strong>{totalCount}</strong>{" "}
                    en total. Usa los filtros para encontrar registros más antiguos.
                </div>
            )}

            {/* History Table */}
            <Card className="overflow-hidden border-border bg-card" id="history-table">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-muted/30">
                            <TableRow className="border-border">
                                <TableHead
                                    className="w-[120px] cursor-pointer font-bold uppercase text-red-500 transition-colors hover:bg-muted/50"
                                    onClick={() => handleSort("quote_number")}
                                >
                                    <div className="flex items-center gap-2">
                                        Folio
                                        <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                                    </div>
                                </TableHead>
                                <TableHead
                                    className="cursor-pointer font-bold text-foreground transition-colors hover:bg-muted/50"
                                    onClick={() => handleSort("issue_date")}
                                >
                                    <div className="flex items-center gap-2">
                                        Fecha
                                        <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                                    </div>
                                </TableHead>
                                <TableHead
                                    className="cursor-pointer font-bold text-foreground transition-colors hover:bg-muted/50"
                                    onClick={() => handleSort("client.name")}
                                >
                                    <div className="flex items-center gap-2">
                                        Cliente / Proyecto
                                        <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                                    </div>
                                </TableHead>
                                <TableHead
                                    className="cursor-pointer text-right font-bold text-foreground transition-colors hover:bg-muted/50"
                                    onClick={() => handleSort("total")}
                                >
                                    <div className="flex items-center justify-end gap-2">
                                        Monto
                                        <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                                    </div>
                                </TableHead>
                                <TableHead
                                    className="cursor-pointer text-center font-bold text-foreground transition-colors hover:bg-muted/50"
                                    onClick={() => handleSort("status")}
                                >
                                    <div className="flex items-center justify-center gap-2">
                                        Estatus
                                        <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                                    </div>
                                </TableHead>
                                <TableHead
                                    className="w-[180px] text-center font-bold text-foreground"
                                    id="history-actions-header"
                                >
                                    Acciones
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredAndSortedQuotes.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="py-12 text-center italic text-muted-foreground">
                                        No se encontraron cotizaciones coincidentes.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredAndSortedQuotes.map((q) => (
                                    <TableRow key={q.id} className="border-border transition-colors hover:bg-muted/50">
                                        <TableCell className="font-mono font-bold text-red-500">
                                            COT-{q.quote_number}
                                        </TableCell>
                                        <TableCell className="text-xs font-medium text-muted-foreground">
                                            {new Date(q.issue_date + "T12:00:00")
                                                .toLocaleDateString("es-MX", {
                                                    day: "2-digit",
                                                    month: "short",
                                                    year: "numeric",
                                                })
                                                .toUpperCase()}
                                        </TableCell>
                                        <TableCell className="py-3">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold uppercase text-foreground">
                                                    {q.client?.name || "---"}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right font-mono font-bold text-foreground">
                                            {formatCurrency(q.total ?? 0)}{" "}
                                            <span className="ml-1 text-[10px] text-muted-foreground">{q.currency}</span>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Badge
                                                className={cn(
                                                    "px-3 py-1 font-bold uppercase tracking-wider",
                                                    q.status === "approved"
                                                        ? "bg-green-600 text-white hover:bg-green-700"
                                                        : q.status === "cancelled"
                                                          ? "bg-zinc-500 text-white hover:bg-zinc-600"
                                                          : "bg-blue-600 text-white hover:bg-blue-700"
                                                )}
                                            >
                                                {q.status === "approved"
                                                    ? "PROYECTO"
                                                    : q.status === "cancelled"
                                                      ? "CANCELADA"
                                                      : "ACTIVA"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center justify-center gap-2">
                                                {q.status === "active" && (
                                                    <Link href={`/dashboard/ventas/nuevo-proyecto?quoteId=${q.id}`}>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="h-8 w-8 p-0 text-green-500 hover:bg-green-500/10"
                                                            title="Convertir a Proyecto"
                                                        >
                                                            <FolderPlus className="h-4 w-4" />
                                                        </Button>
                                                    </Link>
                                                )}

                                                {q.status === "active" && (
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-8 w-8 p-0 text-zinc-400 hover:bg-red-500/10 hover:text-red-500"
                                                        title="Cancelar Cotización"
                                                        onClick={() => {
                                                            setQuoteToCancel(q);
                                                            setIsCancelDialogOpen(true);
                                                        }}
                                                    >
                                                        <XCircle className="h-4 w-4" />
                                                    </Button>
                                                )}

                                                <Link href={`/dashboard/ventas/cotizador?id=${q.id}&clone=true`}>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-8 w-8 p-0 text-blue-500 hover:bg-blue-500/10"
                                                        title="Duplicar"
                                                    >
                                                        <Copy className="h-3.5 w-3.5" />
                                                    </Button>
                                                </Link>

                                                <Link href={`/dashboard/ventas/cotizador?id=${q.id}`}>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-8 w-8 p-0 text-zinc-500 hover:bg-muted"
                                                        title="Editar"
                                                    >
                                                        <FileEdit className="h-3.5 w-3.5" />
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
                                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                    ) : (
                                                        <Printer className="h-3.5 w-3.5" />
                                                    )}
                                                </Button>

                                                {q.status !== "approved" && (
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-8 w-8 p-0 text-red-500/50 hover:bg-red-500/10 hover:text-red-500"
                                                        title="Borrar"
                                                        onClick={() => {
                                                            setQuoteToDelete(q);
                                                            setIsDeleteDialogOpen(true);
                                                        }}
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
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

            <DeleteQuoteDialog
                quote={quoteToDelete}
                isOpen={isDeleteDialogOpen}
                onOpenChange={setIsDeleteDialogOpen}
                deleteReason={deleteReason}
                setDeleteReason={setDeleteReason}
                isDeleting={isDeleting}
                onDelete={handleDelete}
            />

            <CancelQuoteDialog
                quote={quoteToCancel}
                isOpen={isCancelDialogOpen}
                onOpenChange={setIsCancelDialogOpen}
                onCancel={handleCancelQuote}
            />
        </div>
    );
}
