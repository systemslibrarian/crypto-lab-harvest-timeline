// @vitest-environment happy-dom
//
// DOM smoke tests for the UI layer. The pure risk engine is covered exhaustively
// in risk-engine.test.ts / scenarios.test.ts; these tests guard the ~1400-line
// rendering layer against crash-on-mount and wiring regressions (broken
// selectors, missing exhibits, dead event handlers) that engine tests can't see.
//
// main.ts calls buildApp() as a module side effect against #app, so we stage the
// mount point, import once in beforeAll, then assert against the built DOM.
import { describe, it, expect, beforeAll } from 'vitest';

beforeAll(async () => {
  document.body.innerHTML = '<div id="app"></div>';
  await import('../src/main.ts');
});

describe('UI smoke — app mount', () => {
  it('renders all five exhibits without throwing', () => {
    for (const id of ['exhibit-1', 'exhibit-2', 'exhibit-3', 'exhibit-4', 'exhibit-5']) {
      expect(document.getElementById(id), id).not.toBeNull();
    }
  });

  it('exposes landmarks and skip target for a11y', () => {
    expect(document.getElementById('main-content')).not.toBeNull();
    expect(document.querySelector('nav.exhibit-nav')).not.toBeNull();
  });

  it('groups the algorithm picker into broken / partial / safe optgroups', () => {
    const groups = document.querySelectorAll('#e1-algo optgroup');
    expect(groups.length).toBe(3);
  });
});

describe('UI smoke — Exhibit 1 calculator', () => {
  it('renders a live Mosca verdict on first paint', () => {
    const result = document.getElementById('e1-result');
    expect(result?.textContent).toMatch(/RISK:/);
  });

  it('recomputes the verdict when the lifetime slider moves', () => {
    const x = document.getElementById('e1-x') as HTMLInputElement;
    const result = document.getElementById('e1-result') as HTMLElement;
    x.value = '5';
    x.dispatchEvent(new Event('input'));
    const lowText = result.textContent ?? '';
    x.value = '95';
    x.dispatchEvent(new Event('input'));
    const highText = result.textContent ?? '';
    // A longer shelf life cannot reduce exposure, so the verdict text must change.
    expect(highText).not.toBe(lowText);
  });

  it('marks a preset chip pressed, then releases it on manual edit', () => {
    const chip = document.querySelector('#exhibit-1 .chip[data-preset]') as HTMLButtonElement;
    chip.click();
    expect(chip.getAttribute('aria-pressed')).toBe('true');
    expect(chip.classList.contains('active')).toBe(true);

    const y = document.getElementById('e1-y') as HTMLInputElement;
    y.value = '12';
    y.dispatchEvent(new Event('input'));
    expect(chip.getAttribute('aria-pressed')).toBe('false');
    expect(chip.classList.contains('active')).toBe(false);
  });
});

describe('UI smoke — Exhibit 2 organization table', () => {
  it('renders an asset row per asset with sortable headers', () => {
    const rows = document.querySelectorAll('#e2-content table.asset-table tbody tr');
    expect(rows.length).toBeGreaterThan(0);
    const sortable = document.querySelectorAll('#e2-content th[data-sort]');
    expect(sortable.length).toBe(6);
  });

  it('shows an aggregate risk score out of 100', () => {
    const score = document.querySelector('#e2-content .risk-score-stat .stat-value');
    expect(score?.textContent).toMatch(/\/100/);
  });
});

describe('UI smoke — Exhibit 3 exposure chart', () => {
  it('renders an SVG chart with a labelled title for screen readers', () => {
    const svg = document.querySelector('#e3-chart svg');
    expect(svg).not.toBeNull();
    expect(svg?.querySelector('title')?.textContent).toMatch(/Exposure probability/i);
  });

  it('enlarges axis fonts in a compact (mobile) viewport', () => {
    const desktop = document.querySelector('#e3-chart svg')?.innerHTML ?? '';
    expect(desktop).toContain('font-size="11"'); // desktop tick labels

    Object.defineProperty(window, 'innerWidth', { value: 375, configurable: true });
    window.dispatchEvent(new Event('resize'));
    const mobile = document.querySelector('#e3-chart svg')?.innerHTML ?? '';
    expect(mobile).toContain('font-size="18"'); // enlarged tick labels
    expect(mobile).not.toContain('font-size="11"');

    // restore desktop viewport so later assertions/tests are unaffected
    Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
    window.dispatchEvent(new Event('resize'));
  });
});
