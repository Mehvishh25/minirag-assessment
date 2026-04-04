import "dotenv/config";
import express from "express";
import { SearchRequest } from "./types.js";
import { ingestEmails } from "./ingest.js";
import { search } from "./search.js";
import { generateAnswer, extractCitations } from "./generate.js";

const app = express();
app.use(express.json());

const PORT = process.env.PORT ?? 3000;

app.post("/ingest", async (_req, res) => {
  const start = Date.now();
  try {
    const result = await ingestEmails();
    res.json({ ...result, processingTimeMs: Date.now() - start });
  } catch (err) {
    console.error("Ingest error:", err);
    res.status(500).json({ error: "Ingestion failed", detail: String(err) });
  }
});

app.post("/search", async (req, res) => {
  const start = Date.now();
  const parsed = SearchRequest.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", issues: parsed.error.issues });
    return;
  }

  try {
    const results = await search(parsed.data);
    res.json({ results, processingTimeMs: Date.now() - start });
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ error: "Search failed", detail: String(err) });
  }
});

app.post("/query", async (req, res) => {
  const start = Date.now();
  const parsed = SearchRequest.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", issues: parsed.error.issues });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const results = await search(parsed.data);
    let fullAnswer = "";

    for await (const chunk of generateAnswer(parsed.data.query, results)) {
      fullAnswer += chunk;
      res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
    }

    const citations = extractCitations(fullAnswer);
    res.write(
      `data: ${JSON.stringify({
        done: true,
        citations,
        processingTimeMs: Date.now() - start,
      })}\n\n`
    );
  } catch (err) {
    console.error("Query error:", err);
    res.write(`data: ${JSON.stringify({ error: String(err) })}\n\n`);
  } finally {
    res.end();
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
