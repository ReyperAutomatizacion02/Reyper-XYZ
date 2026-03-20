"use client";

import { useEffect, useMemo, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

interface RealtimeRefresherProps {
    /** One or more tables to listen for changes */
    tables: string[];
    /** Debounce interval in ms (default: 2000) */
    debounceMs?: number;
}

/**
 * Listens for real-time Postgres changes on one or more tables
 * and triggers a non-blocking router refresh.
 *
 * Uses debouncing to batch rapid changes into a single refresh,
 * and startTransition to keep the UI responsive during refresh.
 */
export function RealtimeRefresher({ tables, debounceMs = 2000 }: RealtimeRefresherProps) {
    const router = useRouter();
    const supabase = useMemo(() => createClient(), []);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [, startTransition] = useTransition();

    // Stable key for the tables array
    const tablesKey = tables.join(",");

    useEffect(() => {
        const tableList = tablesKey.split(",");
        const channelName = `refresher_${tableList.join("_")}_${Math.random().toString(36).substring(7)}`;

        let channel = supabase.channel(channelName);

        // Subscribe to all tables on a single channel
        for (const table of tableList) {
            channel = channel.on(
                'postgres_changes',
                { event: '*', schema: 'public', table },
                () => {
                    // Debounce: reset timer on each event, refresh only after quiet period
                    if (timerRef.current) clearTimeout(timerRef.current);
                    timerRef.current = setTimeout(() => {
                        startTransition(() => {
                            router.refresh();
                        });
                    }, debounceMs);
                }
            );
        }

        channel.subscribe();

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
            supabase.removeChannel(channel);
        };
    }, [tablesKey, debounceMs, router, supabase, startTransition]);

    return null;
}
