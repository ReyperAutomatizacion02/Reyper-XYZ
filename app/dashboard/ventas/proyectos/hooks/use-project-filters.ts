import { useState, useEffect } from "react";

export interface ProjectFilters {
    clients: string[];
    requestors: string[];
    status: string[]; // 'on_time', 'late'
    dateRange: {
        from: Date | undefined;
        to: Date | undefined;
    } | undefined;
    viewMode: 'grid' | 'table';
    sortBy: 'code' | 'name' | 'delivery_date' | 'progress' | 'parts_count';
    sortOrder: 'asc' | 'desc' | 'none';
}

const STORAGE_KEY = "reyper_project_filters_v2";

const DEFAULT_FILTERS: ProjectFilters = {
    clients: [],
    requestors: [],
    status: [],
    dateRange: undefined,
    viewMode: 'grid',
    sortBy: 'delivery_date',
    sortOrder: 'asc'
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

    const toggleSort = (field: ProjectFilters['sortBy']) => {
        setFilters(prev => {
            const isSameField = prev.sortBy === field;
            let nextOrder: ProjectFilters['sortOrder'] = 'asc';

            if (isSameField) {
                if (prev.sortOrder === 'asc') nextOrder = 'desc';
                else if (prev.sortOrder === 'desc') nextOrder = 'asc'; // Cycle back to asc
            }

            return {
                ...prev,
                sortBy: field,
                sortOrder: nextOrder
            };
        });
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
        toggleSort,
        resetFilters,
        activeFilterCount,
        isLoaded
    };
}
