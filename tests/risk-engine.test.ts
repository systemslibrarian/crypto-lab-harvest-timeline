import { describe, it, expect } from 'vitest';
import {
  CURRENT_YEAR,
  CRQC_SCENARIOS,
  ALGORITHM_SECURITY,
  DATA_TYPES,
  assessRisk,
  aggregateOrgRisk,
  computeExposureCurve,
} from '../src/risk-engine.ts';

const median = CRQC_SCENARIOS.find((s) => s.label === 'median')!;
const ultraPess = CRQC_SCENARIOS.find((s) => s.label === 'ultra-pessimistic')!;

describe('CRQC_SCENARIOS', () => {
  it('contains the 4 expected scenarios in chronological order', () => {
    expect(CRQC_SCENARIOS.map((s) => s.label)).toEqual([
      'aggressive',
      'median',
      'pessimistic',
      'ultra-pessimistic',
    ]);
    const years = CRQC_SCENARIOS.map((s) => s.yearsFromNow);
    expect(years).toEqual([...years].sort((a, b) => a - b));
  });

  it('probabilities are monotonically non-decreasing with horizon', () => {
    for (const s of CRQC_SCENARIOS) {
      expect(s.probabilityBy15Years).toBeGreaterThanOrEqual(s.probabilityBy10Years);
      expect(s.probabilityBy20Years).toBeGreaterThanOrEqual(s.probabilityBy15Years);
    }
  });

  it('all probabilities are valid (0..1)', () => {
    for (const s of CRQC_SCENARIOS) {
      for (const p of [s.probabilityBy10Years, s.probabilityBy15Years, s.probabilityBy20Years]) {
        expect(p).toBeGreaterThanOrEqual(0);
        expect(p).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('assessRisk — Mosca inequality math', () => {
  it('flags data as exposed when X + Y > Z', () => {
    const r = assessRisk('test', 'RSA-2048', 30, 5, median);
    expect(r.moscaInequality.X).toBe(30);
    expect(r.moscaInequality.Y).toBe(5);
    expect(r.moscaInequality.Z).toBe(median.yearsFromNow);
    expect(r.moscaInequality.exposed).toBe(true);
    expect(r.moscaInequality.marginYears).toBe(median.yearsFromNow - 35);
  });

  it('marks safe when X + Y < Z', () => {
    const r = assessRisk('test', 'RSA-2048', 1, 1, median);
    expect(r.moscaInequality.exposed).toBe(false);
    expect(r.moscaInequality.marginYears).toBeGreaterThan(0);
  });

  it('uses STRICT inequality (X+Y == Z → not exposed)', () => {
    const r = assessRisk('test', 'RSA-2048', median.yearsFromNow - 1, 1, median);
    expect(r.moscaInequality.X + r.moscaInequality.Y).toBe(r.moscaInequality.Z);
    expect(r.moscaInequality.exposed).toBe(false);
  });

  it('sets crqcYear = today + Z', () => {
    const r = assessRisk('test', 'RSA-2048', 1, 1, median);
    expect(r.crqcYear).toBe(CURRENT_YEAR + median.yearsFromNow);
  });
});

describe('assessRisk — risk level grading', () => {
  it('quantum-safe algorithms always return riskLevel "none"', () => {
    const r = assessRisk('test', 'ML-KEM-768', 100, 20, median);
    expect(r.riskLevel).toBe('none');
    expect(r.recommendedAction).toBe('monitor');
  });

  it('quantum-safe stays "none" even under aggressive CRQC', () => {
    const aggressive = CRQC_SCENARIOS.find((s) => s.label === 'aggressive')!;
    const r = assessRisk('test', 'ML-DSA-65', 100, 20, aggressive);
    expect(r.riskLevel).toBe('none');
  });

  it('broken algo with huge exposure → critical', () => {
    const r = assessRisk('test', 'RSA-2048', 80, 15, median);
    expect(r.riskLevel).toBe('critical');
    expect(r.recommendedAction).toBe('emergency_migration');
  });

  it('broken algo with comfortable margin → low', () => {
    const r = assessRisk('test', 'RSA-2048', 1, 1, ultraPess);
    expect(r.riskLevel).toBe('low');
    expect(r.recommendedAction).toBe('plan_migration');
  });

  it('AES-256 (partially-affected, 128-bit post-Grover) is longTermSafe → none', () => {
    const r = assessRisk('test', 'AES-256', 50, 10, median);
    expect(r.riskLevel).toBe('none');
  });

  it('AES-128 (only 64-bit post-Grover) grades risky for long-lived data', () => {
    // 64-bit quantum security is too weak to count as "longTermSafe", so the
    // engine treats AES-128 as effectively broken once exposure exceeds margin.
    const r = assessRisk('test', 'AES-128', 30, 5, median);
    expect(['medium', 'high', 'critical']).toContain(r.riskLevel);
  });

  it('AES-128 with comfortable margin (ultra-pess) grades safer than under median', () => {
    const rUltra = assessRisk('test', 'AES-128', 5, 2, ultraPess);
    const rMed   = assessRisk('test', 'AES-128', 30, 5, median);
    const order = { none: 0, low: 1, medium: 2, high: 3, critical: 4 };
    expect(order[rUltra.riskLevel]).toBeLessThanOrEqual(order[rMed.riskLevel]);
  });
});

describe('computeExposureCurve', () => {
  it('produces horizon + 1 points starting at CURRENT_YEAR', () => {
    const curve = computeExposureCurve('RSA-2048', median, 50);
    expect(curve.length).toBe(51);
    expect(curve[0].year).toBe(CURRENT_YEAR);
    expect(curve[50].year).toBe(CURRENT_YEAR + 50);
  });

  it('probability starts at exactly 0 today', () => {
    const curve = computeExposureCurve('RSA-2048', median, 50);
    expect(curve[0].probDecryptable).toBe(0);
  });

  it('is monotonically non-decreasing for broken algos', () => {
    const curve = computeExposureCurve('RSA-2048', median, 50);
    for (let i = 1; i < curve.length; i++) {
      expect(curve[i].probDecryptable).toBeGreaterThanOrEqual(curve[i - 1].probDecryptable);
    }
  });

  it('all probabilities are clamped to [0, 1]', () => {
    for (const scenario of CRQC_SCENARIOS) {
      const curve = computeExposureCurve('RSA-2048', scenario, 50);
      for (const pt of curve) {
        expect(pt.probDecryptable).toBeGreaterThanOrEqual(0);
        expect(pt.probDecryptable).toBeLessThanOrEqual(1);
      }
    }
  });

  it('quantum-safe stays at 0% across full horizon', () => {
    const curve = computeExposureCurve('ML-KEM-768', median, 50);
    for (const pt of curve) expect(pt.probDecryptable).toBe(0);
  });

  it('AES-128 risk never exceeds the corresponding broken curve', () => {
    const broken = computeExposureCurve('RSA-2048', median, 50);
    const aes128 = computeExposureCurve('AES-128', median, 50);
    for (let i = 0; i < broken.length; i++) {
      expect(aes128[i].probDecryptable).toBeLessThanOrEqual(broken[i].probDecryptable + 1e-9);
    }
  });

  it('aggressive scenario rises faster than ultra-pessimistic at every year', () => {
    const agg = computeExposureCurve('RSA-2048', CRQC_SCENARIOS[0], 50);
    const ult = computeExposureCurve('RSA-2048', ultraPess, 50);
    for (let i = 0; i < agg.length; i++) {
      expect(agg[i].probDecryptable).toBeGreaterThanOrEqual(ult[i].probDecryptable - 1e-9);
    }
  });
});

describe('aggregateOrgRisk', () => {
  it('quantum-safe-only org reports 0% exposure', () => {
    const result = aggregateOrgRisk(
      [
        { name: 'a', algorithm: 'ML-KEM-768', X: 100, Y: 20, dataSizeTB: 10 },
        { name: 'b', algorithm: 'ML-DSA-65', X: 50, Y: 10, dataSizeTB: 5 },
      ],
      median,
    );
    expect(result.percentExposed).toBe(0);
    expect(result.exposedDataTB).toBe(0);
    expect(result.immediateActionRequired).toBe(false);
  });

  it('all-broken with long lifetimes → 100% exposed + action required', () => {
    const result = aggregateOrgRisk(
      [
        { name: 'a', algorithm: 'RSA-2048', X: 50, Y: 10, dataSizeTB: 100 },
        { name: 'b', algorithm: 'RSA-4096', X: 40, Y: 8, dataSizeTB: 50 },
      ],
      median,
    );
    expect(result.percentExposed).toBe(100);
    expect(result.exposedDataTB).toBe(150);
    expect(result.immediateActionRequired).toBe(true);
  });

  it('mixed org weights exposure by TB, not asset count', () => {
    const result = aggregateOrgRisk(
      [
        { name: 'big-broken', algorithm: 'RSA-2048', X: 50, Y: 10, dataSizeTB: 100 },
        { name: 'small-safe', algorithm: 'ML-KEM-768', X: 50, Y: 10, dataSizeTB: 100 },
      ],
      median,
    );
    expect(result.totalDataTB).toBe(200);
    expect(result.exposedDataTB).toBe(100);
    expect(result.percentExposed).toBe(50);
  });

  it('reports worstAsset by risk level', () => {
    const result = aggregateOrgRisk(
      [
        { name: 'safe', algorithm: 'ML-KEM-768', X: 100, Y: 20, dataSizeTB: 1 },
        { name: 'doomed', algorithm: 'RSA-2048', X: 50, Y: 10, dataSizeTB: 1 },
      ],
      median,
    );
    expect(result.worstAsset).toBe('doomed');
  });

  it('handles empty asset list without dividing by zero', () => {
    const result = aggregateOrgRisk([], median);
    expect(result.totalDataTB).toBe(0);
    expect(result.percentExposed).toBe(0);
    expect(result.immediateActionRequired).toBe(false);
  });
});

describe('ALGORITHM_SECURITY catalog', () => {
  it('has at least one quantum-safe KEM and one signature', () => {
    expect(
      ALGORITHM_SECURITY.some((a) => a.algorithm.includes('ML-KEM') && a.longTermSafe),
    ).toBe(true);
    expect(
      ALGORITHM_SECURITY.some((a) => a.algorithm.includes('ML-DSA') && a.longTermSafe),
    ).toBe(true);
  });

  it('all RSA/ECDSA/Ed25519/X25519 variants are marked broken', () => {
    const classical = ALGORITHM_SECURITY.filter(
      (a) =>
        a.algorithm.startsWith('RSA') ||
        a.algorithm.startsWith('ECDSA') ||
        a.algorithm.startsWith('Ed25519') ||
        a.algorithm === 'X25519 ECDH',
    );
    expect(classical.length).toBeGreaterThan(3);
    for (const a of classical) expect(a.broken).toBe(true);
  });

  it('no algorithm is simultaneously broken AND longTermSafe', () => {
    for (const a of ALGORITHM_SECURITY) {
      expect(a.broken && a.longTermSafe).toBe(false);
    }
  });

  it('algorithm names are unique', () => {
    const names = ALGORITHM_SECURITY.map((a) => a.algorithm);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('DATA_TYPES catalog', () => {
  it('min lifetime <= max lifetime for every category', () => {
    for (const dt of DATA_TYPES) {
      expect(dt.typicalLifetimeMin).toBeLessThanOrEqual(dt.typicalLifetimeMax);
      expect(dt.typicalLifetimeMin).toBeGreaterThanOrEqual(0);
    }
  });

  it('data type names are unique', () => {
    const names = DATA_TYPES.map((d) => d.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
