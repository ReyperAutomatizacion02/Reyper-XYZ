"use client";

import { useState, useMemo } from "react";
import moment from "moment";
import { compareOrdersByPriority, OrderWithRelations } from "@/lib/scheduling-utils";
import { Database } from "@/utils/supabase/types";

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
}

export function useEvaluationFilters(orders: OrderWithRelations[]): EvaluationFiltersState {
    const [evalSearchQuery, setEvalSearchQuery] = useState("");
    const [evalFilterType, setEvalFilterType] = useState<"request" | "delivery" | "none">("none");
    const [evalDateValue, setEvalDateValue] = useState("");
    const [evalDateOperator, setEvalDateOperator] = useState<"before" | "after">("after");
    const [clientFilter, setClientFilter] = useState<string[]>([]);
    const [treatmentFilter, setTreatmentFilter] = useState("all");
    const [evalSortDirection, setEvalSortDirection] = useState<"asc" | "desc">("asc");
    const [evalSortBy, setEvalSortBy] = useState<"auto" | "date" | "code" | "both">("auto");
    const [showEvaluated, setShowEvaluated] = useState(false);

    const clearAllFilters = () => {
        setEvalSearchQuery("");
        setClientFilter([]);
        setTreatmentFilter("all");
        setEvalFilterType("none");
        setEvalDateValue("");
        setEvalDateOperator("after");
        setEvalSortBy("auto");
        setEvalSortDirection("asc");
    };

    const activeFiltersCount = useMemo(() => {
        let count = 0;
        if (evalSearchQuery) count++;
        if (clientFilter.length > 0) count++;
        if (treatmentFilter !== "all") count++;
        if (evalFilterType !== "none") count++;
        return count;
    }, [evalSearchQuery, clientFilter, treatmentFilter, evalFilterType]);

    const ordersPendingEvaluation = useMemo(() => {
        let filtered = orders.filter(o => {
            const isFinished = o.genral_status === 'D7-ENTREGADA' || o.genral_status === 'D8-CANCELADA';
            if (isFinished) return false;
            if (o.material === 'ENSAMBLE') return false;

            if (evalSearchQuery) {
                const searchLower = evalSearchQuery.toLowerCase();
                const matchesSearch =
                    o.part_code?.toLowerCase().includes(searchLower) ||
                    o.part_name?.toLowerCase().includes(searchLower);
                if (!matchesSearch) return false;
            }

            if (clientFilter.length > 0) {
                const orderWithRelations = o as OrderWithRelations;
                if (!orderWithRelations.projects?.company || !clientFilter.includes(orderWithRelations.projects.company)) return false;
            }

            if (treatmentFilter !== "all") {
                const hasTreatment = o.treatment && o.treatment !== "" && o.treatment !== "N/A";
                if (treatmentFilter === "yes" && !hasTreatment) return false;
                if (treatmentFilter === "no" && hasTreatment) return false;
            }

            const hasEvaluation = o.evaluation && Array.isArray(o.evaluation) && o.evaluation.length > 0;
            if (showEvaluated) {
                if (!hasEvaluation) return false;
            } else {
                if (hasEvaluation) return false;
            }

            if (evalFilterType !== "none" && evalDateValue) {
                const targetDate = moment(evalDateValue);
                const orderWithRelations = o as OrderWithRelations;
                let orderDate;
                if (evalFilterType === "request") {
                    orderDate = moment(orderWithRelations.projects?.start_date || o.created_at);
                } else {
                    orderDate = moment(orderWithRelations.projects?.delivery_date || o.created_at);
                }

                if (evalDateOperator === "before") {
                    if (!orderDate.isSameOrBefore(targetDate, 'day')) return false;
                } else {
                    if (!orderDate.isSameOrAfter(targetDate, 'day')) return false;
                }
            }

            return true;
        });

        filtered.sort((a, b) => {
            if (evalSortBy === "auto") {
                const res = compareOrdersByPriority(a, b);
                return evalSortDirection === "asc" ? res : -res;
            }

            const dateA = (a as OrderWithRelations).projects?.delivery_date || a.created_at || "";
            const dateB = (b as OrderWithRelations).projects?.delivery_date || b.created_at || "";
            const codeA = a.part_code || "";
            const codeB = b.part_code || "";

            const compareDates = () => {
                if (dateA === dateB) return 0;
                if (evalSortDirection === "asc") return dateA > dateB ? 1 : -1;
                return dateA < dateB ? 1 : -1;
            };

            const compareCodes = () => {
                if (evalSortDirection === "asc") {
                    return codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: 'base' });
                }
                return codeB.localeCompare(codeA, undefined, { numeric: true, sensitivity: 'base' });
            };

            if (evalSortBy === "date") return compareDates();
            if (evalSortBy === "code") return compareCodes();

            const dateResult = compareDates();
            if (dateResult !== 0) return dateResult;
            return compareCodes();
        });

        return filtered;
    }, [orders, evalSearchQuery, clientFilter, treatmentFilter, evalSortDirection, evalSortBy, showEvaluated, evalFilterType, evalDateValue, evalDateOperator]);

    const uniqueClients = useMemo(() => {
        const clients = new Set<string>();
        orders.forEach(o => {
            if (o.projects?.company) clients.add(o.projects.company);
        });
        return Array.from(clients).sort();
    }, [orders]);

    return {
        evalSearchQuery, setEvalSearchQuery,
        evalFilterType, setEvalFilterType,
        evalDateValue, setEvalDateValue,
        evalDateOperator, setEvalDateOperator,
        clientFilter, setClientFilter,
        treatmentFilter, setTreatmentFilter,
        evalSortDirection, setEvalSortDirection,
        evalSortBy, setEvalSortBy,
        showEvaluated, setShowEvaluated,
        clearAllFilters,
        activeFiltersCount,
        ordersPendingEvaluation,
        uniqueClients,
    };
}
