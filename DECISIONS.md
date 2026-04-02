## Schema Design (Task 1)

I used Zod to define all schemas to ensure runtime validation and strict TypeScript types. 
For the Qdrant payload (EmailVectorPayload), I included only metadata useful for filtering, scoring, and display (id, conversationId, subject, participants, timestamp, labels, importance, and optional organization). 
I intentionally excluded the email body from the payload because its semantic meaning is captured by the embedding vector, and storing the full body in the payload would increase storage and slow queries. 
SearchRequest was designed to support flexible filters (date range, participants, organization) while keeping the structure simple for API use. 
SearchResponse includes scores, snippets, and citations to provide enough context for the LLM without storing unnecessary full content.

## Task 2: Ingestion Pipeline Decisions

### Embedding Text Design
I embed subject, sender, recipients, and body. The subject captures intent, the body provides detailed meaning, and participants add conversational context. Combining all fields produces richer embeddings than using only the body.

### Payload Design
I store id, conversationId, subject, from, to, timestamp, labels, importance, and organization. These fields support filtering, ranking, and display. The body is excluded since its meaning is already captured in embeddings, improving efficiency.

### Batch Processing Strategy
Batching reduces API calls and improves efficiency. A batch size of 5 balances performance while avoiding rate limits and keeping retries manageable.

### Deterministic ID Generation
I hash the email ID using SHA-256 to generate consistent IDs. This prevents duplicates and allows safe re-ingestion.

### Error Handling Strategy
Failures are handled per batch. If embedding or upsert fails, it is logged and skipped while the rest continue processing. Final results track success and failures.

### Qdrant Collection & Indexing
The collection uses 1024-dimensional vectors with cosine similarity. Indexes are created on from, labels, timestamp, and organization to enable efficient filtering during search.