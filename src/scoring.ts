import { EmailVectorPayloadType } from "./types.js";

interface ScoreSignals {
  subjectMatch: number;
  participantMatch: number;
  labelMatch: number;
  recencyBoost: number;
}

export interface ScoredEmail {
  id: string;
  conversationId: string;
  subject: string;
  from: string;
  to: string[];
  labels: string[];
  importance: string;
  timestamp: number;
  bodySnippet: string;
  vectorScore: number;
  signalScore: number;
  combinedScore: number;
}

function tokenize(text: string): string[] {
  return text.toLowerCase().split(/\W+/).filter(Boolean);
}

function subjectMatch(queryTerms: string[], subject: string): number {
  const subjectTerms = tokenize(subject);
  const matches = queryTerms.filter(t => subjectTerms.includes(t)).length;
  return queryTerms.length === 0 ? 0 : matches / queryTerms.length;
}

function participantMatch(queryTerms: string[], from: string, to: string[]): number {
  const allParticipants = [from, ...to].join(" ").toLowerCase();
  const matches = queryTerms.filter(t => allParticipants.includes(t)).length;
  return queryTerms.length === 0 ? 0 : Math.min(matches / queryTerms.length, 1);
}

function labelMatch(queryTerms: string[], labels: string[]): number {
  const labelText = labels.join(" ").toLowerCase();
  const matches = queryTerms.filter(t => labelText.includes(t)).length;
  return queryTerms.length === 0 ? 0 : Math.min(matches / queryTerms.length, 1);
}

function recencyBoost(timestamp: number, oldest: number, newest: number): number {
  if (newest === oldest) return 1;
  return (timestamp - oldest) / (newest - oldest);
}

export function computeSignalScore(
  queryTerms: string[],
  payload: EmailVectorPayloadType,
  oldest: number,
  newest: number
): ScoreSignals {
  return {
    subjectMatch: subjectMatch(queryTerms, payload.subject),
    participantMatch: participantMatch(queryTerms, payload.from, payload.to),
    labelMatch: labelMatch(queryTerms, payload.labels),
    recencyBoost: recencyBoost(payload.timestamp, oldest, newest),
  };
}

export function computeCombinedScore(
  vectorScore: number,
  signals: ScoreSignals
): { signalScore: number; combinedScore: number } {
  const signalScore =
    signals.subjectMatch * 0.35 +
    signals.participantMatch * 0.25 +
    signals.labelMatch * 0.20 +
    signals.recencyBoost * 0.20;

  const combinedScore = vectorScore * 0.5 + signalScore * 0.5;

  return { signalScore, combinedScore };
}