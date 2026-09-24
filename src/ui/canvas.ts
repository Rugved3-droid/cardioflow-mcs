/** Canvas helpers shared by the waveform and PV-loop renderers. */

const varCache = new Map<string, string>();
/** Theme token lookup (cached: the palette is fixed for the life of the page). */
export function CSSVAR(name: string): string {
  let v = varCache.get(name);
  if (v === undefined) {
    v = getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#fff';
    varCache.set(name, v);
  }
  return v;
}

/** Resize a canvas backing store to its CSS box at device pixel ratio. Returns [w, h] in CSS px. */
export function fitCanvas(c: HTMLCanvasElement): [number, number, CanvasRenderingContext2D] {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = c.clientWidth;
  const h = c.clientHeight;
  const bw = Math.max(1, Math.round(w * dpr));
  const bh = Math.max(1, Math.round(h * dpr));
  if (c.width !== bw || c.height !== bh) {
    c.width = bw;
    c.height = bh;
  }
  const ctx = c.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return [w, h, ctx];
}

export const MONO = "600 11px 'JetBrains Mono', 'Cascadia Mono', Consolas, monospace";
