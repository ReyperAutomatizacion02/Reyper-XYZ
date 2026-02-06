import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { SidebarProvider } from "@/components/sidebar-context";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "Reyper XYZ",
    description: "Sistema interno de administración Reyper XYZ",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="es" suppressHydrationWarning>
            <body className={inter.className} suppressHydrationWarning>
                <ThemeProvider
                    attribute="class"
                    defaultTheme="system"
                    enableSystem
                    disableTransitionOnChange
                >
                    <SidebarProvider>
                        {children}
                    </SidebarProvider>
                </ThemeProvider>
            </body>
        </html>
    );
}
