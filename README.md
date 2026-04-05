# MiniRAG Assessment

A simplified email search engine that ingests emails, embeds them into a vector database, and answers natural language questions using retrieved context and an LLM.

## Loom Walkthrough Video
- (coming soon)

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
curl -X POST http://localhost:3000/search \
  -H "Content-Type: application/json" \
  -d '{"query": "Cloud9 sponsorship", "topK": 5}'
```

### POST /query
Accepts a query and filters, runs search and LLM generation, streams the response.
```bash
curl -X POST http://localhost:3000/query \
  -H "Content-Type: application/json" \
  -d '{"query": "What is the status of the Cloud9 sponsorship deal?"}'
```

## Architecture
User Query
->
Embed Query (Jina Embeddings)
->
Vector Search (Qdrant - cosine similarity)
->
Signal Scoring (subject + participant + label + recency)
->
Filter & Deduplicate Results
->
Build Context + Call Gemini LLM
->
Stream Answer with Citations
