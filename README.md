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

## Install Dependencies
```bash
npm install
```

- `@google/generative-ai` — Gemini LLM streaming
- `@qdrant/js-client-rest` — Qdrant vector database client
- `dotenv` — environment variable management
- `node-fetch` — HTTP requests for Jina embeddings API
- `zod` — request validation and type inference
- `typescript` — TypeScript compiler
- `tsx` — run TypeScript directly without compiling
- `@types/node` — Node.js type definitions

### 3. Set up environment variables
```bash
cp .env.example .env
```
Fill in API keys in `.env`.

## Start Qdrant
```bash
docker run -p 6333:6333 -p 6334:6334 qdrant/qdrant
```

## Run Ingestion
```bash
npx tsx scripts/seed.ts
```

## Architecture
User Query
↓
Embed Query (Jina Embeddings)
↓
Vector Search (Qdrant - cosine similarity)
↓
Signal Scoring (subject + participant + label + recency)
↓
Filter & Deduplicate Results
↓
Build Context + Call Gemini LLM
↓
Stream Answer with Citations

