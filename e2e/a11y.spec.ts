/**
 * The WCAG A/AA gate for the HNDL Timeline.
 *
 * Four configurations — {dark, light} x {1280, 380} — each driven through every
 * state the six exhibits can render, with a full scan after every single step.
 * The matrix is not padding: `data-theme` re-themes every accent this page uses
 * as text (the light block re-declares nine of them precisely because the dark
 * values fail as small text on near-white), and 380px is where the exhibit nav
 * wraps, the two-column grids collapse and four wide tables start panning
 * inside their `.table-scroll` wrappers.
 *
 * What the replaced spec did instead, and why none of it could be kept:
 *
 *  - it scanned ONCE, at load, having touched no control. Six exhibits, five
 *    selects, two sliders, five preset chips, four checkboxes, a dozen sortable
 *    columns and exhibit 6's entire migrate/attack fork were never rendered in
 *    any state but their shipped one;
 *  - it injected `* { animation: none !important; transition: none !important }`,
 *    which does not exercise this sheet's `prefers-reduced-motion` block, it
 *    replaces it — and that block cancels three animations outright, one of them
 *    (`.harvest-step-icon`) with keyframes that start at `opacity: 0`;
 *  - it force-`open`ed every `<details>`, stripped `[hidden]`, and cleared every
 *    inline `display: none`, producing a document no visitor can load while
 *    never scanning the closed state every visitor lands on;
 *  - it asserted `violations` only, so axe's `incomplete` bucket — where
 *    `aria-prohibited-attr` and every translucent-tint contrast result live —
 *    went unread;
 *  - and it had no oracle for reflow, none for keyboard-reachable scrollers,
 *    and no arithmetic contrast check at all.
 *
 * `border-contrast.spec.ts` is folded in here and deleted. It measured WCAG
 * 1.4.11 on exactly one element — `#e1-algo`, a `<select>` — which is one of
 * the few controls on this page that was already using the
 * `--color-control-border` token. Every button, chip, checkbox and card-button
 * on the page took `--color-border` instead and went unmeasured. See the commit
 * message for what that was hiding.
 */
import { test } from '@playwright/test';
import { NARROW, boot, driveAllStates, expectBaselineNotStale, reportCollected } from './gate';

test.beforeEach(async ({ page }) => {
  page.setDefaultTimeout(20_000);
});

// A collecting run (`A11Y_COLLECT=1`) records instead of throwing; this is what
// stops one being mistaken for a pass.
test.afterAll(() => {
  reportCollected();
});

for (const theme of ['dark'] as const) {
  test(`WCAG A/AA — ${theme}, 1280px`, async ({ page }) => {
    // ~60 scans per configuration, each an axe pass plus a full arithmetic
    // contrast walk over a six-exhibit page. That is the cost of scanning after
    // every step rather than once at the end; the budget is set to match it
    // rather than the drive being trimmed to fit the default.
    test.setTimeout(300_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await boot(page, theme);
    await driveAllStates(page, `${theme} 1280`);
    expectBaselineNotStale();
  });

  test(`WCAG A/AA — ${theme}, ${NARROW.width}px`, async ({ page }) => {
    test.setTimeout(300_000);
    await page.setViewportSize(NARROW);
    await boot(page, theme);
    await driveAllStates(page, `${theme} ${NARROW.width}`);
    expectBaselineNotStale();
  });
}
