
import { Client } from "@notionhq/client";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const BLOCK_ID = "2f823882-4ec5-81a7-935e-e83c7c4312cb";
const NEW_TITLE = "5. Detalles y Reglas de Negocio";

if (!NOTION_TOKEN) {
    console.error("Missing NOTION_TOKEN");
    process.exit(1);
}

const notion = new Client({ auth: NOTION_TOKEN });

async function main() {
    try {
        console.log(`Updating block ${BLOCK_ID}...`);
        const response = await notion.blocks.update({
            block_id: BLOCK_ID,
            heading_1: {
                rich_text: [
                    {
                        text: {
                            content: NEW_TITLE
                        }
                    }
                ]
            }
        });
        console.log("Update successful!");
        console.log(response);
    } catch (error) {
        console.error("Error updating block:", error);
    }
}

main();
