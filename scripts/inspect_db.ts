
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase env vars");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
    console.log("Checking 'employees' table...");
    const { data: employees, error } = await supabase
        .from('employees')
        .select('*')
        .limit(1);

    if (error) {
        console.error("Error fetching employees:", error);
    } else {
        console.log("Employees sample:", employees);
        if (employees && employees.length > 0) {
            console.log("Columns:", Object.keys(employees[0]));
        } else {
            console.log("Table exists but is empty or RLS prevented access. Trying to insert dummy to check schema if possible, or just guessing.");
        }
    }

    console.log("Checking 'collaborators' table...");
    const { data: collaborators, error: colError } = await supabase
        .from('collaborators')
        .select('*')
        .limit(1);

    if (colError) {
        console.log("Collaborators error (likely doesn't exist):", colError.message);
    } else {
        console.log("Collaborators sample:", collaborators);
    }
}

inspect();
