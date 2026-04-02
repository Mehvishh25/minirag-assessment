import "dotenv/config";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { qdrant, COLLECTION_NAME, createCollection } from "../src/qdrant.js";
import { EmailSchema, IngestResultType } from "../src/types.js";

const BATCH_SIZE = 5;
const JINA_VECTOR_SIZE = 1024;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

interface JinaEmbeddingResponse {
  data: { embedding: number[] }[];
}

const JINA_API_KEY = process.env.JINA_EMBEDDING_API_KEY as string;
const JINA_BASE_URL = process.env.JINA_EMBEDDING_BASE_URL as string;
const JINA_MODEL = process.env.JINA_EMBEDDING_MODEL as string;

if (!JINA_API_KEY) throw new Error("Set JINA_EMBEDDING_API_KEY in .env");
if (!JINA_BASE_URL) throw new Error("Set JINA_EMBEDDING_BASE_URL in .env");
if (!JINA_MODEL) throw new Error("Set JINA_EMBEDDING_MODEL in .env");

const dataPath = path.resolve("data/emails.json");
const rawData = JSON.parse(fs.readFileSync(dataPath, "utf-8"));
const parseResult = EmailSchema.array().safeParse(rawData);

if (!parseResult.success) {
  console.error("Email validation failed:", parseResult.error.issues);
  process.exit(1);
}

const emails = parseResult.data;
console.log(`${emails.length} emails validated`);

function toDeterministicUUID(emailId: string): string {
  const hex = crypto.createHash("sha256").update(emailId).digest("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

function buildEmbedText(email: (typeof emails)[number]): string {
  return [
    `Subject: ${email.subject}`,
    `From: ${email.from}`,
    `To: ${email.to.join(", ")}`,
    `Body: ${email.body}`,
  ].join("\n");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchEmbeddingsWithRetry(texts: string[]): Promise<number[][]> {
  let lastError: Error = new Error("Unknown error");

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(JINA_BASE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${JINA_API_KEY}`,
        },
        body: JSON.stringify({ model: JINA_MODEL, input: texts }),
      });

      if (response.status === 429) {
        console.error(`Rate limited, attempt ${attempt}/${MAX_RETRIES}. Retrying in ${RETRY_DELAY_MS * attempt}ms`);
        await sleep(RETRY_DELAY_MS * attempt);
        continue;
      }

      if (!response.ok) {
        throw new Error(`Jina API error: ${response.status} ${response.statusText}`);
      }

      const json = (await response.json()) as JinaEmbeddingResponse;
      return json.data.map((item) => item.embedding);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS * attempt);
      }
    }
  }

  throw lastError;
}

async function upsertBatch(
  batch: (typeof emails)[number][],
  embeddings: number[][]
): Promise<void> {
  const points = batch.map((email, idx) => ({
    id: toDeterministicUUID(email.id),
    vector: embeddings[idx],
    payload: {
      id: email.id,
      conversationId: email.conversationId,
      subject: email.subject,
      from: email.from,
      to: email.to,
      labels: email.labels,
      importance: email.importance,
      timestamp: new Date(email.timestamp).getTime(),
      organization: email.from.split("@")[1],
    },
  }));

  await qdrant.upsert(COLLECTION_NAME, { points });
}

async function main(): Promise<IngestResultType> {
  await createCollection(JINA_VECTOR_SIZE);

  let successCount = 0;
  let failCount = 0;
  const startTime = Date.now();

  for (let i = 0; i < emails.length; i += BATCH_SIZE) {
    const batch = emails.slice(i, i + BATCH_SIZE);
    const texts = batch.map(buildEmbedText);

    let embeddings: number[][];
    try {
      embeddings = await fetchEmbeddingsWithRetry(texts);
    } catch (err) {
      console.error(`Embedding failed for batch ${i}-${i + batch.length}:`, err);
      failCount += batch.length;
      continue;
    }

    try {
      await upsertBatch(batch, embeddings);
      successCount += batch.length;
      console.log(`Upserted emails ${i + 1}-${i + batch.length}`);
    } catch (err) {
      console.error(`Upsert failed for batch ${i}-${i + batch.length}:`, err);
      failCount += batch.length;
    }

    await sleep(500);
  }

  const ingestResult: IngestResultType = {
    total: emails.length,
    success: successCount,
    failed: failCount,
    durationMs: Date.now() - startTime,
  };

  console.log(`Ingestion complete in ${ingestResult.durationMs}ms`);
  console.log(`Success: ${ingestResult.success} | Failed: ${ingestResult.failed}`);

  return ingestResult;
}

main().catch(console.error);