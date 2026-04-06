"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { createClient } from "@/utils/supabase/client";
import { type Json } from "@/utils/supabase/types";

const RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;

// Default preferences structure
export interface UserPreferences {
    sidebar?: {
        isCollapsed?: boolean;
    };
    gantt?: {
        viewMode?: "hour" | "day" | "week";
        selectedMachines?: string[];
        zoomLevel?: number;
        showDependencies?: boolean;
        hideEmptyMachines?: boolean;
        projectFilter?: string[];
        cascadeMode?: boolean;
    };
    evaluation?: {
        evalFilterType?: "request" | "delivery" | "none";
        evalDateValue?: string;
        evalDateOperator?: "before" | "after";
        clientFilter?: string[];
        treatmentFilter?: string;
        evalSortDirection?: "asc" | "desc";
        evalSortBy?: "auto" | "date" | "code" | "both";
        showEvaluated?: boolean;
        pinnedOrderIds?: string[];
    };
}

const DEBOUNCE_MS = 1000;

export function useUserPreferences() {
    const [preferences, setPreferences] = useState<UserPreferences>({});
    const [isLoading, setIsLoading] = useState(true);
    const [userId, setUserId] = useState<string | null>(null);
    const supabase = createClient();
    const saveTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

    // Load preferences on mount (with retry)
    useEffect(() => {
        let cancelled = false;

        const loadPreferences = async () => {
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (cancelled) return;
            if (!user) {
                setIsLoading(false);
                return;
            }

            setUserId(user.id);

            let lastError: unknown = null;
            for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
                const { data, error } = await supabase
                    .from("user_profiles")
                    .select("preferences")
                    .eq("id", user.id)
                    .single();

                if (cancelled) return;

                if (!error) {
                    setPreferences((data?.preferences as UserPreferences) || {});
                    setIsLoading(false);
                    return;
                }

                lastError = error;
                if (attempt < RETRY_ATTEMPTS) {
                    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * attempt));
                }
            }

            console.error("Failed to load user preferences after retries:", lastError);
            toast.error("No se pudieron cargar las preferencias. Algunas configuraciones pueden no estar disponibles.");
            setIsLoading(false);
        };

        loadPreferences().catch((err) => {
            if (!cancelled) {
                console.error("Unexpected error loading preferences:", err);
                setIsLoading(false);
            }
        });

        return () => {
            cancelled = true;
        };
    }, [supabase]);

    // Save preferences to database (debounced)
    const savePreferences = useCallback(
        (newPrefs: UserPreferences) => {
            if (!userId) return;

            // Clear existing timeout
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }

            // Debounce save
            saveTimeoutRef.current = setTimeout(async () => {
                try {
                    const { error } = await supabase
                        .from("user_profiles")
                        .update({ preferences: newPrefs as unknown as Json })
                        .eq("id", userId);

                    if (error) {
                        console.error("Error saving preferences:", error);
                        toast.error("No se pudieron guardar las preferencias.");
                    }
                } catch (err) {
                    console.error("Failed to save preferences:", err);
                    toast.error("No se pudieron guardar las preferencias.");
                }
            }, DEBOUNCE_MS);
        },
        [userId, supabase]
    );

    // Update a specific preference key
    const updatePreference = useCallback(
        <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
            setPreferences((prev) => {
                const newPrefs = {
                    ...prev,
                    [key]: { ...prev[key], ...value },
                };
                savePreferences(newPrefs);
                return newPrefs;
            });
        },
        [savePreferences]
    );

    // Get sidebar preferences
    const getSidebarPrefs = useCallback(() => {
        return preferences.sidebar || {};
    }, [preferences.sidebar]);

    // Get gantt preferences
    const getGanttPrefs = useCallback(() => {
        return preferences.gantt || {};
    }, [preferences.gantt]);

    // Update sidebar specific preference
    const updateSidebarPref = useCallback(
        (updates: Partial<UserPreferences["sidebar"]>) => {
            updatePreference("sidebar", { ...getSidebarPrefs(), ...updates });
        },
        [updatePreference, getSidebarPrefs]
    );

    // Update gantt specific preference
    const updateGanttPref = useCallback(
        (updates: Partial<UserPreferences["gantt"]>) => {
            updatePreference("gantt", { ...getGanttPrefs(), ...updates });
        },
        [updatePreference, getGanttPrefs]
    );

    // Get evaluation preferences
    const getEvalPrefs = useCallback(() => {
        return preferences.evaluation || {};
    }, [preferences.evaluation]);

    // Update evaluation specific preference
    const updateEvalPref = useCallback(
        (updates: Partial<UserPreferences["evaluation"]>) => {
            updatePreference("evaluation", { ...getEvalPrefs(), ...updates });
        },
        [updatePreference, getEvalPrefs]
    );

    return {
        preferences,
        isLoading,
        updatePreference,
        getSidebarPrefs,
        getGanttPrefs,
        updateSidebarPref,
        updateGanttPref,
        getEvalPrefs,
        updateEvalPref,
    };
}
