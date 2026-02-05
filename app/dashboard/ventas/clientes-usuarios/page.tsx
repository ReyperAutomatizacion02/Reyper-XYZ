import { getCatalogData } from "../actions";
import { ClientPageContent } from "./client-page-content";

export default async function ClientUsersPage() {
    const { clients, contacts } = await getCatalogData();

    return <ClientPageContent initialClients={clients} initialContacts={contacts} />;
}
