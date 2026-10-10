import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { assessRisk, computeExposureCurve, CRQC_SCENARIOS } from '../src/risk-engine.ts';

const historical = CRQC_SCENARIOS.find(s => s.label === 'pessimistic')!;
const median = CRQC_SCENARIOS.find(s => s.label === 'median')!;

describe('historical survey calendar and planning boundary', () => {
  it.each([2024, 2026, 2028])('keeps the historical ten-year anchor at 2034 when evaluated in %i', asOf => {
    const curve = computeExposureCurve('RSA-2048', historical, 30, asOf);
    expect(curve.find(p => p.year === 2034)?.probDecryptable).toBe(0.19);
    expect(curve.find(p => p.year === 2039)?.probDecryptable).toBe(0.39);
    expect(curve.find(p => p.year === 2044)?.probDecryptable).toBe(0.6);
  });

  it('keeps strict inequality separate from zero-margin migration advice', () => {
    const boundary = assessRisk('fixture', 'RSA-2048', 10, 2, median);
    expect(boundary.moscaInequality.exposed).toBe(false);
    expect(boundary.moscaInequality.marginYears).toBe(0);
    expect(boundary.recommendation).toMatch(/boundary.*no spare time/i);
    expect(boundary.recommendation).not.toMatch(/exposed by|safe with/i);
    expect(assessRisk('fixture', 'RSA-2048', 11, 2, median).moscaInequality.exposed).toBe(true);
    expect(assessRisk('fixture', 'RSA-2048', 9, 2, median).moscaInequality.marginYears).toBe(1);
  });

  it('labels retained 2024 estimates as historical and links the distinct newer survey', () => {
    const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
    expect(readme).toMatch(/historical 2024/i);
    expect(readme).toContain('quantum-threat-timeline-report-2025b');
    expect(readme).toMatch(/26 experts/);
    expect(readme).not.toMatch(/most recent expert survey|most recent edition built on a survey/);
  });
});
