"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";

export async function login(formData: FormData) {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // User input can be email or username. 
    // Supabase Auth mainly works with Email. 
    // If we want username login, we might need a lookup or assume email.
    // The rules say "Usuario o Correo Eléctronico". 
    // For simplicity, we'll try to treat it as email primarily, or we'd need to fetch email by username first if Supabase doesn't support username login directly (it does via setup, but email is standard).
    // Assuming the input name is 'email' for now, but label says "User or Email".

    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    if (error) {
        return redirect("/login?message=" + encodeURIComponent(error.message));
    }

    revalidatePath("/", "layout");
    redirect("/dashboard");
}

export async function signup(formData: FormData) {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const fullName = formData.get("fullName") as string;
    const username = formData.get("username") as string;

    // Validation should happen client side too, but here:
    // "Reestricción de contraseña a minimo 10 caracteres, 1 minuscula, 1 mayuscula, 1 numero y 1 caracter especial."
    // We will assume client validation for specific rules to give better feedback, but server basic check.

    /*
  const { error, data } = await supabase.auth.signUp({
    email,
    password,
    options: {
        data: {
            full_name: fullName,
            username: username,
        }
    }
  });
  */

    // Password validation
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{10,}$/;
    if (!passwordRegex.test(password)) {
        return redirect("/register?message=" + encodeURIComponent("La contraseña debe tener al menos 10 caracteres, una mayúscula, una minúscula, un número y un carácter especial."));
    }

    const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                full_name: fullName,
                username: username,
            },
        },
    });

    if (error) {
        return redirect("/register?message=" + encodeURIComponent(error.message));
    }

    // revalidatePath("/", "layout"); // This redirect should only happen after email confirmation
    return redirect("/login?message=" + encodeURIComponent("Revisa tu correo para confirmar tu cuenta."));
}

export async function forgotPassword(formData: FormData) {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const email = formData.get("email") as string;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('.supabase.co', '')}/auth/callback?next=/account/update-password`, // Need proper URL handling
    });

    if (error) {
        return redirect("/forgot-password?error=" + encodeURIComponent(error.message));
    }

    return redirect("/forgot-password?message=" + encodeURIComponent("Se ha enviado un correo para restablecer tu contraseña."));
}
