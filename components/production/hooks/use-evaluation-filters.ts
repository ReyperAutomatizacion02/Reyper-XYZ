"use client";

import { useState, useMemo, useEffect } from "react";
import { isBefore, isAfter, startOfDay } from "date-fns";
import { compareOrdersByPriority, OrderWithRelations } from "@/lib/scheduling-utils";
import { Database } from "@/utils/supabase/types";
import { type UserPreferences } from "@/hooks/use-user-preferences";

type Order = Database["public"]["Tables"]["production_orders"]["Row"];

export interface EvaluationFiltersState {
    evalSearchQuery: string;
    setEvalSearchQuery: (v: string) => void;
    evalFilterType: "request" | "delivery" | "none";
    setEvalFilterType: (v: "request" | "delivery" | "none") => void;
    evalDateValue: string;
    setEvalDateValue: (v: string) => void;
    evalDateOperator: "before" | "after";
    setEvalDateOperator: (v: "before" | "after") => void;
    clientFilter: string[];
    setClientFilter: (v: string[]) => void;
    treatmentFilter: string;
    setTreatmentFilter: (v: string) => void;
    evalSortDirection: "asc" | "desc";
    setEvalSortDirection: React.Dispatch<React.SetStateAction<"asc" | "desc">>;
    evalSortBy: "auto" | "date" | "code" | "both";
    setEvalSortBy: (v: "auto" | "date" | "code" | "both") => void;
    showEvaluated: boolean;
    setShowEvaluated: (v: boolean) => void;
    clearAllFilters: () => void;
    activeFiltersCount: number;
    ordersPendingEvaluation: Order[];
    uniqueClients: string[];
    // Pin feature
    pinnedOrderIds: Set<string>;
    togglePin: (orderId: string) => void;
    searchSuggestions: Order[];
}

interface EvalPrefsContext {
    isLoading: boolean;
    getEvalPrefs: () => NonNullable<UserPreferences["evaluation"]>;
    updateEvalPref: (updates: Partial<UserPreferences["evaluation"]>) => void;
    updateEvalPrefNow: (updates: Partial<UserPreferences["evaluation"]>) => void;
}

export function useEvaluationFilters(
    orders: OrderWithRelations[],
    prefsContext: EvalPrefsContext
): EvaluationFiltersState {
    const [prefsInitialized, setPrefsInitialized] = useState(false);

    const [evalSearchQuery, setEvalSearchQuery] = useState("");
    const [evalFilterType, setEvalFilterType] = useState<"request" | "delivery" | "none">("none");
    const [evalDateValue, setEvalDateValue] = useState("");
    const [evalDateOperator, setEvalDateOperator] = useState<"before" | "after">("after");
    const [clientFilter, setClientFilter] = useState<string[]>([]);
    const [treatmentFilter, setTreatmentFilter] = useState("all");
    const [evalSortDirection, setEvalSortDirection] = useState<"asc" | "desc">("asc");
    const [evalSortBy, setEvalSortBy] = useState<"auto" | "date" | "code" | "both">("auto");
    const [showEvaluated, setShowEvaluated] = useState(false);
    const [pinnedOrderIds, setPinnedOrderIds] = useState<Set<string>>(new Set());

    // Load from Supabase prefs once available
    useEffect(() => {
        if (prefsContext.isLoading || prefsInitialized) return;
        const p = prefsContext.getEvalPrefs();
        if (p.evalFilterType) setEvalFilterType(p.evalFilterType);
        if (p.evalDateValue !== undefined) setEvalDateValue(p.evalDateValue);
        if (p.evalDateOperator) setEvalDateOperator(p.evalDateOperator);
        if (p.clientFilter) setClientFilter(p.clientFilter);
        if (p.treatmentFilter !== undefined) setTreatmentFilter(p.treatmentFilter);
        if (p.evalSortDirection) setEvalSortDirection(p.evalSortDirection);
        if (p.evalSortBy) setEvalSortBy(p.evalSortBy);
        if (p.showEvaluated !== undefined) setShowEvaluated(p.showEvaluated);
        if (p.pinnedOrderIds) setPinnedOrderIds(new Set(p.pinnedOrderIds));
        setPrefsInitialized(true);
    }, [prefsContext.isLoading, prefsInitialized]);

    // Save to Supabase on every filter change (search query excluded — it's transient)
    useEffect(() => {
        if (!prefsInitialized) return;
        prefsContext.updateEvalPref({
            evalFilterType,
            evalDateValue,
            evalDateOperator,
            clientFilter,
            treatmentFilter,
            evalSortDirection,
            evalSortBy,
            showEvaluated,
            pinnedOrderIds: Array.from(pinnedOrderIds),
        });
    }, [
        prefsInitialized,
        evalFilterType,
        evalDateValue,
        evalDateOperator,
        clientFilter,
        treatmentFilter,
        evalSortDirection,
        evalSortBy,
        showEvaluated,
        pinnedOrderIds,
    ]);

    const clearAllFilters = () => {
        const cleared = {
            evalFilterType: "none" as const,
            evalDateValue: "",
            evalDateOperator: "after" as const,
            clientFilter: [] as string[],
            treatmentFilter: "all",
            evalSortBy: "auto" as const,
            evalSortDirection: "asc" as const,
        };
        setEvalSearchQuery("");
        setClientFilter(cleared.clientFilter);
        setTreatmentFilter(cleared.treatmentFilter);
        setEvalFilterType(cleared.evalFilterType);
        setEvalDateValue(cleared.evalDateValue);
        setEvalDateOperator(cleared.evalDateOperator);
        setEvalSortBy(cleared.evalSortBy);
        setEvalSortDirection(cleared.evalSortDirection);
        // Guardar inmediatamente sin esperar el debounce de 1 segundo
        prefsContext.updateEvalPrefNow(cleared);
    };

    const togglePin = (orderId: string) => {
        setPinnedOrderIds((prev) => {
            const next = new Set(prev);
            if (next.has(orderId)) next.delete(orderId);
            else next.add(orderId);
            return next;
        });
    };

    const activeFiltersCount = useMemo(() => {
        let count = 0;
        if (evalSearchQuery) count++;
        if (clientFilter.length > 0) count++;
        if (treatmentFilter !== "all") count++;
        if (evalFilterType !== "none") count++;
        return count;
    }, [evalSearchQuery, clientFilter, treatmentFilter, evalFilterType]);

    // Base filter: everything except search query (so pinned orders bypass search)
    const baseFilter = useMemo(
        () =>
            (o: OrderWithRelations): boolean => {
                const isFinished = o.general_status === "D7-ENTREGADA" || o.general_status === "D8-CANCELADA";
                if (isFinished) return false;
                if (o.material === "ENSAMBLE") return false;

                if (clientFilter.length > 0) {
                    if (!o.projects?.company || !clientFilter.includes(o.projects.company)) return false;
                }

                if (treatmentFilter !== "all") {
                    const hasTreatment = o.treatment && o.treatment !== "" && o.treatment !== "N/A";
                    if (treatmentFilter === "yes" && !hasTreatment) return false;
                    if (treatmentFilter === "no" && hasTreatment) return false;
                }

                const hasEvaluation =
                    o.evaluation && Array.isArray(o.evaluation) && (o.evaluation as unknown[]).length > 0;
                if (showEvaluated ? !hasEvaluation : hasEvaluation) return false;

                if (evalFilterType !== "none" && evalDateValue) {
                    const targetDayStart = startOfDay(new Date(evalDateValue));
                    const orderDateRaw =
                        evalFilterType === "request"
                            ? o.projects?.start_date || o.created_at || ""
                            : o.projects?.delivery_date || o.created_at || "";
                    const orderDayStart = startOfDay(new Date(orderDateRaw));
                    if (evalDateOperator === "before") {
                        if (isAfter(orderDayStart, targetDayStart)) return false;
                    } else {
                        if (isBefore(orderDayStart, targetDayStart)) return false;
                    }
                }

                return true;
            },
        [clientFilter, treatmentFilter, showEvaluated, evalFilterType, evalDateValue, evalDateOperator]
    );

    const sortOrders = useMemo(
        () =>
            (list: OrderWithRelations[]): Order[] => {
                const sorted = [...list];
                sorted.sort((a, b) => {
                    if (evalSortBy === "auto") {
                        const res = compareOrdersByPriority(a, b);
                        return evalSortDirection === "asc" ? res : -res;
                    }

                    const dateA = a.projects?.delivery_date || a.created_at || "";
                    const dateB = b.projects?.delivery_date || b.created_at || "";
                    const codeA = a.part_code || "";
                    const codeB = b.part_code || "";

                    const compareDates = () => {
                        if (dateA === dateB) return 0;
                        return evalSortDirection === "asc" ? (dateA > dateB ? 1 : -1) : dateA < dateB ? 1 : -1;
                    };
                    const compareCodes = () =>
                        evalSortDirection === "asc"
                            ? codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: "base" })
                            : codeB.localeCompare(codeA, undefined, { numeric: true, sensitivity: "base" });

                    if (evalSortBy === "date") return compareDates();
                    if (evalSortBy === "code") return compareCodes();
                    const dr = compareDates();
                    return dr !== 0 ? dr : compareCodes();
                });
                return sorted as Order[];
            },
        [evalSortBy, evalSortDirection]
    );

    const ordersPendingEvaluation = useMemo(() => {
        const searchLower = evalSearchQuery.toLowerCase();

        // Pinned orders: pass base filter only (ignore search so they always show)
        const pinned = sortOrders(orders.filter((o) => pinnedOrderIds.has(o.id) && baseFilter(o)));

        // Non-pinned: pass base filter + search filter
        const rest = sortOrders(
            orders.filter((o) => {
                if (pinnedOrderIds.has(o.id)) return false;
                if (!baseFilter(o)) return false;
                if (evalSearchQuery) {
                    return (
                        o.part_code?.toLowerCase().includes(searchLower) ||
                        o.part_name?.toLowerCase().includes(searchLower)
                    );
                }
                return true;
            })
        );

        return [...pinned, ...rest];
    }, [orders, evalSearchQuery, pinnedOrderIds, baseFilter, sortOrders]);

    // Search suggestions: orders matching query that are not yet pinned
    const searchSuggestions = useMemo((): Order[] => {
        if (!evalSearchQuery || evalSearchQuery.trim().length < 2) return [];
        const searchLower = evalSearchQuery.toLowerCase();
        return orders
            .filter((o) => {
                if (pinnedOrderIds.has(o.id)) return false;
                if (!baseFilter(o)) return false;
                return (
                    o.part_code?.toLowerCase().includes(searchLower) || o.part_name?.toLowerCase().includes(searchLower)
                );
            })
            .slice(0, 6) as Order[];
    }, [evalSearchQuery, orders, pinnedOrderIds, baseFilter]);

    const uniqueClients = useMemo(() => {
        const clients = new Set<string>();
        orders.forEach((o) => {
            if (o.projects?.company) clients.add(o.projects.company);
        });
        return Array.from(clients).sort();
    }, [orders]);

    return {
        evalSearchQuery,
        setEvalSearchQuery,
        evalFilterType,
        setEvalFilterType,
        evalDateValue,
        setEvalDateValue,
        evalDateOperator,
        setEvalDateOperator,
        clientFilter,
        setClientFilter,
        treatmentFilter,
        setTreatmentFilter,
        evalSortDirection,
        setEvalSortDirection,
        evalSortBy,
        setEvalSortBy,
        showEvaluated,
        setShowEvaluated,
        clearAllFilters,
        activeFiltersCount,
        ordersPendingEvaluation,
        uniqueClients,
        pinnedOrderIds,
        togglePin,
        searchSuggestions,
    };
}
