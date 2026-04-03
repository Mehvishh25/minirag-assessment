import "dotenv/config";
import { ingestEmails } from "../src/ingest.js";

async function main() {
  console.log("Starting email ingestion...");
  try {
    const result = await ingestEmails();
    console.log("Email ingestion finished successfully!");
    console.log(result);
  } catch (err) {
    console.error("Ingestion failed:", err);
    process.exit(1);
  }
}

main();