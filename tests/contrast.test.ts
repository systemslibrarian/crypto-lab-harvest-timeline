// WCAG AA contrast regression guard.
//
// Parses the real CSS custom properties out of src/style.css and asserts every
// color used as TEXT clears the WCAG 2.1 AA 4.5:1 ratio for normal text against
// the surfaces it can sit on — in BOTH the dark (:root) and light themes. This
// pins the contrast audit so a future palette tweak can't silently regress
// accessibility. Backgrounds include the translucent *-dim tints used by badges
// and status pills, composited over the surface.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const css = readFileSync(fileURLToPath(new URL('../src/style.css', import.meta.url)), 'utf8');

function block(selector: string): string {
  const start = css.indexOf(selector);
  if (start === -1) throw new Error(`block not found: ${selector}`);
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  return css.slice(open + 1, close);
}

function vars(selector: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /--color-([a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block(selector)))) out[m[1]] = m[2];
  return out;
}

const root = vars(':root');
const light = { ...root, ...vars("[data-theme='light']") }; // light cascades over root

// ── contrast math (WCAG 2.1) ────────────────────────────────────────────────
const lin = (c: number): number => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const rgb = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16),
];
const lum = (hex: string): number => {
  const [r, g, b] = rgb(hex);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};
const ratioL = (la: number, lb: number): number =>
  (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
const ratio = (fg: string, bgLum: number): number => ratioL(lum(fg), bgLum);
// composite a translucent overlay (alpha) over an opaque background
const overlay = (fg: string, a: number, bg: string): number => {
  const [fr, fg2, fb] = rgb(fg);
  const [br, bg2, bb] = rgb(bg);
  return 0.2126 * lin(a * fr + (1 - a) * br)
    + 0.7152 * lin(a * fg2 + (1 - a) * bg2)
    + 0.0722 * lin(a * fb + (1 - a) * bb);
};

// The translucent *-dim badge/pill background base colors (from style.css).
const DIM_BASE: Record<string, string> = {
  safe: '#00ff88', low: '#00ff88', amber: '#ffaa00', danger: '#ff3366',
  critical: '#ff1144', today: '#00d4ff',
};

// Every custom property used as small text somewhere in the UI.
const TEXT_KEYS = [
  'text', 'text-muted', 'text-dim',
  'safe', 'low', 'amber', 'danger', 'critical', 'crqc', 'today', 'lifetime', 'migration',
];

function worstRatio(theme: Record<string, string>, key: string): number {
  const fg = theme[key];
  const backdrops = ['surface', 'surface-2', 'bg'].map(b => lum(theme[b]));
  const dimKey = key === 'low' ? 'safe' : key;
  if (DIM_BASE[dimKey]) {
    backdrops.push(overlay(DIM_BASE[dimKey], 0.15, theme['surface']));
    backdrops.push(overlay(DIM_BASE[dimKey], 0.15, theme['surface-2']));
  }
  return Math.min(...backdrops.map(b => ratio(fg, b)));
}

describe.each([
  ['dark (:root)', root],
  ['light ([data-theme=light])', light],
])('WCAG AA text contrast — %s theme', (_label, theme) => {
  it.each(TEXT_KEYS)('--color-%s clears 4.5:1 on every surface it sits on', (key) => {
    expect(theme[key], `--color-${key} must be defined`).toBeDefined();
    const r = worstRatio(theme, key);
    expect(r, `--color-${key} = ${theme[key]} worst ratio ${r.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
  });
});
