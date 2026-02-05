
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { InventoryView } from "@/components/warehouse/inventory-view";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Link from "next/link";
import { Package } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard-header";

export default async function WarehouseInventoryPage() {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    return (
        <div className="flex flex-col gap-6 p-6">

            <DashboardHeader
                title="Inventario General"
                description="Gestión centralizada de stock de herramientas y materiales."
                icon={<Package className="w-8 h-8" />}
                backUrl="/dashboard/almacen"
                colorClass="text-blue-500"
                bgClass="bg-blue-500/10"
            />

            <Card className="h-full">
                <CardHeader>
                    <CardTitle>Listado de Artículos</CardTitle>
                    <CardDescription>
                        Base de datos completa del almacén.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <InventoryView />
                </CardContent>
            </Card>
        </div>
    );
}
