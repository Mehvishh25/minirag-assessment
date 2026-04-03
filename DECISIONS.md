## Schema Design (Task 1)

I used Zod for runtime validation and strict TypeScript types.
The Qdrant payload stores only metadata useful for filtering, scoring, and display: id, conversationId, subject, from, to, timestamp, labels, importance, organization, and bodySnippet.
I store a 200-character bodySnippet instead of the full body so that semantic meaning is captured in the vector, but a snippet is needed for LLM context assembly.
SearchRequest supports flexible filters (dateFrom, dateTo, organization, from, to).
SearchResponse has optional answer and citations — empty for /search, populated for /query.

## Task 2: Ingestion Pipeline Decisions

### Embedding Text Design
I embed subject, sender, recipients, and body. Subject captures intent, body provides detail, and participants add conversational context. Combining all fields produces richer embeddings than body alone.

### Payload Design
I store id, conversationId, subject, from, to, timestamp, labels, importance, organization, and bodySnippet. Full body is excluded since its meaning is captured in the vector. A 200-character bodySnippet is stored separately for LLM context assembly.

### Batch Processing Strategy
Batching reduces API calls. A batch size of 5 balances performance while avoiding rate limits and keeping retries manageable.

### Deterministic ID Generation
I hash the email ID using SHA-256 to generate consistent UUIDs. This prevents duplicates and allows safe re-ingestion.

### Error Handling Strategy
Failures are handled per batch — if embedding or upsert fails, it is logged and skipped while the rest continue. IngestResult tracks success and failure counts.

### Qdrant Collection & Indexing
1024-dimensional vectors with cosine similarity. Indexes on from, labels, timestamp, and organization enable efficient Qdrant-level filtering, avoiding full scans.

### Why Jina Instead of OpenAI
Jina offers a free tier avoiding API costs during assessment. 1024 dimensions provide sufficient resolution for 50 emails. In production I would benchmark both before deciding.

## Task 3: Hybrid Search & Scoring Decisions

### Why Hybrid Search
Pure vector search can miss keyword matches — "Cloud9" in a subject might score lower than a semantically similar email that never mentions it. Combining vector (0.5) and keyword signals (0.5) balances semantic understanding with exact term matching.

### Scoring Formula
combinedScore = (vectorScore * 0.5) + (signalScore * 0.5). Equal weight because neither should dominate — vector handles semantics, signals handle structured metadata.

### Signal Weights Reasoning
subjectMatch (0.35) is highest because subjects are the most concentrated topic summary. participantMatch (0.25) is second because from/to matches are precise. labelMatch (0.20) is reliable but inconsistently present. recencyBoost (0.20) nudges newer results without overriding content relevance.

### Recency Normalization
Timestamps normalized to [0, 1] using (timestamp - oldest) / (newest - oldest). Newest email always scores 1.0, oldest scores 0.0. Without normalization, absolute timestamps would be meaningless as a score.

### Threshold Filtering
Results below 0.25 are dropped, removing noise emails with low vector similarity and low keyword overlap. 0.25 is low enough to not miss relevant emails while filtering newsletters and auto-replies.

### Deduplication by conversationId
Only the highest-scoring email per conversationId is returned. This prevents thread emails from flooding results with near-duplicate content.

### Filters Applied at Qdrant Level
Filters (dateFrom, dateTo, organization, from) are applied inside Qdrant before retrieval, not post-retrieval. Payload indexes skip irrelevant vectors entirely, reducing the candidate set before scoring.
