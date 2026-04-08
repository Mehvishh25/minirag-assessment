import "dotenv/config";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { ScoredEmail } from "./scoring.js";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

const SYSTEM_PROMPT = `You are an email search assistant. You have been given a set of relevant emails as context.
Answer the user's question using the information in these emails.
After every claim, cite the email ID in brackets like [email-001].
If the emails do not contain enough information to answer, say "I don't have enough information to answer this."
Never make up information that is not present in the emails.
For greetings or chitchat, respond politely without using the emails.`

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

  const lower = query.toLowerCase();

  const cleaned = chitchatPatterns.reduce(
    (q, word) => q.replace(new RegExp(`\\b${word}\\b`, "gi"), ""),
    lower
  ).trim();

  return cleaned.length === 0;
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
  const matches = text.match(/email-\d+/g) ?? [];
  return [...new Set(matches)];
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