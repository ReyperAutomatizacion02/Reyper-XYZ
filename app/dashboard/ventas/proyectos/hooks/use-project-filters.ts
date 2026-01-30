import { useState, useEffect } from "react";

export interface ProjectFilters {
    clients: string[];
    requestors: string[];
    status: string[]; // 'on_time', 'late'
    dateRange: {
        from: Date | undefined;
        to: Date | undefined;
    } | undefined;
}

const STORAGE_KEY = "reyper_project_filters_v1";

const DEFAULT_FILTERS: ProjectFilters = {
    clients: [],
    requestors: [],
    status: [],
    dateRange: undefined
};

export function useProjectFilters() {
    const [filters, setFilters] = useState<ProjectFilters>(DEFAULT_FILTERS);
    const [isLoaded, setIsLoaded] = useState(false);

    // Load from LocalStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                // Restore Dates from strings
                if (parsed.dateRange) {
                    parsed.dateRange.from = parsed.dateRange.from ? new Date(parsed.dateRange.from) : undefined;
                    parsed.dateRange.to = parsed.dateRange.to ? new Date(parsed.dateRange.to) : undefined;
                }
                setFilters({ ...DEFAULT_FILTERS, ...parsed });
            } catch (e) {
                console.error("Failed to parse saved filters", e);
            }
        }
        setIsLoaded(true);
    }, []);

    // Save to LocalStorage on change
    useEffect(() => {
        if (isLoaded) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
        }
    }, [filters, isLoaded]);

    const updateFilter = (key: keyof ProjectFilters, value: any) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    const resetFilters = () => {
        setFilters(DEFAULT_FILTERS);
        localStorage.removeItem(STORAGE_KEY);
    };

    const activeFilterCount = [
        filters.clients.length > 0,
        filters.requestors.length > 0,
        filters.status.length > 0,
        filters.dateRange?.from || filters.dateRange?.to
    ].filter(Boolean).length;

    return {
        filters,
        updateFilter,
        resetFilters,
        activeFilterCount,
        isLoaded
    };
}
