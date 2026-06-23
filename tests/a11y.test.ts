// @vitest-environment happy-dom
//
// Automated accessibility audit with axe-core, run against the fully-mounted app.
// This catches structural a11y regressions — missing form labels, broken ARIA,
// invalid roles, landmark problems, list/heading structure — that the contrast
// and smoke tests don't cover.
//
// Note on scope: axe's `color-contrast` rule needs a real rendering engine
// (canvas getImageData), which happy-dom doesn't provide, so it's disabled here
// and covered instead by the deterministic palette math in contrast.test.ts.
import { describe, it, expect, beforeAll } from 'vitest';
import axe from 'axe-core';

beforeAll(async () => {
  // Mirror the document-level attributes that index.html provides (we only mount
  // #app here, so <html lang> and <title> aren't otherwise present).
  document.documentElement.lang = 'en';
  document.title = 'HNDL Timeline — Harvest-Now-Decrypt-Later Risk Simulator';
  document.body.innerHTML = '<div id="app"></div>';
  await import('../src/main.ts');
});

describe('axe-core accessibility audit', () => {
  it('reports no WCAG 2.1 A/AA violations on the mounted app', async () => {
    const results = await axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
      // Needs a real layout engine; covered by contrast.test.ts instead.
      rules: { 'color-contrast': { enabled: false } },
    });

    if (results.violations.length) {
      const summary = results.violations
        .map(v => `• [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} node${v.nodes.length === 1 ? '' : 's'})\n    ${v.nodes[0]?.html ?? ''}`)
        .join('\n');
      // Surface the details in the failure message.
      expect(results.violations, `axe found ${results.violations.length} violation(s):\n${summary}`).toEqual([]);
    }
    expect(results.violations).toEqual([]);
  });
});
