
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
                <TabsList className="grid w-full max-w-md grid-cols-2 bg-zinc-100 dark:bg-zinc-900 mx-auto sm:mx-0">
                    <TabsTrigger value="clients" className="data-[state=active]:bg-white data-[state=active]:text-red-600 data-[state=active]:shadow-sm">
                        <Building2 className="w-4 h-4 mr-2" /> Clientes
                    </TabsTrigger>
                    <TabsTrigger value="contacts" className="data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm">
                        <User className="w-4 h-4 mr-2" /> Usuarios / Solicitantes
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="clients" className="mt-6 space-y-4 animate-in fade-in-50 slide-in-from-bottom-2 duration-500">
                    <div className="bg-gradient-to-br from-red-50 to-transparent dark:from-red-900/10 p-6 rounded-3xl border border-red-100/50 dark:border-red-900/20">
                        <div className="mb-4">
                            <h2 className="text-xl font-semibold text-zinc-800 dark:text-zinc-100">Base de Clientes</h2>
                            <p className="text-sm text-zinc-500">Listado de empresas registradas.</p>
                        </div>
                        <ClientManager initialClients={clients} />
                    </div>
                </TabsContent>

                <TabsContent value="contacts" className="mt-6 space-y-4 animate-in fade-in-50 slide-in-from-bottom-2 duration-500">
                    <div className="bg-gradient-to-br from-blue-50 to-transparent dark:from-blue-900/10 p-6 rounded-3xl border border-blue-100/50 dark:border-blue-900/20">
                        <div className="mb-4">
                            <h2 className="text-xl font-semibold text-zinc-800 dark:text-zinc-100">Directorio de Usuarios</h2>
                            <p className="text-sm text-zinc-500">Personas o contactos que solicitan proyectos.</p>
                        </div>
                        <ContactManager initialContacts={contacts} clients={clients} />
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
