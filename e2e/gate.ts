import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';
import { auditContrast, formatContrastFailures } from './contrast';

export const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/** A phone-width viewport, for the WCAG 1.4.10 reflow half of the gate. */
export const NARROW = { width: 380, height: 800 };

/**
 * Shared machinery for the WCAG gate.
 *
 * Three rules govern everything here:
 *
 *  1. NOTHING IS INJECTED INTO THE PAGE BEFORE A SCAN. The spec this file
 *     replaces called `revealAll()` (force-`open` on every `<details>`, strip
 *     `[hidden]`, clear every inline `display: none`) and then `neutralizeMotion()`
 *     (`* { animation: none !important; transition: none !important }`) before
 *     its single scan.
 *
 *     Injecting `animation: none` does not exercise this sheet's own
 *     `@media (prefers-reduced-motion: reduce)` block, it REPLACES it — so the
 *     suite was structurally unable to see the defect that block could cause.
 *     That is not hypothetical here: the block damps most animation with
 *     `animation-duration: 0.01ms` (which still runs the keyframes and lands on
 *     the end state) but cancels three outright with `animation: none !important`,
 *     including `.harvest-step-icon`, whose `harvest-pop` keyframes start at
 *     `opacity: 0`. Whether that leaves the icons visible is a real question
 *     about this stylesheet, and the old spec had painted over the only place it
 *     could have been asked. `expectNotBlank` asks it, in every state.
 *
 *  2. EVERY SCAN ASSERTS ITS CONTENT IS PRESENT FIRST, and there are scans well
 *     past first paint. The entire page is `innerHTML`-ed into `#app` by
 *     `buildApp()`, and exhibit 6 fills itself asynchronously after generating a
 *     real RSA key — axe over the empty shell passes having checked nothing.
 *
 *  3. `violations` IS NOT THE WHOLE ORACLE. See `scan`.
 */

/**
 * Soft-gate collection mode — strict unless `A11Y_COLLECT` is set.
 *
 * Fixing a page one thrown assertion at a time means one full four-config run
 * per defect. `A11Y_COLLECT=1 npx playwright test` instead records every failed
 * assertion, finishes the drive, and dumps the lot, so a page can be fixed in
 * one pass.
 *
 * The safety property that makes this permanent rather than a temporary hack:
 * `reportCollected()` runs after the suite and THROWS if a collecting run
 * recorded anything. A collection run therefore cannot be mistaken for a
 * passing gate — it fails, loudly, with the whole list attached — and with the
 * env var unset not one line of this behaves differently from a plain `expect`.
 */
const COLLECTING = Boolean(process.env.A11Y_COLLECT);
const collected: string[] = [];

async function soft(label: string, assertion: () => void | Promise<void>): Promise<void> {
  if (!COLLECTING) {
    await assertion();
    return;
  }
  try {
    await assertion();
  } catch (err) {
    collected.push(`[${label}] ${err instanceof Error ? err.message : String(err)}`);
  }
}

/** Fail the run if a collecting pass recorded anything. Call from `afterAll`. */
export function reportCollected(): void {
  if (!collected.length) return;
  const dump = collected.join('\n\n');
  const count = collected.length;
  collected.length = 0;
  throw new Error(
    `A11Y_COLLECT run recorded ${count} soft failure(s). This is NOT a pass.\n\n${dump}`
  );
}

/**
 * Wait for every running animation and transition to drain.
 *
 * Transitions drain in waves, not in one batch, so a poll for "nothing running
 * right now" can exit through a gap between waves. Require quiescence to hold
 * for several consecutive frames instead.
 */
export async function settle(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const w = window as unknown as { __quietFrames?: number };
      const running = document.getAnimations().filter((a) => a.playState === 'running');
      w.__quietFrames = running.length === 0 ? (w.__quietFrames ?? 0) + 1 : 0;
      return w.__quietFrames >= 6;
    },
    undefined,
    { timeout: 20_000, polling: 'raf' }
  );
}

/**
 * Assert that reduced motion left the page visible, not merely un-animated.
 *
 * The failure mode this guards against is an element whose only route to its
 * visible state is an animation, in a stylesheet whose reduced-motion block
 * cancels that animation without restoring its end state — the element then
 * renders at `opacity: 0` for every reader with the preference set. See rule 1
 * above for why this page is exactly that shape.
 */
async function expectNotBlank(page: Page, label: string): Promise<void> {
  const invisible = await page.evaluate(() => {
    const out: string[] = [];
    for (const el of Array.from(document.querySelectorAll('body *'))) {
      const own = Array.from(el.childNodes)
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => n.textContent ?? '')
        .join('')
        .trim();
      if (!own) continue;
      // Deliberately hidden subtrees are not "blank", they are closed.
      if (!(el as HTMLElement).checkVisibility?.({ checkVisibilityCSS: true })) continue;
      let effective = 1;
      let node: Element | null = el;
      while (node) {
        effective *= parseFloat(getComputedStyle(node).opacity);
        node = node.parentElement;
      }
      if (effective === 0) {
        out.push(`${el.tagName.toLowerCase()}.${(el.getAttribute('class') ?? '').trim()}`);
      }
    }
    return Array.from(new Set(out));
  });
  await soft(label, () =>
    expect(invisible, `no visible text may render at opacity 0 in state: ${label}`).toEqual([])
  );
}

/**
 * Load the page in a known theme with reduced motion actually in effect, and
 * assert the content every scan relies on is really on the page.
 *
 * `test.use({ reducedMotion })` silently does nothing on Playwright 1.61.1, so
 * the emulation is applied imperatively BEFORE the navigation and then
 * *asserted* from inside the page.
 *
 * THE DEFAULTS ARE ASSERTED, NOT ASSUMED. Exhibit 1 ships with X = 30, Y = 5,
 * the first data type and algorithm, and the `median` CRQC scenario; exhibit 3
 * ships with all four scenario curves CHECKED; exhibit 6 ships un-migrated and
 * un-attacked. Which half of this lab a scan sees depends entirely on those,
 * and exhibit 1's are also settable from the query string — so a stray `?x=`
 * in a future `goto` would silently move the whole gate onto different numbers.
 */
export async function boot(page: Page, theme: 'dark' | 'light'): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript((t) => localStorage.setItem('theme', t), theme);
  await page.goto('.');
  expect(
    await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches),
    'reduced-motion emulation must actually be in effect'
  ).toBe(true);
  // index.html's anti-flash script stamps `data-theme` unconditionally, reading
  // the same `theme` key the shared bar's toggle writes.
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);

  // The whole page is innerHTML-ed into #app; exhibit 6 then fills in async.
  await expect(page.locator('#exhibit-1')).toBeVisible();
  await expect(page.locator('#e1-result')).not.toBeEmpty();
  await expect(page.locator('#e2-content')).not.toBeEmpty();
  await expect(page.locator('#e3-chart svg')).toBeVisible();
  await expect(page.locator('#e4-content')).not.toBeEmpty();
  await expect(page.locator('#e5-mosca-check')).not.toBeEmpty();
  // Exhibit 6 generates a toy RSA key and encrypts five records before it has
  // anything to show. Wait on the real completion signal, not a timeout.
  await expect(page.locator('#e6-status')).toContainText(/records protected under one/i, {
    timeout: 20_000,
  });
  await expect(page.locator('#e6-content .e6-table')).toBeVisible();

  // Shipped defaults, asserted.
  await expect(page.locator('#e1-x')).toHaveValue('30');
  await expect(page.locator('#e1-y')).toHaveValue('5');
  await expect(page.locator('#e1-scenario')).toHaveValue('median');
  for (const s of ['aggressive', 'median', 'pessimistic', 'ultra-pessimistic']) {
    await expect(page.locator(`#e3-chk-${s}`)).toBeChecked();
  }
  await expect(page.locator('#e6-migrate')).toBeEnabled();
  await expect(page.locator('#e6-content .e6-pending').first()).toBeVisible();
  // No preset chip is active, and the disclosure starts closed.
  expect(await page.locator('#exhibit-1 .chip.active').count(), 'no preset starts active').toBe(0);
  expect(await page.locator('details.sources-panel[open]').count(), 'sources start closed').toBe(0);

  await settle(page);
  await expectNotBlank(page, `${theme} first paint`);
}

/**
 * Assert the page does not require horizontal scrolling.
 *
 * WCAG 1.4.10 (Reflow, AA). axe has no rule for this at all, and this lab is a
 * plausible offender: six exhibits of wide tables, a fixed-geometry SVG chart,
 * a six-item exhibit nav and an `e6-table` cell holding a raw hex ciphertext.
 */
export async function expectNoHorizontalOverflow(page: Page, label: string): Promise<void> {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    // `body { overflow-x: hidden }` propagates to the viewport when `html`
    // leaves `overflow` at `visible`, so `scrollWidth` stays equal to
    // `clientWidth` even when content is CUT OFF — a worse 1.4.10 outcome than
    // a scrollbar, and invisible to the standard check. This sheet does not set
    // that rule today; the check is kept because adding it is the single most
    // tempting "fix" for a reflow failure and it would silence this oracle
    // permanently rather than fixing anything.
    const clippedByViewport = ['hidden', 'clip'].includes(
      getComputedStyle(document.body).overflowX,
    );
    if (!clippedByViewport && doc.scrollWidth <= doc.clientWidth) return null;

    // Only elements that actually push the DOCUMENT sideways are culprits. A
    // wide table inside a `.table-scroll` has a huge bounding rect but is
    // clipped by its scroller and contributes nothing to the document's scroll
    // width — naming it sends you off fixing the wrong element.
    const clipped = (el: Element): boolean => {
      let n = el.parentElement;
      // Stop BEFORE <body>. When `body { overflow-x: hidden }` propagates to the
      // viewport, body itself answers "hidden" to this walk — so every element
      // on the page reads as clipped, `escaping` is always empty, and the oracle
      // reports nothing at all. That is the failure this whole check exists to
      // avoid: a viewport-level clip is the DEFECT, not a legitimate scroller.
      // Only a genuine scrolling container INSIDE the page excuses an overflow.
      while (n && n !== doc && n !== document.body) {
        const ox = getComputedStyle(n).overflowX;
        if (ox === 'auto' || ox === 'scroll' || ox === 'hidden' || ox === 'clip') return true;
        n = n.parentElement;
      }
      return false;
    };

    const over = Array.from(document.querySelectorAll('body *'))
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter((x) => x.r.width > 0 && x.r.right > doc.clientWidth + 1)
      .sort((a, b) => b.r.right - a.r.right);
    // Anything inside a real scroller is reachable and is not a finding; only
    // what escapes the viewport with no way back is.
    const escaping = over.filter((x) => !clipped(x.el));
    if (!escaping.length) return null;
    const widest = escaping[0];
    return {
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      widest: widest
        ? `${widest.el.tagName.toLowerCase()}${widest.el.id ? '#' + widest.el.id : ''}` +
          `${widest.el.getAttribute('class') ? '.' + widest.el.getAttribute('class')!.trim().split(/\s+/).join('.') : ''}` +
          ` @${Math.round(widest.r.width)}px right=${Math.round(widest.r.right)}`
        : '(none identified)',
    };
  });
  await soft(label, () =>
    expect(overflow, `page must not scroll horizontally in state: ${label}`).toBeNull()
  );
}

/**
 * Every scrolling container must be operable from the keyboard (WCAG 2.1.1).
 * If it holds no focusable content it needs `tabindex="0"`, so it becomes a
 * focus target arrow keys can then scroll.
 *
 * The `.table-scroll` wrappers only actually overflow at some widths and in
 * some sorted/filtered states, which is why this runs after every step at both
 * viewport widths rather than once at 1280.
 */
export async function expectScrollersReachable(page: Page, label: string): Promise<void> {
  const unreachable = await page.evaluate(() => {
    const FOCUSABLE = 'a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])';
    return Array.from(document.querySelectorAll<HTMLElement>('body *'))
      .filter((el) => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)
      .filter((el) => {
        const cs = getComputedStyle(el);
        return (
          ['auto', 'scroll'].includes(cs.overflowX) || ['auto', 'scroll'].includes(cs.overflowY)
        );
      })
      .filter((el) => el.tabIndex < 0 && !el.querySelector(FOCUSABLE))
      .map(
        (el) =>
          `${el.tagName.toLowerCase()}.${(el.getAttribute('class') ?? '').trim()}` +
          ` (${el.scrollWidth}x${el.scrollHeight} in ${el.clientWidth}x${el.clientHeight})`
      );
  });
  await soft(label, () =>
    expect(
      Array.from(new Set(unreachable)),
      `scrolling regions with no keyboard route in state: ${label}`
    ).toEqual([])
  );
}

/**
 * Scan the page as it currently stands.
 *
 * Five assertions, because axe's `violations` array alone is not a complete
 * oracle:
 *
 *  - `violations` — the usual WCAG A/AA rule failures.
 *  - `incomplete` — axe's "could not decide" bucket, which never reaches the
 *    violations array. The one rule id allowed to remain incomplete is
 *    `color-contrast`, and only because the next assertion computes those
 *    ratios arithmetically. Everything else in that bucket is a real result
 *    axe simply could not finish — including `aria-prohibited-attr`, which is
 *    where an `aria-label` on a role-less div hides, a defect that never
 *    reaches the violations array at all.
 *  - arithmetic contrast — composite-aware WCAG 1.4.3 over every text node.
 *  - keyboard reachability of scrolling regions — WCAG 2.1.1.
 *  - reflow — WCAG 1.4.10, which axe has no rule for at all.
 *
 * Two whole classes of failure have no oracle here and were measured by hand
 * from screenshot pixels instead: WCAG 1.4.11 non-text contrast (control
 * boundaries, the Mosca bar segments, the exposure-curve strokes) and generated
 * content (`::before`/`::after`), which is neither an element nor a text node
 * and so is invisible to axe and to the arithmetic walk alike. This page has
 * five such pseudo-elements — the sources chevron, the citation bullets, the
 * TL;DR arrows and the harvest-step connectors.
 */
export async function scan(page: Page, label: string): Promise<void> {
  await settle(page);
  await expectNotBlank(page, label);
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();

  const violations = results.violations.map((v) => ({
    state: label,
    id: v.id,
    impact: v.impact,
    help: v.help,
    nodes: v.nodes.map((n) => n.target.join(' ')).slice(0, 8),
  }));
  await soft(label, () => expect(violations, `axe violations in state: ${label}`).toEqual([]));

  const unexplainedIncomplete = results.incomplete
    .filter((v) => v.id !== 'color-contrast')
    .map((v) => ({
      state: label,
      id: v.id,
      nodes: v.nodes.map((n) => n.target.join(' ')).slice(0, 8),
    }));
  await soft(label, () =>
    expect(unexplainedIncomplete, `axe incomplete results in state: ${label}`).toEqual([])
  );

  const contrast = Array.from(new Set(formatContrastFailures(await auditContrast(page))));
  await soft(label, () =>
    expect(contrast, `measured contrast failures in state: ${label}`).toEqual([])
  );

  await expectScrollersReachable(page, label);
  await expectNoHorizontalOverflow(page, label);
}

/**
 * Drive the lab through every state that renders content, scanning each.
 *
 * Six exhibits, each with its own controls, plus one disclosure and one
 * hover/focus popover. The old spec scanned none of it: it force-revealed the
 * page as loaded and stopped. Everything below is a state a visitor produces
 * and the gate previously never saw.
 */
export async function driveAllStates(page: Page, theme: string): Promise<void> {
  const at = async (label: string): Promise<void> => scan(page, `${theme} / ${label}`);

  await at('first paint (shipped defaults)');

  // ── The sources disclosure — opened by CLICK, never by setting `.open` ────
  const summary = page.locator('details.sources-panel > summary');
  await summary.click();
  await expect(page.locator('details.sources-panel')).toHaveAttribute('open', '');
  await at('sources disclosure open');

  // ── The jargon popover, which lives at `opacity: 0; visibility: hidden` ──
  const gloss = page.locator('.gloss').first();
  await gloss.focus();
  await expect(page.locator('.gloss-pop').first()).toBeVisible();
  await at('jargon gloss popover focused open');
  await page.locator('#exhibit-1 h3').first().click({ position: { x: 2, y: 2 } });

  // ── Exhibit 1: both verdict branches, and the extremes of both sliders ───
  // The lab ships EXPOSED (X=30 + Y=5 > Z). The safe branch only appears once
  // X is driven low, and that branch owns `.plain-sentence.safe`, the `+margin`
  // ink and a different `.result-verdict` tone — a whole half of the exhibit
  // the old single-scan spec never rendered.
  await expect(page.locator('.plain-sentence.exposed')).toBeVisible();
  const x = page.locator('#e1-x');
  const y = page.locator('#e1-y');
  await x.fill('0');
  await expect(page.locator('#e1-x-val')).toHaveText('0 yrs');
  await at('exhibit 1, X at minimum (0) — safe branch');
  await y.fill('1');
  await at('exhibit 1, X=0 Y=1 — widest margin');
  await x.fill('100');
  await y.fill('20');
  await expect(page.locator('#e1-x-val')).toHaveText('100 yrs');
  await expect(page.locator('#e1-y-val')).toHaveText('20 yrs');
  await expect(page.locator('.plain-sentence.exposed')).toBeVisible();
  await at('exhibit 1, both sliders at maximum — worst exposure');

  // Every CRQC scenario, at the extreme, so the `.result-verdict` tone walks
  // its whole range rather than sitting on the shipped one.
  for (const z of ['aggressive', 'median', 'pessimistic', 'ultra-pessimistic']) {
    await page.selectOption('#e1-scenario', z);
    await at(`exhibit 1, scenario ${z}`);
  }

  // The algorithm select drives `.algo-status` through its three tones —
  // broken / partial / safe — each with its own ink on its own tint.
  for (const algo of ['RSA-2048', 'AES-128', 'ML-KEM-768']) {
    await page.selectOption('#e1-algo', algo);
    await expect(page.locator('#e1-algo-status')).not.toBeEmpty();
    await at(`exhibit 1, algorithm ${algo}`);
  }

  // Every quick-scenario preset chip, including its `.active` pressed state.
  const chips = page.locator('#exhibit-1 .chip[data-preset]');
  const chipCount = await chips.count();
  expect(chipCount, 'exhibit 1 must offer preset chips').toBeGreaterThan(0);
  for (let i = 0; i < chipCount; i++) {
    await chips.nth(i).click();
    await expect(chips.nth(i)).toHaveAttribute('aria-pressed', 'true');
    await at(`exhibit 1, preset chip ${i + 1} of ${chipCount} active`);
  }

  // Reset returns to the shipped defaults and clears every chip.
  await page.click('#e1-reset');
  await expect(page.locator('#e1-y-val')).toHaveText('5 yrs');
  expect(await page.locator('#exhibit-1 .chip.active').count(), 'reset clears the chips').toBe(0);
  await at('exhibit 1 reset');

  // ── Exhibit 2: every organization, every scenario, every sort column ─────
  const orgCount = await page.locator('#e2-org option').count();
  expect(orgCount, 'exhibit 2 must offer organizations').toBeGreaterThan(1);
  for (let i = 0; i < orgCount; i++) {
    await page.selectOption('#e2-org', String(i));
    await expect(page.locator('#e2-content')).not.toBeEmpty();
    await at(`exhibit 2, organization ${i + 1} of ${orgCount}`);
  }
  await page.selectOption('#e2-scenario', 'ultra-pessimistic');
  await at('exhibit 2, ultra-pessimistic scenario');
  await page.selectOption('#e2-scenario', 'aggressive');
  await at('exhibit 2, aggressive scenario');

  // Sorting re-renders the table and re-stamps `aria-sort`; both directions of
  // every column, because the inactive `⇅` arrow and the active `↑`/`↓` are
  // three different glyphs on three different inks.
  const e2Heads = page.locator('#e2-content th[data-sort]');
  const e2HeadCount = await e2Heads.count();
  expect(e2HeadCount, 'exhibit 2 must have sortable headers').toBeGreaterThan(0);
  for (let i = 0; i < e2HeadCount; i++) {
    await page.locator('#e2-content th[data-sort]').nth(i).click();
    await at(`exhibit 2, sorted by column ${i + 1} (first direction)`);
    await page.locator('#e2-content th[data-sort]').nth(i).click();
    await at(`exhibit 2, sorted by column ${i + 1} (reversed)`);
  }

  // ── Exhibit 3: the curve, one algorithm per status tone, and the legend ──
  for (const algo of ['RSA-2048', 'AES-128', 'ML-KEM-768']) {
    await page.selectOption('#e3-algo', algo);
    await expect(page.locator('#e3-chart svg')).toBeVisible();
    await at(`exhibit 3, algorithm ${algo}`);
  }
  // Unchecking every curve is the empty state — a chart with no series, which
  // the shipped all-checked default can never show.
  for (const s of ['aggressive', 'median', 'pessimistic', 'ultra-pessimistic']) {
    await page.uncheck(`#e3-chk-${s}`);
  }
  await at('exhibit 3, every scenario unchecked — empty chart');
  for (const s of ['aggressive', 'median', 'pessimistic', 'ultra-pessimistic']) {
    await page.check(`#e3-chk-${s}`);
  }
  await at('exhibit 3, every scenario re-checked');

  // The crosshair tooltip is `opacity: 0` until a pointer enters the plot.
  const overlay = page.locator('#e3-overlay');
  await overlay.hover();
  await expect(page.locator('#e3-tooltip')).toHaveClass(/visible/);
  await at('exhibit 3, crosshair tooltip visible');
  await page.locator('.chart-caption').first().hover();

  // ── Exhibit 4: every organization and both scenario extremes, sorted ─────
  for (let i = 0; i < orgCount; i++) {
    await page.selectOption('#e4-org', String(i));
    await expect(page.locator('#e4-content')).not.toBeEmpty();
    await at(`exhibit 4, organization ${i + 1} of ${orgCount}`);
  }
  await page.selectOption('#e4-scenario', 'aggressive');
  await at('exhibit 4, aggressive scenario');
  const e4Heads = page.locator('#e4-content th[data-sort]');
  const e4HeadCount = await e4Heads.count();
  for (let i = 0; i < e4HeadCount; i++) {
    await page.locator('#e4-content th[data-sort]').nth(i).click();
    await at(`exhibit 4, sorted by column ${i + 1}`);
  }

  // ── Exhibit 6: BOTH branches of the migrate/attack fork ──────────────────
  // Branch A — attack WITHOUT migrating first. Every record still carries an
  // RSA wrapper, so everything is read and the verdict renders `.e6-bad`.
  await page.click('#e6-attack');
  await expect(page.locator('#e6-status')).toContainText(/CRQC complete/i, { timeout: 20_000 });
  await expect(page.locator('.e6-verdict.e6-bad')).toBeVisible();
  await expect(page.locator('.e6-read').first()).toBeVisible();
  await at('exhibit 6, attacked without migrating — every record read');

  // Reset, then branch B — migrate first, then attack. The archive survives and
  // the captured sessions do not; the verdict renders `.e6-good` and the table
  // shows both `.e6-read` and `.e6-held` at once.
  await page.click('#e6-reset');
  await expect(page.locator('#e6-status')).toContainText(/records protected under one/i, {
    timeout: 20_000,
  });
  await expect(page.locator('.e6-pending').first()).toBeVisible();
  await at('exhibit 6 after reset — nothing attacked yet');

  await page.click('#e6-migrate');
  await expect(page.locator('#e6-status')).toContainText(/re-keyed to AES-256-GCM/i, {
    timeout: 20_000,
  });
  // The migrate button is DISABLED once migration is done — a real state.
  await expect(page.locator('#e6-migrate')).toBeDisabled();
  await at('exhibit 6 migrated, not yet attacked');

  await page.click('#e6-attack');
  await expect(page.locator('#e6-status')).toContainText(/CRQC complete/i, { timeout: 20_000 });
  await expect(page.locator('.e6-verdict.e6-good')).toBeVisible();
  await expect(page.locator('.e6-held').first()).toBeVisible();
  await expect(page.locator('.e6-read').first()).toBeVisible();
  await at('exhibit 6 migrated then attacked — archive held, wire read');

  // A different organization rebuilds the whole scenario from a new key.
  await page.selectOption('#e6-org', String(orgCount - 1));
  await expect(page.locator('#e6-status')).toContainText(/records protected under one/i, {
    timeout: 20_000,
  });
  await at(`exhibit 6, organization ${orgCount}`);

  // ── The two skip links, on screen only while focused ─────────────────────
  await page.locator('.cl-skip-link').focus();
  await expect(page.locator('.cl-skip-link')).toBeFocused();
  await at('shared header skip link focused');
  await page.locator('.skip-link').focus();
  await expect(page.locator('.skip-link')).toBeFocused();
  await at("this lab's own skip link focused");
}
