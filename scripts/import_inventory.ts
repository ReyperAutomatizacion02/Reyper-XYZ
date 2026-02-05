
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load env vars
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
// Ideally use SERVICE_ROLE_KEY for admin tasks if available, otherwise Anon might have RLS issues if not logged in.
// Assuming the user runs this locally and we might need the service role key for bulk inserts if RLS blocks anon.
// Let's check if we have service role key in env, usually SUPABASE_SERVICE_ROLE_KEY
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseKey;

if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing Supabase credentials in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

// Reuse CSV parser logic (simplified)
function parseCSV(content: string): any[] {
    const records: any[] = [];
    let currentLine = 1;
    let i = 0;

    // Skip header
    const headerEnd = content.indexOf('\n');
    if (headerEnd !== -1) {
        i = headerEnd + 1;
        currentLine++;
    }

    while (i < content.length) {
        let key = '';
        let description = '';

        let keyEnd = content.indexOf(',', i);
        if (keyEnd === -1) break;

        key = content.substring(i, keyEnd).trim();
        i = keyEnd + 1;

        if (content[i] === '"') {
            i++;
            let valueStart = i;
            while (i < content.length) {
                if (content[i] === '"') {
                    if (i + 1 < content.length && content[i + 1] === '"') {
                        i += 2;
                    } else {
                        break;
                    }
                } else {
                    i++;
                }
            }
            description = content.substring(valueStart, i).replace(/""/g, '"');
            i++;
            while (i < content.length && content[i] !== '\n' && content[i] !== '\r') i++;
        } else {
            let valueStart = i;
            while (i < content.length && content[i] !== '\n' && content[i] !== '\r') {
                i++;
            }
            description = content.substring(valueStart, i).trim();
        }

        if (i < content.length && content[i] === '\r') i++;
        if (i < content.length && content[i] === '\n') {
            i++;
            currentLine++;
        }

        if (key) {
            records.push({ key, description });
        }
    }
    return records;
}

async function importData() {
    const filePath = path.join(process.cwd(), 'imports', 'inventario.csv');
    if (!fs.existsSync(filePath)) {
        console.error('File not found:', filePath);
        return;
    }

    console.log('Reading CSV...');
    const content = fs.readFileSync(filePath, 'utf-8');
    const rawRecords = parseCSV(content);
    console.log(`Parsed ${rawRecords.length} records.`);

    const brandKeywords = ['MILWALKEE', 'DEWALT', 'BOSCH', 'MAKITA', 'URREA', 'SURTEK', 'TRUPER', 'MILLER', 'INFRA', '3M', 'CASTROL', 'MOBIL', 'LOCTITE', 'GATES', 'FAG', 'SKF', 'DODGE'];

    const itemsToInsert: any[] = [];
    const keyMap = new Map<string, number>(); // Track duplicates

    for (const r of rawRecords) {
        // 1. Clean Key
        let cleanKey = r.key.replace(/\s+/g, ''); // Remove all spaces

        // Handle Duplicates
        if (keyMap.has(cleanKey)) {
            const count = keyMap.get(cleanKey)! + 1;
            keyMap.set(cleanKey, count);
            cleanKey = `${cleanKey}-DUP${count}`; // e.g. TORN001-DUP2
            console.warn(`Duplicate key found: ${r.key} -> renamed to ${cleanKey}`);
        } else {
            keyMap.set(cleanKey, 1);
        }

        // 2. Extract Name and Metadata
        const descriptionLines = r.description.split('\n');
        const name = descriptionLines.length > 0 ? descriptionLines[0].trim() : "Sin Nombre";

        // Metadata extraction
        const descUpper = r.description.toUpperCase();
        const metadata: any = {};

        // Brand
        const brand = brandKeywords.find(b => descUpper.includes(b));
        if (brand) metadata.brand = brand;

        // SKU/Code (simple heuristic)
        const skuMatch = descUpper.match(/(?:SKU|NO\.\s*DE\s*PARTE|CODIGO)[:\s#]*([A-Z0-9-]+)/);
        if (skuMatch) metadata.sku = skuMatch[1];

        // Category Prefix
        const prefixMatch = cleanKey.match(/^([A-Z]+)/);
        const category_prefix = prefixMatch ? prefixMatch[1] : 'OTROS';

        itemsToInsert.push({
            key: cleanKey,
            name: name,
            description: r.description,
            category_prefix: category_prefix,
            metadata: metadata,
            stock_quantity: 0
        });
    }

    // Bulk Insert
    console.log(`Preparing to insert ${itemsToInsert.length} items to Supabase...`);

    // Chunking to avoid payload limits
    const CHUNK_SIZE = 100;
    for (let i = 0; i < itemsToInsert.length; i += CHUNK_SIZE) {
        const chunk = itemsToInsert.slice(i, i + CHUNK_SIZE);
        const { error } = await supabase.from('inventory_items').upsert(chunk, { onConflict: 'key' });

        if (error) {
            console.error(`Error inserting chunk ${i}-${i + CHUNK_SIZE}:`, error);
        } else {
            console.log(`Inserted chunk ${i}-${i + CHUNK_SIZE}`);
        }
    }

    console.log('Import finished.');
}

importData();
