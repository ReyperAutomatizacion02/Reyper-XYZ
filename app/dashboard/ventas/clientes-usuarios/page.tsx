
import { DashboardHeader } from "@/components/dashboard-header";
import { Users2, Building2, User } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCatalogData } from "../actions";
import { ClientManager } from "./client-manager";
import { ContactManager } from "./contact-manager";

export default async function ClientUsersPage() {
    const { clients, contacts } = await getCatalogData();

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8">
            <DashboardHeader
                title="Gestión de Clientes y Usuarios"
                description="Administra la base de datos de clientes y contactos para proyectos."
                icon={<Users2 className="w-8 h-8 text-indigo-500" />}
                backUrl="/dashboard/ventas"
                iconClassName="bg-indigo-500/10 text-indigo-500"
            />

            <Tabs defaultValue="clients" className="w-full">
                <TabsList className="grid w-full max-w-md grid-cols-2 bg-muted mx-auto sm:mx-0">
                    <TabsTrigger value="clients" className="data-[state=active]:bg-background data-[state=active]:text-red-600 data-[state=active]:shadow-sm">
                        <Building2 className="w-4 h-4 mr-2" /> Clientes
                    </TabsTrigger>
                    <TabsTrigger value="contacts" className="data-[state=active]:bg-background data-[state=active]:text-blue-600 data-[state=active]:shadow-sm">
                        <User className="w-4 h-4 mr-2" /> Usuarios / Solicitantes
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="clients" className="mt-6 space-y-4 animate-in fade-in-50 slide-in-from-bottom-2 duration-500">
                    <div className="bg-card dark:bg-card/50 p-6 rounded-3xl border border-border shadow-sm">
                        <div className="mb-4">
                            <h2 className="text-xl font-semibold text-foreground">Base de Clientes</h2>
                            <p className="text-sm text-muted-foreground">Listado de empresas registradas.</p>
                        </div>
                        <ClientManager initialClients={clients} />
                    </div>
                </TabsContent>

                <TabsContent value="contacts" className="mt-6 space-y-4 animate-in fade-in-50 slide-in-from-bottom-2 duration-500">
                    <div className="bg-card dark:bg-card/50 p-6 rounded-3xl border border-border shadow-sm">
                        <div className="mb-4">
                            <h2 className="text-xl font-semibold text-foreground">Directorio de Usuarios</h2>
                            <p className="text-sm text-muted-foreground">Personas o contactos que solicitan proyectos.</p>
                        </div>
                        <ContactManager initialContacts={contacts} clients={clients} />
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
