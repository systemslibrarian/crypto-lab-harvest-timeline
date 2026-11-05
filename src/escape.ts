/**
 * The escape every rendered value in this lab goes through.
 *
 * It lived in main.ts and escaped only `&`, `<` and `>`. Most of its call sites
 * interpolate into an ATTRIBUTE — `title="…"`, `data-…="…"`, `aria-label="…"` — so a
 * value carrying a double quote closed the attribute and opened whatever followed.
 * CodeQL reported seven js/incomplete-html-attribute-sanitization alerts on that one
 * omission, and completing it (43058f6) fixed all seven at once.
 *
 * Extracted here so the completeness is a property a test can hold, rather than a
 * line in a 1,400-line rendering layer that nothing would notice losing. The order
 * matters: `&` must go first, or it would rewrite the ampersands the later
 * replacements introduce.
 */
export function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
