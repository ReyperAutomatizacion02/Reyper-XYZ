import { DashboardHeader } from "@/components/dashboard-header";
import { FolderPlus } from "lucide-react";
import { ProjectForm } from "./project-form";
import { getCatalogData } from "../actions";

export default async function NewProjectPage() {
    const { clients, contacts, units, materials } = await getCatalogData();

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8">
            <DashboardHeader
                title="Nuevo Proyecto"
                description="Generar cotización, códigos y partidas automáticamente."
                icon={<FolderPlus className="w-8 h-8 text-red-500" />}
                backUrl="/dashboard/ventas"
                iconClassName="bg-red-500/10 text-red-500"
            />

            <ProjectForm
                clients={clients}
                contacts={contacts}
                units={units}
                materials={materials}
                initialDate={new Date()}
            />
        </div>
    );
}
