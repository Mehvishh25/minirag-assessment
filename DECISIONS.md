## 1. What text do you embed for each email, and why?

I embed the subject, sender, recipients, and body of each email combined into a single string. The subject captures the topic concisely, the body contains the full context, and including sender and recipients allows the search to match queries like "emails from sarah" or "emails to cloud9". Embedding all four fields together means the vector represents the full semantic meaning of the email rather than just its content. Leaving out any one of these would reduce search accuracy for queries that reference participants or topics only mentioned in the subject.

## 2. What metadata fields do you store in the Qdrant payload, and why?

I store id, conversationId, subject, from, to, labels, importance, timestamp, and organization in the payload. The id and conversationId are needed to reference the original email and group threads. Subject, from, to, and labels are used directly in the scoring algorithm for keyword and participant matching. Importance is stored for the importance boost signal in scoring. Timestamp is stored as milliseconds to enable date range filtering in Qdrant. Organization is derived from the sender domain and stored for filtering emails by company. The full body is not stored in the payload since it is already encoded in the vector.

## 3. How does your scoring algorithm work, and what trade-offs did you make?

The combined score is calculated as combinedScore = (vectorScore * 0.5) + (signalScore * 0.5). The signalScore is a weighted average of four signals: subjectMatch (0.35), participantMatch (0.25), labelMatch (0.20), and recencyBoost (0.20). Vector similarity alone can miss exact keyword matches, and keyword matching alone misses semantic meaning, so combining both gives better results. Subject match gets the highest weight because the subject is the most concise and reliable indicator of email topic. The trade-off is that this scoring adds latency compared to pure vector search, but the improvement in result quality justifies it.

## 4. How did you design your LLM prompt to prevent hallucination?

The system prompt instructs the LLM to answer only based on the provided email context and never draw on outside knowledge. It requires the LLM to cite the specific email ID for every claim it makes so answers are verifiable. When the context does not contain enough information to answer the query, the LLM is instructed to respond with "I don't have enough information" rather than guessing. The prompt also explicitly tells the LLM never to fabricate names, dates, or figures not present in the retrieved emails.

## 5. What would you change if the dataset was 100,000 emails instead of 50?

With 100,000 emails I would move ingestion to an async background queue using a tool like BullMQ so the API does not block while processing large batches. I would parallelize embedding across multiple workers instead of processing sequentially. I would store only essential metadata in Qdrant and retrieve full email content from a separate database like PostgreSQL when needed, since storing large payloads in Qdrant at scale increases memory usage significantly. I would also add a caching layer for frequent queries to avoid re-embedding the same queries repeatedly. Finally I would use Qdrant's collection sharding to distribute the index across multiple nodes for faster search at scale.