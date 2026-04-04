import "dotenv/config";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { ScoredEmail } from "./scoring.js";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

const SYSTEM_PROMPT = `You are an email search assistant.
You answer questions based ONLY on the email context provided to you.

Rules you must follow:
1. Only use information present in the provided emails
2. Cite the email ID (e.g. [email-001]) after every claim you make
3. If the context does not contain enough information, say exactly: "I don't have enough information to answer this."
4. Never fabricate names, dates, numbers, or decisions not present in the emails
5. If the question is chitchat (hello, thanks, how are you), respond politely without using email context`;

const MAX_CONTEXT_EMAILS = 5;

export interface GenerateResult {
  answer: string;
  citations: string[];
}

function isChitchat(query: string): boolean {
  const chitchatPatterns = [
    "hello", "hi", "hey", "thanks",
    "thank you", "bye", "how are you"
  ];
  const lower = query.toLowerCase().trim();
  return chitchatPatterns.some(p =>
    new RegExp(`\\b${p}\\b`, "i").test(lower)
  );
}

function buildContext(results: ScoredEmail[]): string {
  const topResults = results.slice(0, MAX_CONTEXT_EMAILS);

  return topResults.map(email => {
    const date = new Date(email.timestamp).toISOString().split("T")[0];
    return [
      `Email ID: ${email.id}`,
      `Subject: ${email.subject}`,
      `From: ${email.from}`,
      `Date: ${date}`,
      `Relevance Score: ${email.combinedScore.toFixed(3)}`,
      `Body: ${email.bodySnippet}`,
    ].join("\n");
  }).join("\n\n---\n\n");
}

export function extractCitations(text: string): string[] {
  const matches = text.match(/\[email-\d+\]/g) ?? [];
  return [...new Set(matches)].map(m => m.replace(/[\[\]]/g, ""));
}

export async function* generateAnswer(
  query: string,
  results: ScoredEmail[]
): AsyncGenerator<string> {
  if (isChitchat(query)) {
    yield "Hello! I'm your email search assistant. Ask me anything about your emails!";
    return;
  }

  if (results.length === 0) {
    yield "I don't have enough information to answer this. No relevant emails were found for your query.";
    return;
  }

  const context = buildContext(results);

  const prompt = `${SYSTEM_PROMPT}

Here are the relevant emails:

${context}

Question: ${query}

Answer (cite email IDs like [email-001] after each claim):`;

  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const streamResult = await model.generateContentStream(prompt);

  for await (const chunk of streamResult.stream) {
    const text = chunk.text();
    if (text) yield text;
  }
}

export async function generate(
  query: string,
  results: ScoredEmail[]
): Promise<GenerateResult> {
  let fullAnswer = "";

  for await (const chunk of generateAnswer(query, results)) {
    fullAnswer += chunk;
  }

  const citations = extractCitations(fullAnswer);
  return { answer: fullAnswer, citations };
}