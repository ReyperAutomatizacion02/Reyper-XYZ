/**
 * Parses a date string in YYYY-MM-DD format as a LOCAL date.
 * This prevents the -1 day shift that often occurs when parsing ISO strings
 * as UTC (which is the default for new Date("YYYY-MM-DD")).
 */
export function parseLocalDate(dateStr: string | null | undefined): Date | undefined {
    if (!dateStr) return undefined;

    // If it's already an ISO string with time, we might still want to adjust,
    // but typically the issues come from "YYYY-MM-DD"
    const parts = dateStr.split('T')[0].split('-');
    if (parts.length !== 3) return new Date(dateStr);

    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
    const day = parseInt(parts[2], 10);

    return new Date(year, month, day);
}

/**
 * Formats a date to YYYY-MM-DD in local time.
 */
export function formatLocalDate(date: Date | undefined): string | undefined {
    if (!date) return undefined;

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}
