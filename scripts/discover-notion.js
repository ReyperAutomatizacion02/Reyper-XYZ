const dotenv = require("dotenv");
dotenv.config({ path: ".env.local" });

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const ITEMS_DB_ID = process.env.NOTION_ITEMS_DB_ID;

async function discover() {
    try {
        const res = await fetch(`https://api.notion.com/v1/databases/${ITEMS_DB_ID}/query`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${NOTION_TOKEN}`,
                "Notion-Version": "2022-06-28",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ page_size: 1 })
        });

        const data = await res.json();
        if (data.results.length > 0) {
            const props = data.results[0].properties;
            console.log("--- Searching for Diseño / Diseno ---");
            for (const name of Object.keys(props)) {
                const lowerName = name.toLowerCase();
                if (lowerName.includes("disen") || lowerName.includes("diseñ") || lowerName.includes("no")) {
                    console.log(`- ${name} (${props[name].type})`);
                    const p = props[name];
                    let val = "N/A";
                    if (p.type === 'select') val = p.select?.name;
                    else if (p.type === 'multi_select') val = p.multi_select?.map(s => s.name).join(", ");
                    else if (p.type === 'url') val = p.url;
                    else if (p.type === 'rich_text') val = p.rich_text?.[0]?.plain_text;
                    else if (p.type === 'number') val = p.number;
                    else if (p.type === 'formula') val = JSON.stringify(p.formula);
                    console.log(`  Value: ${val}`);
                }
            }
        }
    } catch (error) {
        console.error(error);
    }
}

discover();
