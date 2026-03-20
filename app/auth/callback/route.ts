import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

/** Allowed redirect prefixes after auth callback — prevents open redirect (OWASP A01) */
const ALLOWED_REDIRECT_PREFIXES = [
    "/dashboard",
    "/pending-approval",
];

function getSafeRedirect(next: string | null): string {
    if (!next) return "/dashboard";
    // Block protocol-relative URLs (//evil.com) and absolute URLs
    if (!next.startsWith("/") || next.startsWith("//")) return "/dashboard";
    // Only allow known internal route prefixes
    if (ALLOWED_REDIRECT_PREFIXES.some((prefix) => next.startsWith(prefix))) {
        return next;
    }
    return "/dashboard";
}

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get("code");
    const next = getSafeRedirect(searchParams.get("next"));

    if (code) {
        const cookieStore = await cookies();
        const supabase = createClient(cookieStore);
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
            return NextResponse.redirect(`${origin}${next}`);
        }
    }

    // return the user to an error page with instructions
    return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
