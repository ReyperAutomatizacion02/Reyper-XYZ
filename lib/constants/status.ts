// lib/constants/status.ts

// Global string constants to prevent typos and make future refactoring easier

export const QUOTE_STATUS = {
    DRAFT: 'draft',
    ACTIVE: 'active',
    APPROVED: 'approved',
    CANCELLED: 'cancelled',
} as const;

export const PROJECT_STATUS = {
    ACTIVE: 'active',
    COMPLETED: 'completed',
    ON_HOLD: 'on_hold',
    CANCELLED: 'cancelled',
} as const;

export const ITEM_STATUS = {
    // Initial production state mapping
    RE_ORDER_POINT: 'D0-PUNTO DE RE-ORDEN',
    MACHINING: 'MAQUINADOS', // Just an example, replace with your exact strings
    // etc... add all expected general_status states here
} as const;
