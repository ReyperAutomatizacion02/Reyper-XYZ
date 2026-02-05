"use client";

import { useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

interface RealtimeRefresherProps {
    table: string;
}

/**
 * A client component that listens for real-time changes on a specific table
 * and triggers a router refresh to update server components.
 */
export function RealtimeRefresher({ table }: RealtimeRefresherProps) {
    const router = useRouter();
    const supabase = useMemo(() => createClient(), []);
    const lastRefreshRef = useRef(0);

    useEffect(() => {
        console.log(`Setting up RealtimeRefresher for table: ${table}`);

        const channel = supabase
            .channel(`refresher_${table}_${Math.random().toString(36).substring(7)}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: table,
                },
                (payload) => {
                    const now = Date.now();
                    // Throttling to avoid double refreshes within 500ms
                    if (now - lastRefreshRef.current > 500) {
                        console.log(`Real-time change detected in ${table} (${payload.eventType}). Refreshing page...`);
                        lastRefreshRef.current = now;
                        router.refresh();
                    }
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log(`RealtimeRefresher SUBSCRIBED to ${table}`);
                } else if (status === 'CHANNEL_ERROR') {
                    console.error(`RealtimeRefresher error on ${table}. Data won't update in real-time.`);
                }
            });

        return () => {
            console.log(`Removing RealtimeRefresher for ${table}`);
            supabase.removeChannel(channel);
        };
    }, [table, router, supabase]);

    return null;
}
