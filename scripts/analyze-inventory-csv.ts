
import fs from 'fs';
import path from 'path';

// Helper to parse CSV with multi-line support
function parseCSV(content: string): { key: string; description: string; originalLine: number }[] {
    const records: { key: string; description: string; originalLine: number }[] = [];
    let currentLine = 1;
    let i = 0;

    // Skip header
    const headerEnd = content.indexOf('\n');
    if (headerEnd !== -1) {
        i = headerEnd + 1;
        currentLine++;
    }

    while (i < content.length) {
        const startLine = currentLine;
        let key = '';
        let description = '';

        // Parse Key (until comma)
        let keyEnd = content.indexOf(',', i);
        if (keyEnd === -1) break;

        key = content.substring(i, keyEnd).trim();
        i = keyEnd + 1; // Skip comma

        // Parse Description
        if (content[i] === '"') {
            // Quoted field
            i++; // Skip opening quote
            let valueStart = i;
            while (i < content.length) {
                if (content[i] === '"') {
                    if (i + 1 < content.length && content[i + 1] === '"') {
                        // Escaped quote
                        i += 2;
                    } else {
                        // End of quote
                        break;
                    }
                } else {
                    if (content[i] === '\n') currentLine++;
                    i++;
                }
            }
            description = content.substring(valueStart, i).replace(/""/g, '"');
            i++; // Skip closing quote
            // Skip until newline or comma (should be newline for 2 cols)
            while (i < content.length && content[i] !== '\n' && content[i] !== '\r') i++;
        } else {
            // Unquoted field
            let valueStart = i;
            while (i < content.length && content[i] !== '\n' && content[i] !== '\r') {
                i++;
            }
            description = content.substring(valueStart, i).trim();
        }

        // Handle CRLF or LF
        if (i < content.length && content[i] === '\r') i++;
        if (i < content.length && content[i] === '\n') {
            i++;
            currentLine++;
        }

        if (key) {
            records.push({ key, description, originalLine: startLine });
        }
    }
    return records;
}

const filePath = path.join(process.cwd(), 'imports', 'inventario.csv');
console.log(`Analyzing file: ${filePath}`);

if (!fs.existsSync(filePath)) {
    console.error('File not found!');
    process.exit(1);
}

const content = fs.readFileSync(filePath, 'utf-8');
const records = parseCSV(content);

console.log(`Total Records Parsed: ${records.length}`);

// Analysis
const prefixes = new Map<string, number>();
const anomalies: string[] = [];
const duplicates = new Map<string, number[]>();
const extractedMetadata = {
    skus: 0,
    brands: 0,
    dimensions: 0
};

const brandKeywords = ['MILWALKEE', 'DEWALT', 'BOSCH', 'MAKITA', 'URREA', 'SURTEK', 'TRUPER', 'MILLER', 'INFRA', '3M', 'CASTROL', 'MOBIL', 'LOCTITE', 'GATES', 'FAG', 'SKF', 'DODGE'];

records.forEach(r => {
    // 1. Analyze Keys (Prefixes)
    const match = r.key.match(/^([A-Z]+)-/);
    if (match) {
        const prefix = match[1];
        prefixes.set(prefix, (prefixes.get(prefix) || 0) + 1);
    } else {
        // Try other patterns or mark anomaly
        const match2 = r.key.match(/^([A-Z]+)[0-9]+/); // e.g. ANILM001
        if (match2) {
            const prefix = match2[1];
            prefixes.set(prefix, (prefixes.get(prefix) || 0) + 1);
        } else {
            anomalies.push(`Line ${r.originalLine}: Unusual Key Format: ${r.key}`);
        }
    }

    // 2. Duplicate Check
    if (duplicates.has(r.key)) {
        duplicates.get(r.key)?.push(r.originalLine);
    } else {
        duplicates.set(r.key, [r.originalLine]);
    }

    // 3. Metadata Extraction Heuristics
    const descUpper = r.description.toUpperCase();

    // SKU / Part Number
    if (descUpper.includes('SKU') || descUpper.includes('NO. DE PARTE') || descUpper.includes('CODIGO') || descUpper.match(/#[0-9]+/)) {
        extractedMetadata.skus++;
    }

    // Brands
    if (brandKeywords.some(bk => descUpper.includes(bk))) {
        extractedMetadata.brands++;
    }

    // Dimensions (Simple check for " X " or "mm" or "\"")
    if (descUpper.includes(' X ') || descUpper.includes('MM') || descUpper.includes('"')) {
        extractedMetadata.dimensions++;
    }
});

console.log('\n--- Analysis Results ---');
console.log('Top 10 Prefixes (Categories):');
[...prefixes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).forEach(([p, c]) => console.log(`  ${p}: ${c} items`));

const duplicateEntries = [...duplicates.entries()].filter(([, lines]) => lines.length > 1);
if (duplicateEntries.length > 0) {
    console.log(`\nFound ${duplicateEntries.length} duplicate keys:`);
    duplicateEntries.slice(0, 5).forEach(([key, lines]) => console.log(`  ${key}: Lines ${lines.join(', ')}`));
    if (duplicateEntries.length > 5) console.log(`  ... and ${duplicateEntries.length - 5} more.`);
} else {
    console.log('\nNo duplicate keys found.');
}

console.log('\nMetadata Extraction Potential:');
console.log(`  Items with explicit SKUs/Codes: ${extractedMetadata.skus} (${((extractedMetadata.skus / records.length) * 100).toFixed(1)}%)`);
console.log(`  Items with detectable BRANDS: ${extractedMetadata.brands} (${((extractedMetadata.brands / records.length) * 100).toFixed(1)}%)`);
console.log(`  Items with Dimensions: ${extractedMetadata.dimensions} (${((extractedMetadata.dimensions / records.length) * 100).toFixed(1)}%)`);

if (anomalies.length > 0) {
    console.log(`\nAnomalies (${anomalies.length}):`);
    anomalies.slice(0, 5).forEach(a => console.log('  ' + a));
}

console.log('\nSample Parsed Records (with multiline descriptions):');
records.filter(r => r.description.includes('\n')).slice(0, 3).forEach(r => {
    console.log(`  [${r.key}]: ${JSON.stringify(r.description)}`);
});
