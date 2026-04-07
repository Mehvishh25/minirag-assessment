import "dotenv/config";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { qdrant, COLLECTION_NAME, createCollection } from "./qdrant.js";
import { EmailSchema, EmailVectorPayload, IngestResultType } from "./types.js";

const BATCH_SIZE = 5;
const VECTOR_SIZE = 1024;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

interface JinaEmbeddingResponse {
  data: { embedding: number[] }[];
}

const JINA_API_KEY = process.env.JINA_EMBEDDING_API_KEY as string;
const JINA_BASE_URL = process.env.JINA_EMBEDDING_BASE_URL as string;
const JINA_MODEL = process.env.JINA_EMBEDDING_MODEL as string;

if (!JINA_API_KEY || !JINA_BASE_URL || !JINA_MODEL) {
  throw new Error("Set JINA_EMBEDDING_API_KEY, JINA_EMBEDDING_BASE_URL, JINA_EMBEDDING_MODEL in .env");
}

const dataPath = path.resolve("data/emails.json");
const rawData = JSON.parse(fs.readFileSync(dataPath, "utf-8"));
const parseResult = EmailSchema.array().safeParse(rawData);
if (!parseResult.success) {
  console.error("Email validation failed:", parseResult.error.issues);
  process.exit(1);
}
const emails = parseResult.data;

export function toDeterministicUUID(emailId: string): string {
  const hex = crypto.createHash("sha256").update(emailId).digest("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

function buildEmbedText(email: typeof emails[number]): string {
  return [
    `Subject: ${email.subject}`,
    `From: ${email.from}`,
    `To: ${email.to.join(", ")}`,
    `Body: ${email.body}`,
  ].join("\n");
}

function extractDomain(email: string): string {
  return email.split("@")[1] ?? "";
}

function extractOrganizations(email: typeof emails[number]): string[] {
  const domains = new Set<string>();

  domains.add(extractDomain(email.from));

  for (const addr of email.to) {
    domains.add(extractDomain(addr));
  }

  for (const label of email.labels) {
    domains.add(label);
  }

  return [...domains].filter(Boolean);
}

function sleep(ms: number) {
  return new Promise(res => setTimeout(res, ms));
}

async function fetchEmbeddingsWithRetry(texts: string[]): Promise<number[][]> {
  let lastError: Error = new Error("Unknown error");

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(JINA_BASE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${JINA_API_KEY}` },
        body: JSON.stringify({ model: JINA_MODEL, input: texts }),
      });

      if (res.status === 429) {
        await sleep(RETRY_DELAY_MS * attempt);
        continue;
      }

      if (!res.ok) throw new Error(`Jina API error: ${res.status} ${res.statusText}`);
      const json = (await res.json()) as JinaEmbeddingResponse;
      return json.data.map(d => d.embedding);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY_MS * attempt);
    }
  }

  throw lastError;
}

async function upsertBatch(batch: typeof emails, embeddings: number[][]) {
  const points = batch.map((email, idx) => {
    const rawPayload = {
      id: email.id,
      conversationId: email.conversationId,
      subject: email.subject,
      from: email.from,
      to: email.to,
      labels: email.labels,
      importance: email.importance,
      timestamp: new Date(email.timestamp).getTime(),
      organizations: extractOrganizations(email),
      bodySnippet: email.body.slice(0, 200),
    };

    const validatedPayload = EmailVectorPayload.parse(rawPayload);

    return {
      id: toDeterministicUUID(email.id),
      vector: embeddings[idx],
      payload: validatedPayload,
    };
  });

  await qdrant.upsert(COLLECTION_NAME, { points });
}

export async function ingestEmails(): Promise<IngestResultType> {
  await createCollection(VECTOR_SIZE);

  let successCount = 0;
  let failCount = 0;
  const start = Date.now();

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

  const result: IngestResultType = {
    total: emails.length,
    success: successCount,
    failed: failCount,
    durationMs: Date.now() - start,
  };

  console.log(`Ingestion complete in ${result.durationMs}ms`);
  console.log(`Success: ${result.success} | Failed: ${result.failed}`);

  return result;
}