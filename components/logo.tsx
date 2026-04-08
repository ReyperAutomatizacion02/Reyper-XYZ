import { cn } from "@/lib/utils";

interface LogoProps {
    className?: string;
}

/** Isotipo cuadrado — para favicon, páginas de auth y hero */
export function LogoShort({ className }: LogoProps) {
    return (
        // eslint-disable-next-line @next/next/no-img-element
        <img src="/logo_short.svg" alt="Logo" className={cn("h-auto w-auto", className)} />
    );
}

/** Logo horizontal con nombre — para sidebar y header */
export function LogoLarge({ className }: LogoProps) {
    return (
        // eslint-disable-next-line @next/next/no-img-element
        <img src="/logo_large.svg" alt="Logo" className={cn("h-auto w-auto", className)} />
    );
}

/** Alias para compatibilidad con imports existentes */
export const Logo = LogoShort;
