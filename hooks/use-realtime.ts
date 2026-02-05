"use client";

import { useEffect, useMemo, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

/**
 * Hook to subscribe to real-time changes in a Supabase table.
 * 
 * @param table - The table name to subscribe to.
 * @param callback - Function to execute when a change occurs.
 * @param event - The type of event to listen for (INSERT, UPDATE, DELETE, or *).
 */
export function useRealtime(
    table: string,
    callback: (payload: RealtimePostgresChangesPayload<any>) => void,
    event: 'INSERT' | 'UPDATE' | 'DELETE' | '*' = '*'
) {
    const supabase = useMemo(() => createClient(), []);
    const callbackRef = useRef(callback);

    // Update the ref whenever the callback changes
    useEffect(() => {
        callbackRef.current = callback;
    }, [callback]);

    useEffect(() => {
        const channel = supabase
            .channel(`realtime_${table}_${event}_${Math.random().toString(36).substring(7)}`)
            .on(
                'postgres_changes' as any,
                {
                    event: event,
                    schema: 'public',
                    table: table,
                } as any,
                (payload: RealtimePostgresChangesPayload<any>) => {
                    callbackRef.current(payload);
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log(`Subscribed to ${table} changes`);
                }
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [table, event, supabase]);
}
