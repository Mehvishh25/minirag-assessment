import "dotenv/config";
import { qdrant, COLLECTION_NAME } from "./qdrant.js";
import { SearchRequestType, EmailVectorPayloadType } from "./types.js";
import { computeSignalScore, computeCombinedScore, ScoredEmail } from "./scoring.js";

const JINA_API_KEY = process.env.JINA_EMBEDDING_API_KEY as string;
const JINA_BASE_URL = process.env.JINA_EMBEDDING_BASE_URL as string;
const JINA_MODEL = process.env.JINA_EMBEDDING_MODEL as string;

const COMBINED_SCORE_THRESHOLD = 0.25;

async function embedQuery(query: string): Promise<number[]> {
  const response = await fetch(JINA_BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${JINA_API_KEY}`,
    },
    body: JSON.stringify({ model: JINA_MODEL, input: [query] }),
  });

  if (!response.ok) {
    throw new Error(`Jina embed failed: ${response.status}`);
  }

  const json = await response.json() as { data: { embedding: number[] }[] };
  return json.data[0].embedding;
}

function buildQdrantFilter(filters?: SearchRequestType["filters"]) {
  if (!filters) return undefined;

  const must: any[] = [];

  if (filters.from) {
    must.push({ key: "from", match: { value: filters.from } });
  }

  if (filters.organization) {
    must.push({ key: "organization", match: { value: filters.organization } });
  }

  if (filters.dateFrom || filters.dateTo) {
    const range: Record<string, number> = {};
    if (filters.dateFrom) range.gte = new Date(filters.dateFrom).getTime();
    if (filters.dateTo) range.lte = new Date(filters.dateTo).getTime();
    must.push({ key: "timestamp", range });
  }

  return must.length > 0 ? { must } : undefined;
}

function deduplicateByConversation(emails: ScoredEmail[]): ScoredEmail[] {
  const best = new Map<string, ScoredEmail>();

  for (const email of emails) {
    const existing = best.get(email.conversationId);
    if (!existing || email.combinedScore > existing.combinedScore) {
      best.set(email.conversationId, email);
    }
  }

  return Array.from(best.values())
    .sort((a, b) => b.combinedScore - a.combinedScore);
}

export async function search(request: SearchRequestType): Promise<ScoredEmail[]> {
  const topK = request.topK ?? 10;

  const queryVector = await embedQuery(request.query);

  const filter = buildQdrantFilter(request.filters);

  const qdrantResults = await qdrant.search(COLLECTION_NAME, {
    vector: queryVector,
    limit: topK,
    filter,
    with_payload: true,
  });

  if (qdrantResults.length === 0) return [];

  const timestamps = qdrantResults.map(
    r => (r.payload as EmailVectorPayloadType).timestamp
  );
  const oldest = Math.min(...timestamps);
  const newest = Math.max(...timestamps);

  const queryTerms = request.query.toLowerCase().split(/\W+/).filter(Boolean);

  const scored: ScoredEmail[] = qdrantResults.map(result => {
    const payload = result.payload as EmailVectorPayloadType;
    const vectorScore = result.score;

    const signals = computeSignalScore(queryTerms, payload, oldest, newest);
    const { signalScore, combinedScore } = computeCombinedScore(vectorScore, signals);

    return {
      id: payload.id,
      conversationId: payload.conversationId,
      subject: payload.subject,
      from: payload.from,
      to: payload.to,
      labels: payload.labels,
      importance: payload.importance,
      timestamp: payload.timestamp,
      bodySnippet: payload.bodySnippet,
      vectorScore,
      signalScore,
      combinedScore,
    };
  });

  const filtered = scored.filter(e => e.combinedScore >= COMBINED_SCORE_THRESHOLD);

  return deduplicateByConversation(filtered);
}