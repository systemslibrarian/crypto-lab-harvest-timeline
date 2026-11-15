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
  it('renders all six exhibits without throwing', () => {
    for (const id of ['exhibit-1', 'exhibit-2', 'exhibit-3', 'exhibit-4', 'exhibit-5', 'exhibit-6']) {
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

  it('shows the dated NIST source and excludes signatures from decryption controls', () => {
    const note = document.getElementById('risk-boundary');
    expect(note?.textContent).toMatch(/forge future signatures.*cannot decrypt stored data/s);
    expect(note?.querySelector('a')?.getAttribute('href')).toBe('https://csrc.nist.gov/pubs/ir/8547/final');
    for (const id of ['e1-algo', 'e3-algo']) {
      const labels = Array.from((document.getElementById(id) as HTMLSelectElement).options).map(o => o.value);
      expect(labels).toContain('ECDH + AES-256');
      expect(labels).not.toContain('ECDSA-P256');
      expect(labels).not.toContain('TLS-ECDSA');
      expect(labels).not.toContain('ML-DSA-65');
      expect(labels).not.toContain('SHA-256');
    }
  });

  it('renders the "how the harvest works" mini-timeline with three steps', () => {
    const explainer = document.getElementById('harvest-explainer');
    expect(explainer).not.toBeNull();
    const steps = explainer!.querySelectorAll('.harvest-step');
    expect(steps.length).toBe(3);
    // The three X/Y/Z-colored steps must exist by class so the palette maps.
    expect(explainer!.querySelector('.step-harvest')).not.toBeNull();
    expect(explainer!.querySelector('.step-store')).not.toBeNull();
    expect(explainer!.querySelector('.step-decrypt')).not.toBeNull();
  });

  it('glosses CRQC/Shor/Grover jargon with focusable, described triggers', () => {
    const glosses = document.querySelectorAll('.gloss');
    expect(glosses.length).toBeGreaterThan(0);
    for (const g of glosses) {
      expect(g.getAttribute('tabindex')).toBe('0');
      expect(g.getAttribute('aria-description')).toBeTruthy();
    }
  });
});

describe('UI smoke — Exhibit 1 calculator', () => {
  it('renders a live Mosca verdict on first paint', () => {
    const result = document.getElementById('e1-result');
    expect(result?.textContent).toMatch(/RISK:/);
  });

  it('renders a live plain-English narrated sentence above the algebra', () => {
    const sentence = document.querySelector('#e1-result .plain-sentence');
    expect(sentence).not.toBeNull();
    // It must assemble X, Y and Z into one narrated inequality.
    expect(sentence?.textContent).toMatch(/must stay secret/i);
    expect(sentence?.querySelector('.hl-x')).not.toBeNull();
    expect(sentence?.querySelector('.hl-y')).not.toBeNull();
    expect(sentence?.querySelector('.hl-z')).not.toBeNull();
  });

  it('glosses the Shor/Grover mechanism inside the algorithm status badge', () => {
    const status = document.getElementById('e1-algo-status');
    expect(status?.querySelector('.gloss')).not.toBeNull();
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

describe('UI smoke — Exhibit 6 migration exhibit', () => {
  it('mounts its controls and status region', () => {
    expect(document.getElementById('e6-org')).not.toBeNull();
    expect(document.getElementById('e6-migrate')).not.toBeNull();
    expect(document.getElementById('e6-attack')).not.toBeNull();
    expect(document.getElementById('e6-status')?.getAttribute('aria-live')).toBe('polite');
  });

  it('states its toy scale in the panel rather than burying it', () => {
    const scale = document.querySelector('#exhibit-6 .e6-scale')?.textContent ?? '';
    expect(scale).toMatch(/32-bit primes/);
    expect(scale).toMatch(/RSA-2048 is\s+2048 bits/);
  });
});

describe('UI smoke — Exhibit 3 exposure chart', () => {
  it('renders an SVG chart with a labelled title for screen readers', () => {
    const svg = document.querySelector('#e3-chart svg');
    expect(svg).not.toBeNull();
    expect(svg?.querySelector('title')?.textContent).toMatch(/Exposure probability/i);
    expect(svg?.querySelector('title')?.textContent).toMatch(/historical illustrative/i);
    expect(svg?.querySelector('title')?.textContent).toMatch(/modelled survey-based scenarios/i);
  });

  it('draws survey anchor rings and a points-vs-line caption (honest chart)', () => {
    const caption = document.querySelector('.chart-caption');
    expect(caption?.textContent).toMatch(/interpolation/i);
    // Ringed survey dots: hollow circles filled with the panel color.
    const svg = document.querySelector('#e3-chart svg')?.innerHTML ?? '';
    expect(svg).toMatch(/fill="#141d2e" stroke="#[0-9a-f]{6}" stroke-width="2"/i);
  });

  it('labels the AES-128 curve as hypothetical and shows its unscaled reference', () => {
    const algo = document.getElementById('e3-algo') as HTMLSelectElement;
    algo.value = 'AES-128';
    algo.dispatchEvent(new Event('change'));
    const svg = document.querySelector('#e3-chart svg')?.innerHTML ?? '';
    expect(svg).toContain('stroke-dasharray="2,4"'); // dashed unscaled reference line
    expect(svg).toMatch(/Grover halves idealized key-search bits/);
    expect(svg).toMatch(/curve ×0\.5 is illustrative/); // separate the heuristic probability scaling
    expect(document.querySelector('#e3-chart-title')?.textContent).toMatch(/not an AES decryption probability/);
    expect(document.querySelector('.chart-caption a[href="https://csrc.nist.gov/Projects/post-quantum-cryptography/faqs"]')).not.toBeNull();
    // restore
    algo.value = 'RSA-2048';
    algo.dispatchEvent(new Event('change'));
  });

  it('treats AES-128 as permitted despite an X+Y timing overlap', () => {
    const algo = document.getElementById('e1-algo') as HTMLSelectElement;
    algo.value = 'AES-128';
    algo.dispatchEvent(new Event('change'));
    const result = document.getElementById('e1-result')?.textContent ?? '';
    expect(result).toContain('RISK: NONE');
    expect(result).toContain('NIST currently permits AES-128');
    expect(result).not.toContain('potential decryption');
    algo.value = 'RSA-2048';
    algo.dispatchEvent(new Event('change'));
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

// Citation gate. These four statements each named NIST SP 1800-38B or called
// LMS/XMSS "required"; SP 1800-38B is *Quantum Readiness: Cryptographic
// Discovery* and gives neither hybrid TLS nor timelines, and the CNSA 2.0 FAQ
// recommends LMS/XMSS rather than requiring them.
describe('standards citations', () => {
  const pageText = (): string => (document.body.textContent ?? '').replace(/\s+/g, ' ');

  it('cites NIST IR 8547 for the migration deadlines, not SP 1800-38B', () => {
    const note = document.getElementById('e4-content')?.textContent?.replace(/\s+/g, ' ') ?? '';
    expect(note).toContain('illustrative planning estimates, not NIST figures');
    expect(note).toContain('NIST IR 8547, final report (27 October 2026), §4');
    expect(note).toContain('deprecated after 2030 and disallowed after 2035');
    expect(note).not.toContain('1800-38B');
  });

  it('cites NIST IR 8547 §3.2.1 for hybrid key establishment', () => {
    const text = pageText();
    expect(text).toContain('NIST IR 8547 §3.2.1');
    expect(text).toContain('SP 800-56C key derivation');
    expect(text).not.toContain('SP 1800-38B hybrid TLS');
  });

  it('says CNSA 2.0 recommends LMS/XMSS for firmware rather than requiring them', () => {
    const text = pageText();
    expect(text).toContain('CNSA 2.0 recommends LMS SHA-256/192');
    expect(text).toContain('ML-DSA is approved for all signing use cases, firmware included');
    expect(text).not.toContain('CNSA 2.0 required for firmware signing');
  });

  it('lists SP 1800-38B under government guidance with its real title', () => {
    const text = pageText();
    expect(text).toContain('Quantum Readiness: Cryptographic Discovery');
    expect(text).toContain('discovery tooling, not hybrid TLS or migration timelines');
    // It is an NCCoE practice guide, so it must not sit in the 2024 standards list.
    const standards = Array.from(document.querySelectorAll('h3'))
      .find((h) => (h.textContent ?? '').includes('NIST PQC Standards'))
      ?.nextElementSibling?.textContent ?? '';
    expect(standards).toContain('FIPS 203');
    expect(standards).not.toContain('1800-38B');
  });
});
