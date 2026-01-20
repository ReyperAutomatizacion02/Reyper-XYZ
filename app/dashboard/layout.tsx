import { AppSidebar } from "@/components/app-sidebar";
import AppNavbar from "@/components/app-navbar";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-black">
            <AppSidebar />
            <div className="flex flex-col flex-1 overflow-hidden">
                <AppNavbar />
                <main className="flex-1 overflow-auto p-6">
                    {children}
                </main>
            </div>
        </div>
    );
}
