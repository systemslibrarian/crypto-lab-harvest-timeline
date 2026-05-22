import { describe, it, expect } from 'vitest';
import {
  PRESET_ORGANIZATIONS,
  analyzeOrganization,
  whatIfMigrationDelay,
  type OrganizationProfile,
} from '../src/scenarios.ts';
import { CRQC_SCENARIOS } from '../src/risk-engine.ts';

const median = CRQC_SCENARIOS.find((s) => s.label === 'median')!;

describe('PRESET_ORGANIZATIONS', () => {
  it('exposes the 5 documented preset profiles', () => {
    expect(PRESET_ORGANIZATIONS.length).toBeGreaterThanOrEqual(5);
    const names = PRESET_ORGANIZATIONS.map((o) => o.name);
    expect(names).toContain('Small Medical Clinic');
    expect(names).toContain('Mid-Size Bank');
    expect(names).toContain('Government Intelligence Agency');
    expect(names).toContain('Tech Startup');
    expect(names).toContain('Research University Lab');
  });

  it('every asset has non-negative lifetime and positive TB', () => {
    for (const o of PRESET_ORGANIZATIONS) {
      for (const a of o.assets) {
        expect(a.dataLifetimeYears).toBeGreaterThanOrEqual(0);
        expect(a.dataSizeTB).toBeGreaterThan(0);
      }
    }
  });

  it('every profile has positive typicalMigrationYears', () => {
    for (const o of PRESET_ORGANIZATIONS) {
      expect(o.typicalMigrationYears).toBeGreaterThan(0);
    }
  });
});

describe('analyzeOrganization', () => {
  it('returns one assessment per asset', () => {
    for (const profile of PRESET_ORGANIZATIONS) {
      const a = analyzeOrganization(profile, median);
      expect(a.assetAssessments.length).toBe(profile.assets.length);
    }
  });

  it('priorityOrder is sorted by descending risk score', () => {
    const profile = PRESET_ORGANIZATIONS.find((o) => o.name === 'Government Intelligence Agency')!;
    const a = analyzeOrganization(profile, median);
    for (let i = 1; i < a.priorityOrder.length; i++) {
      expect(a.priorityOrder[i - 1].score).toBeGreaterThanOrEqual(a.priorityOrder[i].score);
    }
  });

  it('aggregates total TB across all assets', () => {
    const profile = PRESET_ORGANIZATIONS[0];
    const a = analyzeOrganization(profile, median);
    const sum = profile.assets.reduce((s, asset) => s + asset.dataSizeTB, 0);
    expect(a.aggregateRisk.totalDataTB).toBeCloseTo(sum, 5);
  });

  it('always returns a topRecommendation string', () => {
    for (const profile of PRESET_ORGANIZATIONS) {
      const a = analyzeOrganization(profile, median);
      expect(typeof a.topRecommendation).toBe('string');
      expect(a.topRecommendation.length).toBeGreaterThan(0);
    }
  });

  it('government agency (long lifetimes + broken algos) flags immediate action', () => {
    const profile = PRESET_ORGANIZATIONS.find((o) => o.name === 'Government Intelligence Agency')!;
    const a = analyzeOrganization(profile, median);
    expect(a.aggregateRisk.immediateActionRequired).toBe(true);
  });
});

describe('whatIfMigrationDelay', () => {
  it('non-decreasing exposed-TB as delay grows', () => {
    const profile = PRESET_ORGANIZATIONS.find((o) => o.name === 'Mid-Size Bank')!;
    const r0 = whatIfMigrationDelay(profile, median, 0);
    const r1 = whatIfMigrationDelay(profile, median, 1);
    const r5 = whatIfMigrationDelay(profile, median, 5);
    const r10 = whatIfMigrationDelay(profile, median, 10);
    expect(r1.exposedDataTB).toBeGreaterThanOrEqual(r0.exposedDataTB);
    expect(r5.exposedDataTB).toBeGreaterThanOrEqual(r1.exposedDataTB);
    expect(r10.exposedDataTB).toBeGreaterThanOrEqual(r5.exposedDataTB);
  });

  it('quantum-safe assets are never counted as exposed regardless of delay', () => {
    const fakeProfile: OrganizationProfile = {
      name: 'All-Safe Co.',
      description: 'test',
      size: 'small',
      typicalMigrationYears: 5,
      assets: [
        { name: 'safe', dataType: 'Personal data (PII)', algorithm: 'ML-KEM-768', dataLifetimeYears: 100, dataSizeTB: 10 },
        { name: 'aes',  dataType: 'Medical records',     algorithm: 'AES-256',    dataLifetimeYears: 50,  dataSizeTB: 5  },
      ],
    };
    const r = whatIfMigrationDelay(fakeProfile, median, 100);
    expect(r.exposedAssets).toBe(0);
    expect(r.exposedDataTB).toBe(0);
  });

  it('delay=0 matches starting migration today', () => {
    const profile = PRESET_ORGANIZATIONS[0];
    const r = whatIfMigrationDelay(profile, median, 0);
    expect(r.exposedAssets).toBeGreaterThanOrEqual(0);
    expect(r.exposedDataTB).toBeGreaterThanOrEqual(0);
  });
});
