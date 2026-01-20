"use client";

import { useFormStatus } from "react-dom";
import { type ComponentProps } from "react";
import { Loader2 } from "lucide-react";

type Props = ComponentProps<"button"> & {
    pendingText?: string;
};

export function SubmitButton({ children, pendingText, ...props }: Props) {
    const { pending } = useFormStatus();

    return (
        <button {...props} type="submit" aria-disabled={pending} disabled={pending} className={props.className + " flex items-center justify-center gap-2"}>
            {pending && <Loader2 className="w-4 h-4 animate-spin" />}
            {pending ? pendingText : children}
        </button>
    );
}
