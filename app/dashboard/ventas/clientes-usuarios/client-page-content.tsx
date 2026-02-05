"use client";

import { useState } from "react";
import { DashboardHeader } from "@/components/dashboard-header";
import { Users2, Building2, User } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClientManager } from "./client-manager";
import { ContactManager } from "./contact-manager";
import { useTour } from "@/hooks/use-tour";

interface ClientPageContentProps {
    initialClients: any[];
    initialContacts: any[];
}

export function ClientPageContent({ initialClients, initialContacts }: ClientPageContentProps) {
    const { startTour } = useTour();
    // Local state for demo data if needed, but since we pass props to children, 
    // we might need to orchestrate demo data here if we want the children to show it.
    // However, ClientManager and ContactManager use local state initialized from props.
    // So if we update props or keys, they might reset.
    // A simpler approach for Demo is to let the tour explain things even if empty, 
    // OR force some demo data into the props if empty AND tour is starting.
    // But modifying props passed to children based on tour state is tricky without a re-render.

    // Let's use a "tour mode" state that passes demo data to children?
    // Or just add a dummy client/contact to the list if empty when tour starts.

    const [clients, setClients] = useState(initialClients);
    const [contacts, setContacts] = useState(initialContacts);

    const handleStartTour = () => {
        const isDemo = clients.length === 0;

        if (isDemo) {
            setClients([{
                id: "demo-client",
                name: "Empresa Demo S.A.",
                business_name: "Empresa de Demostración",
                prefix: "DEMO",
                is_active: true
            }]);
            setContacts([{
                id: "demo-contact",
                name: "Usuario Demo",
                client_id: "demo-client",
                is_active: true
            }]);
        }

        const cleanup = () => {
            if (isDemo) {
                setClients(initialClients);
                setContacts(initialContacts);
            }
        };

        startTour([
            {
                element: "#clients-tabs",
                popover: { title: "Secciones", description: "Alterna entre 'Clientes' (Empresas) y 'Usuarios' (Personas/Solicitantes).", side: "bottom", align: "start" }
            },
            {
                element: "#clients-search",
                popover: { title: "Búsqueda y Filtros", description: "Busca clientes por nombre o razón social.", side: "bottom" }
            },
            {
                element: "#clients-stats",
                popover: { title: "Resumen", description: "Visualiza rápidamente el total de clientes y cuántos están activos.", side: "bottom" }
            },
            {
                element: "#clients-new-btn",
                popover: { title: "Nuevo Cliente", description: "Registra una nueva empresa en el sistema.", side: "left" }
            },
            {
                element: "#clients-table",
                popover: { title: "Listado de Clientes", description: "Aquí verás todos tus clientes. Puedes editar o eliminar registros desde las acciones a la derecha.", side: "top" }
            }
        ], cleanup);
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8">
            <DashboardHeader
                title="Gestión de Clientes y Usuarios"
                description="Administra la base de datos de clientes y contactos para proyectos."
                icon={<Users2 className="w-8 h-8" />}
                backUrl="/dashboard/ventas"
                colorClass="text-indigo-500"
                bgClass="bg-indigo-500/10"
                onHelp={handleStartTour}
            />

            <Tabs defaultValue="clients" className="w-full">
                <TabsList className="grid w-full max-w-md grid-cols-2 bg-muted mx-auto sm:mx-0" id="clients-tabs">
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
                        {/* We use key to force re-render if data changes (like for demo mode) 
                            Actually, ClientManager updates its state on prop change if we added that useEffect there.
                            I checked ClientManager file, lines 55-57:
                            useEffect(() => { setClients(initialClients); }, [initialClients]);
                            So yes, it will update.
                        */}
                        <ClientManager initialClients={clients} />
                    </div>
                </TabsContent>

                <TabsContent value="contacts" className="mt-6 space-y-4 animate-in fade-in-50 slide-in-from-bottom-2 duration-500">
                    <div className="bg-card dark:bg-card/50 p-6 rounded-3xl border border-border shadow-sm">
                        <div className="mb-4">
                            <h2 className="text-xl font-semibold text-foreground">Directorio de Usuarios</h2>
                            <p className="text-sm text-muted-foreground">Personas o contactos que solicitan proyectos.</p>
                        </div>
                        {/* Same here for ContactManager */}
                        <ContactManager initialContacts={contacts} clients={clients} />
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
