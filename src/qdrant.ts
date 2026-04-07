import { QdrantClient } from "@qdrant/js-client-rest";
import dotenv from "dotenv";

dotenv.config();

export const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL || "http://localhost:6333",
  apiKey: process.env.QDRANT_API_KEY || undefined,
});

export const COLLECTION_NAME = "emails";

export async function createCollection(vectorSize: number): Promise<void> {
  try {
    await qdrant.getCollection(COLLECTION_NAME);
    console.log("Collection already exists:", COLLECTION_NAME);
  } catch {
    await qdrant.createCollection(COLLECTION_NAME, {
      vectors: { size: vectorSize, distance: "Cosine" },
      optimizers_config: { default_segment_number: 1 },
    });
    await qdrant.createPayloadIndex(COLLECTION_NAME, {
      field_name: "from",
      field_schema: "keyword",
    });
    await qdrant.createPayloadIndex(COLLECTION_NAME, {
      field_name: "labels",
      field_schema: "keyword",
    });
    await qdrant.createPayloadIndex(COLLECTION_NAME, {
      field_name: "timestamp",
      field_schema: "integer",
    });
    await qdrant.createPayloadIndex(COLLECTION_NAME, {
      field_name: "organizations",
      field_schema: "keyword",
    });
    console.log("Qdrant collection created:", COLLECTION_NAME);
  }
}