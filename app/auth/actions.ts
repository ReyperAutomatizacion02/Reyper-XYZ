"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { LoginSchema, SignupSchema, ForgotPasswordSchema } from "@/lib/validations/auth";

export type AuthActionState = { error?: string; success?: string } | null;

export async function login(prevState: AuthActionState, formData: FormData): Promise<AuthActionState> {
    const parsed = LoginSchema.safeParse({
        email: formData.get("email"),
        password: formData.get("password"),
    });

    if (!parsed.success) {
        return { error: "Credenciales inválidas." };
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { error } = await supabase.auth.signInWithPassword({
        email: parsed.data.email,
        password: parsed.data.password,
    });

    if (error) {
        console.error("[login] Auth error:", error.message);
        return { error: "Credenciales inválidas. Intenta de nuevo." };
    }

    revalidatePath("/", "layout");
    redirect("/dashboard");
}

export async function signup(prevState: AuthActionState, formData: FormData): Promise<AuthActionState> {
    const parsed = SignupSchema.safeParse({
        email: formData.get("email"),
        password: formData.get("password"),
        fullName: formData.get("fullName"),
        username: formData.get("username"),
    });

    if (!parsed.success) {
        const firstError = parsed.error.issues[0]?.message || "Datos de registro inválidos.";
        return { error: firstError };
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { error } = await supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: {
            data: {
                full_name: parsed.data.fullName,
                username: parsed.data.username,
            },
        },
    });

    if (error) {
        console.error("[signup] Auth error:", error.message);
        return { error: "No se pudo crear la cuenta. Verifica tus datos e intenta de nuevo." };
    }

    return { success: "Revisa tu correo para confirmar tu cuenta." };
}

export async function forgotPassword(prevState: AuthActionState, formData: FormData): Promise<AuthActionState> {
    const parsed = ForgotPasswordSchema.safeParse({
        email: formData.get("email"),
    });

    if (!parsed.success) {
        return { error: "Correo electrónico inválido." };
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/account/update-password`,
    });

    if (error) {
        console.error("[forgotPassword] Auth error:", error.message);
        return { error: "No se pudo procesar la solicitud. Intenta de nuevo." };
    }

    return { success: "Se ha enviado un correo para restablecer tu contraseña." };
}
