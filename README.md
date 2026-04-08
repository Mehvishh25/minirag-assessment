# MiniRAG Assessment

A simplified email search engine that ingests emails, embeds them into a vector database, and answers natural language questions using retrieved context and an LLM.

## Loom Walkthrough Video
https://www.loom.com/share/28062d28e7cc4c13a9947663eddd6711

## How to Install and Run

### 1. Clone the repo
```bash
git clone https://github.com/Mehvishh25/minirag-assessment.git
cd minirag-assessment
```

### 2. Install dependencies
```bash
npm install
```

Dependencies used:
- `@google/generative-ai` — Gemini LLM streaming
- `@qdrant/js-client-rest` — Qdrant vector database client
- `dotenv` — environment variable management
- `express` — HTTP server
- `node-fetch` — HTTP requests for Jina embedding API
- `zod` — request validation and type inference
- `typescript` — TypeScript compiler
- `tsx` — run TypeScript directly without compiling
- `@types/node` — Node.js type definitions

### 3. Set up environment variables
```bash
cp .env.example .env
```
Fill in your API keys in `.env`.

### 4. Start Qdrant
```bash
docker run -p 6333:6333 -p 6334:6334 qdrant/qdrant
```

### 5. Run ingestion
```bash
npx tsx scripts/seed.ts
```

### 6. Start the server
```bash
npm run dev (or)
npx tsx src/server.ts
```

## API Endpoints

### POST /ingest
Triggers the ingestion pipeline and returns an IngestResult.
```bash
curl -X POST http://localhost:3000/ingest
```

### POST /search
Accepts a SearchRequest body and returns scored results without an LLM answer.
```bash
curl -X POST http://localhost:3000/search -H "Content-Type: application/json" -d "{\"query\": \"Cloud9 sponsorship\"}"
```

With filters:
```bash
curl -X POST http://localhost:3000/search -H "Content-Type: application/json" -d "{\"query\": \"sponsorship\", \"filters\": {\"organization\": \"cloud9.gg\", \"excludeLabels\": [\"newsletter\", \"spam\"]}}"
```

### POST /query
Accepts a query and filters, runs search and LLM generation, streams the response.
```bash
curl -X POST http://localhost:3000/query -H "Content-Type: application/json" -d "{\"query\": \"Cloud9 sponsorship\"}"
```

With filters:
```bash
curl -X POST http://localhost:3000/query -H "Content-Type: application/json" -d "{\"query\": \"sponsorship\", \"filters\": {\"dateFrom\": \"2026-01-01\", \"dateTo\": \"2026-02-01\"}}"
```

## Architecture
```
User Query
    ↓
Embed Query (Jina Embeddings)
    ↓
Vector Search (Qdrant - cosine similarity)
+ Metadata Filters (must / should / must_not)
    ↓
Signal Scoring
(subjectMatch * 0.35 + participantMatch * 0.25 + labelMatch * 0.20 + recencyBoost * 0.20)
    ↓
Threshold Filter (>= 0.25) + Conversation Deduplication
    ↓
Build Context + Call Gemini LLM
    ↓
Stream Answer with Citations
```

## Tech Stack

- **Language**: TypeScript (strict mode)
- **Runtime**: Node.js 20+
- **Vector DB**: Qdrant
- **Embeddings**: Jina (jina-embeddings-v3, 1024 dimensions)
- **LLM**: Google Gemini 2.5 Flash
- **Framework**: Express
- **Validation**: Zod
