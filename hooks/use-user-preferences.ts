"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/utils/supabase/client";

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
    };
}

const DEBOUNCE_MS = 1000;

export function useUserPreferences() {
    const [preferences, setPreferences] = useState<UserPreferences>({});
    const [isLoading, setIsLoading] = useState(true);
    const [userId, setUserId] = useState<string | null>(null);
    const supabase = createClient();
    const saveTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

    // Load preferences on mount
    useEffect(() => {
        const loadPreferences = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) {
                    setIsLoading(false);
                    return;
                }

                setUserId(user.id);

                const { data, error } = await supabase
                    .from("user_profiles")
                    .select("preferences")
                    .eq("id", user.id)
                    .single();

                if (error) {
                    console.error("Error loading preferences:", error);
                } else {
                    setPreferences(data?.preferences || {});
                }
            } catch (err) {
                console.error("Failed to load user preferences:", err);
            } finally {
                setIsLoading(false);
            }
        };

        loadPreferences();
    }, [supabase]);

    // Save preferences to database (debounced)
    const savePreferences = useCallback((newPrefs: UserPreferences) => {
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
                    .update({ preferences: newPrefs })
                    .eq("id", userId);

                if (error) {
                    console.error("Error saving preferences:", error);
                }
            } catch (err) {
                console.error("Failed to save preferences:", err);
            }
        }, DEBOUNCE_MS);
    }, [userId, supabase]);

    // Update a specific preference key
    const updatePreference = useCallback(<K extends keyof UserPreferences>(
        key: K,
        value: UserPreferences[K]
    ) => {
        setPreferences(prev => {
            const newPrefs = {
                ...prev,
                [key]: { ...prev[key], ...value }
            };
            savePreferences(newPrefs);
            return newPrefs;
        });
    }, [savePreferences]);

    // Get sidebar preferences
    const getSidebarPrefs = useCallback(() => {
        return preferences.sidebar || {};
    }, [preferences.sidebar]);

    // Get gantt preferences
    const getGanttPrefs = useCallback(() => {
        return preferences.gantt || {};
    }, [preferences.gantt]);

    // Update sidebar specific preference
    const updateSidebarPref = useCallback((updates: Partial<UserPreferences["sidebar"]>) => {
        updatePreference("sidebar", { ...getSidebarPrefs(), ...updates });
    }, [updatePreference, getSidebarPrefs]);

    // Update gantt specific preference
    const updateGanttPref = useCallback((updates: Partial<UserPreferences["gantt"]>) => {
        updatePreference("gantt", { ...getGanttPrefs(), ...updates });
    }, [updatePreference, getGanttPrefs]);

    return {
        preferences,
        isLoading,
        updatePreference,
        getSidebarPrefs,
        getGanttPrefs,
        updateSidebarPref,
        updateGanttPref
    };
}
