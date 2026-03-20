import { describe, it, expect, vi } from "vitest";
import { requireAuth, requireRole } from "../auth-guard";

// ── Mock Supabase Client Factory ──

function mockSupabase({
    user = null,
    authError = null,
    profile = null,
    profileError = null,
}: {
    user?: { id: string; email?: string } | null;
    authError?: Error | null;
    profile?: { roles: string[]; is_approved: boolean } | null;
    profileError?: Error | null;
} = {}) {
    return {
        auth: {
            getUser: vi.fn().mockResolvedValue({
                data: { user },
                error: authError,
            }),
        },
        from: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                        data: profile,
                        error: profileError,
                    }),
                }),
            }),
        }),
    } as any;
}

// ── requireAuth ──

describe("requireAuth", () => {
    it("returns user when authenticated", async () => {
        const supabase = mockSupabase({ user: { id: "user-1", email: "test@test.com" } });
        const result = await requireAuth(supabase);
        expect(result.id).toBe("user-1");
    });

    it("throws 'No autenticado' when auth returns error", async () => {
        const supabase = mockSupabase({ authError: new Error("Invalid token") });
        await expect(requireAuth(supabase)).rejects.toThrow("No autenticado");
    });

    it("throws 'No autenticado' when user is null", async () => {
        const supabase = mockSupabase({ user: null });
        await expect(requireAuth(supabase)).rejects.toThrow("No autenticado");
    });
});

// ── requireRole ──

describe("requireRole", () => {
    it("returns user and profile when user has allowed role", async () => {
        const supabase = mockSupabase({
            user: { id: "user-1" },
            profile: { roles: ["ventas"], is_approved: true },
        });

        const result = await requireRole(supabase, ["ventas", "admin"]);
        expect(result.user.id).toBe("user-1");
        expect(result.profile.roles).toContain("ventas");
    });

    it("admin always has access regardless of allowedRoles", async () => {
        const supabase = mockSupabase({
            user: { id: "admin-1" },
            profile: { roles: ["admin"], is_approved: true },
        });

        const result = await requireRole(supabase, ["produccion"]);
        expect(result.user.id).toBe("admin-1");
    });

    it("throws 'No autenticado' when user is not authenticated", async () => {
        const supabase = mockSupabase({ user: null });
        await expect(requireRole(supabase, ["ventas"])).rejects.toThrow("No autenticado");
    });

    it("throws 'Perfil de usuario no encontrado' when profile query fails", async () => {
        const supabase = mockSupabase({
            user: { id: "user-1" },
            profileError: new Error("DB error"),
        });
        await expect(requireRole(supabase, ["ventas"])).rejects.toThrow("Perfil de usuario no encontrado");
    });

    it("throws 'Perfil de usuario no encontrado' when profile is null", async () => {
        const supabase = mockSupabase({
            user: { id: "user-1" },
            profile: null,
        });
        await expect(requireRole(supabase, ["ventas"])).rejects.toThrow("Perfil de usuario no encontrado");
    });

    it("throws 'Usuario no aprobado' when user is not approved", async () => {
        const supabase = mockSupabase({
            user: { id: "user-1" },
            profile: { roles: ["ventas"], is_approved: false },
        });
        await expect(requireRole(supabase, ["ventas"])).rejects.toThrow("Usuario no aprobado");
    });

    it("throws 'No autorizado' when user lacks required role", async () => {
        const supabase = mockSupabase({
            user: { id: "user-1" },
            profile: { roles: ["ventas"], is_approved: true },
        });
        await expect(requireRole(supabase, ["produccion", "almacen"])).rejects.toThrow("No autorizado");
    });

    it("grants access when user has at least one matching role", async () => {
        const supabase = mockSupabase({
            user: { id: "user-1" },
            profile: { roles: ["ventas", "diseno"], is_approved: true },
        });

        const result = await requireRole(supabase, ["diseno", "produccion"]);
        expect(result.user.id).toBe("user-1");
    });

    it("handles empty roles array in profile", async () => {
        const supabase = mockSupabase({
            user: { id: "user-1" },
            profile: { roles: [], is_approved: true },
        });
        await expect(requireRole(supabase, ["ventas"])).rejects.toThrow("No autorizado");
    });

    it("handles null roles in profile (defaults to empty array)", async () => {
        const supabase = mockSupabase({
            user: { id: "user-1" },
            profile: { roles: null as unknown as string[], is_approved: true },
        });
        await expect(requireRole(supabase, ["ventas"])).rejects.toThrow("No autorizado");
    });

    it("queries the correct table and field", async () => {
        const supabase = mockSupabase({
            user: { id: "user-42" },
            profile: { roles: ["admin"], is_approved: true },
        });

        await requireRole(supabase, ["ventas"]);

        expect(supabase.from).toHaveBeenCalledWith("user_profiles");
    });
});
