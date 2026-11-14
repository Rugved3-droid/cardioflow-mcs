import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const RESULTS = join(here, '..', 'results');

export function writeCsv(name: string, rows: Record<string, unknown>[]): string {
  mkdirSync(RESULTS, { recursive: true });
  const cols: string[] = [];
  for (const r of rows) for (const k of Object.keys(r)) if (!cols.includes(k)) cols.push(k);
  const esc = (v: unknown) => {
    if (v === null || v === undefined) return '';
    const s = typeof v === 'number' ? (Number.isInteger(v) ? String(v) : v.toPrecision(10)) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const text = [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n') + '\n';
  const p = join(RESULTS, name);
  writeFileSync(p, text);
  return p;
}

export function writeJson(name: string, obj: unknown): string {
  mkdirSync(RESULTS, { recursive: true });
  const p = join(RESULTS, name);
  writeFileSync(p, JSON.stringify(obj, null, 2) + '\n');
  return p;
}

export function relErr(a: number, b: number, floor = 1e-12): number {
  return Math.abs(a - b) / Math.max(Math.abs(b), floor);
}
