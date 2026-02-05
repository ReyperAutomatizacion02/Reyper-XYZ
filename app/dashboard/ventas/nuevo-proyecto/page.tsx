import { ProjectForm } from "./project-form";
import { getCatalogData } from "../actions";

export default async function NewProjectPage() {
    const { clients, contacts, units, materials } = await getCatalogData();

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8">
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
