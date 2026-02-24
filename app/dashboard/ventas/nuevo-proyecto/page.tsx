import { ProjectForm } from "./project-form";
import { getCatalogData, getQuoteById } from "../actions";

export default async function NewProjectPage(props: { searchParams?: any }) {
    const { clients, contacts, units, materials, treatments } = await getCatalogData();
    const resolvedSearchParams = await props.searchParams;
    const quoteId = resolvedSearchParams?.quoteId;

    let initialQuote = null;
    if (quoteId && typeof quoteId === 'string') {
        try {
            initialQuote = await getQuoteById(quoteId);
        } catch (error) {
            console.error("Error fetching initial quote:", error);
        }
    }

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8">
            <ProjectForm
                clients={clients}
                contacts={contacts}
                units={units}
                materials={materials}
                treatments={treatments}
                initialDate={new Date()}
                initialQuote={initialQuote}
            />
        </div>
    );
}
