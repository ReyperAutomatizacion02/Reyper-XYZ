import { z } from "zod";

export const LoginSchema = z.object({
    email: z.string().min(1, "El correo es obligatorio").email("Correo electrónico inválido"),
    password: z.string().min(1, "La contraseña es obligatoria"),
});

export const SignupSchema = z.object({
    email: z.string().min(1, "El correo es obligatorio").email("Correo electrónico inválido"),
    password: z.string()
        .min(10, "La contraseña debe tener al menos 10 caracteres")
        .regex(/[a-z]/, "Debe contener al menos una minúscula")
        .regex(/[A-Z]/, "Debe contener al menos una mayúscula")
        .regex(/\d/, "Debe contener al menos un número")
        .regex(/[\W_]/, "Debe contener al menos un carácter especial"),
    fullName: z.string().min(1, "El nombre completo es obligatorio").max(200).trim(),
    username: z.string().min(1, "El nombre de usuario es obligatorio").max(100).trim(),
});

export const ForgotPasswordSchema = z.object({
    email: z.string().min(1, "El correo es obligatorio").email("Correo electrónico inválido"),
});
