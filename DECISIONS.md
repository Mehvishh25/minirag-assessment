## 1. What text do you embed for each email, and why?

I embed subject, sender, recipients, and body together. Subject captures the topic, body has the full context, and participants let queries like "emails from sarah" or "emails to cloud9" work. Embedding all four means the vector represents the complete email rather than just its content.

## 2. What metadata fields do you store in the Qdrant payload, and why?

I store id, conversationId, subject, from, to, labels, importance, timestamp, and organizations. The id and conversationId are needed to reference and group emails. Subject, from, to, and labels feed directly into the scoring signals. Timestamp is stored as milliseconds for date range filtering. Organizations is derived from all participant domains (from domain, to domains, and labels) so filtering by company works across senders and recipients. The full body is skipped since it is already encoded in the vector.

## 3. How does your scoring algorithm work, and what trade-offs did you make?

combinedScore = (vectorScore * 0.5) + (signalScore * 0.5). The signal score combines subjectMatch (0.35), participantMatch (0.25), labelMatch (0.20), and recencyBoost (0.20). Vector search alone misses exact keyword matches and keyword matching alone misses semantic meaning, so combining both works better. Subject gets the highest weight because it is the most reliable indicator of topic. The trade-off is added latency over pure vector search, but the quality improvement is worth it.

## 4. How did you design your LLM prompt to prevent hallucination?

The prompt instructs the LLM to answer only from the provided email context and never use outside knowledge. Every claim must be cited with an email ID like [email-001] so answers are verifiable. If the context does not contain enough information the LLM responds with "I don't have enough information" rather than guessing. Fabricating names, dates, or figures not present in the emails is explicitly prohibited.

## 5. What would you change if the dataset was 100,000 emails instead of 50?

I would move ingestion to a background queue like BullMQ so the API does not block on large batches. Embedding would be parallelized across multiple workers instead of running sequentially. Full email bodies would be stored in PostgreSQL and only essential metadata kept in Qdrant, since large payloads at scale increase memory significantly. Frequent queries would be cached to avoid re-embedding the same input repeatedly. Finally I would enable Qdrant collection sharding to distribute the index across nodes for faster search.