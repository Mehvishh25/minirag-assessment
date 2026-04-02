import { z } from "zod";

export const EmailSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  subject: z.string(),
  from: z.string(),
  to: z.array(z.string()),
  cc: z.array(z.string()),
  body: z.string(),
  timestamp: z.string(),
  hasAttachments: z.boolean(),
  importance: z.enum(["low", "medium", "high"]),
  labels: z.array(z.string())
});

export type Email = z.infer<typeof EmailSchema>;


export const EmailVectorPayload = z.object({
  id: z.string(),
  conversationId: z.string(),
  subject: z.string(),
  from: z.string(),
  to: z.array(z.string()),
  timestamp: z.string(),
  organization: z.string().optional(),
  labels: z.array(z.string()),
  importance: z.enum(["low", "medium", "high"])
});

export type EmailVectorPayloadType = z.infer<typeof EmailVectorPayload>;


export const SearchRequest = z.object({
  query: z.string(),
  topK: z.number().optional(),
  filters: z.object({
    organization: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional()
  }).optional()
});

export type SearchRequestType = z.infer<typeof SearchRequest>;


export const SearchResponse = z.object({
  results: z.array(
    z.object({
      id: z.string(),
      score: z.number(),
      subject: z.string(),
      snippet: z.string()
    })
  ),
  answer: z.string(),
  citations: z.array(z.string())
});

export type SearchResponseType = z.infer<typeof SearchResponse>;


export const IngestResult = z.object({
  total: z.number(),
  success: z.number(),
  failed: z.number(),
  durationMs: z.number()
});

export type IngestResultType = z.infer<typeof IngestResult>;