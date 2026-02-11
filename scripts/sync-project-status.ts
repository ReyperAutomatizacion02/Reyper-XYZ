import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { Database } from "../utils/supabase/types";

// --- CONFIGURATION ---
dotenv.config({ path: ".env.local" });

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing Supabase credentials (SUPABASE_SERVICE_ROLE_KEY) in .env.local");
}

const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// --- SETTINGS ---
const TERMINAL_STATUSES = ['D7-ENTREGADA', 'D8-CANCELADA', 'D1-TERMINADA'];

async function syncProjectStatuses() {
    console.log("🚀 Starting Project Status Sync...");

    // 1. Fetch all active projects
    const { data: activeProjects, error: projectError } = await supabase
        .from('projects')
        .select('id, name, status')
        .eq('status', 'active');

    if (projectError) {
        console.error("❌ Error fetching active projects:", projectError);
        return;
    }

    console.log(`🔍 Found ${activeProjects.length} active projects.`);

    let projectsUpdated = 0;

    for (const project of activeProjects) {
        // 2. Fetch all orders for this project
        const { data: orders, error: ordersError } = await supabase
            .from('production_orders')
            .select('genral_status')
            .eq('project_id', project.id);

        if (ordersError) {
            console.error(`❌ Error fetching orders for project ${project.name}:`, ordersError);
            continue;
        }

        if (!orders || orders.length === 0) {
            console.log(`✅ Project "${project.name}" (${project.id}) has NO orders. Marking as COMPLETED.`);
        } else {
            // 3. Check if ALL orders are in terminal status
            const allFinished = orders.every(order =>
                TERMINAL_STATUSES.includes(order.genral_status || '')
            );

            if (!allFinished) {
                continue;
            }
            console.log(`✅ Project "${project.name}" (${project.id}) is actually COMPLETED.`);
        }

        // 4. Update project status
        const { error: updateError } = await supabase
            .from('projects')
            .update({ status: 'completed' })
            .eq('id', project.id);

        if (updateError) {
            console.error(`❌ Failed to update project ${project.name}:`, updateError);
        } else {
            projectsUpdated++;
        }
    }

    console.log("------------------------------------------");
    console.log(`🎉 Sync Complete!`);
    console.log(`📦 Projects reviewed: ${activeProjects.length}`);
    console.log(`✨ Projects marked as completed: ${projectsUpdated}`);
    console.log(`📉 Remaining active projects: ${activeProjects.length - projectsUpdated}`);
}

syncProjectStatuses().catch(console.error);
