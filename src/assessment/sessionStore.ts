/**
 * Anonymous session logging. Everything stays on the machine running the page
 * (browser localStorage) until someone exports it. No names, no network.
 *
 * Export: one JSON per session, and one aggregate CSV across every session stored
 * on this machine (plus any imported from other machines).
 */

import type { Direction } from './itemBank';

export const APP_VERSION = '0.2.0';
const KEY = 'cardioflow-mcs.sessions.v1';

export interface ItemResponse {
  itemId: string;
  construct: string;
  competencyItem: boolean;
  stem: string;
  prediction: Direction;
  predictionLabel: string;
  correctAnswer: Direction;
  predictionCorrect: boolean;
  /** item shown -> answer locked, ms */
  latencyMs: number;
  mechanismChoice: number;
  mechanismCorrectIndex: number;
  mechanismCorrect: boolean;
  mechanismLatencyMs: number;
  shownAt: string;
  lockedAt: string;
}

export interface Session {
  sessionId: string;
  /** optional non-identifying group tag, e.g. "PGY2-Oct" */
  cohort: string;
  startedAt: string;
  finishedAt: string | null;
  appVersion: string;
  responses: ItemResponse[];
}

/** e.g. "K7QX-M2PA" — random, not derived from anything about the user or machine. */
export function newSessionId(): string {
  const a = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const r = new Uint8Array(8);
  crypto.getRandomValues(r);
  const s = Array.from(r, (b) => a[b % a.length]).join('');
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}

function read(): Session[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Session[]) : [];
  } catch {
    return [];
  }
}

function write(all: Session[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
    return true;
  } catch {
    return false;
  }
}

export function allSessions(): Session[] {
  return read();
}

export function saveSession(s: Session): boolean {
  const all = read().filter((x) => x.sessionId !== s.sessionId);
  all.push(s);
  return write(all);
}

/** Merge sessions from exported JSON files (single session or array). Returns count added/updated. */
export function importSessions(json: unknown): number {
  const list = (Array.isArray(json) ? json : [json]) as Session[];
  const valid = list.filter((s) => s && typeof s.sessionId === 'string' && Array.isArray(s.responses));
  const all = read();
  for (const s of valid) {
    const i = all.findIndex((x) => x.sessionId === s.sessionId);
    if (i >= 0) all[i] = s;
    else all.push(s);
  }
  write(all);
  return valid.length;
}

export function clearAllSessions(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
}

const CSV_COLS = [
  'session_id', 'cohort', 'app_version', 'session_started_at', 'item_id', 'construct', 'competency_item', 'stem',
  'prediction', 'correct_answer', 'prediction_correct', 'latency_ms', 'mechanism_choice', 'mechanism_correct_choice',
  'mechanism_correct', 'mechanism_latency_ms', 'shown_at', 'locked_at',
] as const;

function csvCell(v: unknown): string {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function aggregateCsv(sessions: Session[]): string {
  const lines = [CSV_COLS.join(',')];
  for (const s of sessions) {
    for (const r of s.responses) {
      lines.push(
        [
          s.sessionId, s.cohort, s.appVersion, s.startedAt, r.itemId, r.construct, r.competencyItem, r.stem,
          r.prediction, r.correctAnswer, r.predictionCorrect, Math.round(r.latencyMs), r.mechanismChoice,
          r.mechanismCorrectIndex, r.mechanismCorrect, Math.round(r.mechanismLatencyMs), r.shownAt, r.lockedAt,
        ].map(csvCell).join(','),
      );
    }
  }
  return lines.join('\n') + '\n';
}

export function download(filename: string, text: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
