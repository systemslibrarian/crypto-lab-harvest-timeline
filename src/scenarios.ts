/**
 * Preset organizational scenarios and analysis functions.
 * Uses the Mosca Inequality engine from risk-engine.ts.
 *
 * Illustrative migration assumptions for this exercise:
 * - Small enterprise: 5-7 years
 * - Medium enterprise: 8-12 years
 * - Large enterprise / government: 12-15+ years
 */

import {
  assessRisk,
  aggregateOrgRisk,
  CRQC_SCENARIOS,
  type CRQCScenario,
  type RiskAssessment,
} from './risk-engine.ts';

export type { RiskAssessment };
export { CRQC_SCENARIOS };

export interface OrganizationProfile {
  name: string;
  description: string;
  size: 'small' | 'medium' | 'large' | 'government';
  securityProfile?: 'CNSA 2.0';
  typicalMigrationYears: number;
  assets: Array<{
    name: string;
    dataType: string;
    algorithm: string;
    dataLifetimeYears: number;
    dataSizeTB: number;
  }>;
}

export const PRESET_ORGANIZATIONS: OrganizationProfile[] = [
  {
    name: 'Small Medical Clinic',
    description: '10 doctors, 5000 patients, mostly local infrastructure',
    size: 'small',
    typicalMigrationYears: 5,
    assets: [
      {
        name: 'Patient EHR database',
        dataType: 'Medical records',
        algorithm: 'RSA-2048 + AES-256',
        dataLifetimeYears: 30,
        dataSizeTB: 2,
      },
      {
        name: 'Backup archives',
        dataType: 'Medical records',
        algorithm: 'AES-256',
        dataLifetimeYears: 20,
        dataSizeTB: 15,
      },
      {
        name: 'Email system',
        dataType: 'Corporate comms',
        algorithm: 'ECDH + AES-256',
        dataLifetimeYears: 3,
        dataSizeTB: 1,
      },
    ],
  },
  {
    name: 'Mid-Size Bank',
    description: 'Regional bank, 500K accounts, cloud + on-prem',
    size: 'medium',
    typicalMigrationYears: 10,
    assets: [
      {
        name: 'Transaction logs',
        dataType: 'Financial transactions',
        algorithm: 'RSA-4096 + AES-256',
        dataLifetimeYears: 10,
        dataSizeTB: 50,
      },
      {
        name: 'Long-term archives',
        dataType: 'Legal documents',
        algorithm: 'RSA-4096',
        dataLifetimeYears: 30,
        dataSizeTB: 200,
      },
      {
        name: 'Customer PII',
        dataType: 'Personal data (PII)',
        algorithm: 'ECDH + AES-256',
        dataLifetimeYears: 7,
        dataSizeTB: 10,
      },
      {
        name: 'Internal emails',
        dataType: 'Corporate comms',
        algorithm: 'ECDH + AES-256',
        dataLifetimeYears: 7,
        dataSizeTB: 5,
      },
    ],
  },
  {
    name: 'Government Intelligence Agency',
    description: 'Illustrative U.S. national security system with classified holdings',
    securityProfile: 'CNSA 2.0',
    size: 'government',
    typicalMigrationYears: 15,
    assets: [
      {
        name: 'Classified documents',
        dataType: 'Classified government',
        algorithm: 'RSA-4096 + AES-256',
        dataLifetimeYears: 50,
        dataSizeTB: 500,
      },
      {
        name: 'Intelligence comms',
        dataType: 'Classified government',
        algorithm: 'ECDH + AES-256',
        dataLifetimeYears: 50,
        dataSizeTB: 100,
      },
      {
        name: 'Critical infrastructure plans',
        dataType: 'Critical infrastructure',
        algorithm: 'RSA-4096',
        dataLifetimeYears: 40,
        dataSizeTB: 20,
      },
    ],
  },
  {
    name: 'Tech Startup',
    description: 'SaaS company, 100 employees, cloud-native',
    size: 'small',
    typicalMigrationYears: 2,
    assets: [
      {
        name: 'User data',
        dataType: 'Personal data (PII)',
        algorithm: 'ECDH + AES-256',
        dataLifetimeYears: 5,
        dataSizeTB: 10,
      },
      {
        name: 'Source code repo',
        dataType: 'Intellectual property',
        algorithm: 'AES-256',
        dataLifetimeYears: 20,
        dataSizeTB: 0.5,
      },
      {
        name: 'Customer comms',
        dataType: 'Corporate comms',
        algorithm: 'ECDH + AES-256',
        dataLifetimeYears: 3,
        dataSizeTB: 2,
      },
    ],
  },
  {
    name: 'Research University Lab',
    description: 'Genomics research lab',
    size: 'medium',
    typicalMigrationYears: 8,
    assets: [
      {
        name: 'Genomic sequences database',
        dataType: 'Genetic/genomic data',
        algorithm: 'RSA-2048 + AES-256',
        dataLifetimeYears: 70,
        dataSizeTB: 100,
      },
      {
        name: 'Clinical trial data',
        dataType: 'Research data',
        algorithm: 'ECDH + AES-256',
        dataLifetimeYears: 15,
        dataSizeTB: 30,
      },
      {
        name: 'Unpublished papers',
        dataType: 'Intellectual property',
        algorithm: 'RSA-2048 + AES-256',
        dataLifetimeYears: 25,
        dataSizeTB: 2,
      },
    ],
  },
];

export interface OrgAnalysisResult {
  assetAssessments: RiskAssessment[];
  aggregateRisk: ReturnType<typeof aggregateOrgRisk>;
  priorityOrder: Array<{ name: string; score: number; riskLevel: RiskAssessment['riskLevel'] }>;
  topRecommendation: string;
}

/**
 * Run the full Mosca analysis for an organization.
 * Returns per-asset assessments and aggregate risk.
 */
export function analyzeOrganization(
  profile: OrganizationProfile,
  scenario: CRQCScenario,
): OrgAnalysisResult {
  const assetAssessments: RiskAssessment[] = profile.assets.map((asset) =>
    assessRisk(
      asset.name,
      asset.algorithm,
      asset.dataLifetimeYears,
      profile.typicalMigrationYears,
      scenario,
    ),
  );

  const aggregateRisk = aggregateOrgRisk(
    profile.assets.map((a) => ({
      name: a.name,
      algorithm: a.algorithm,
      X: a.dataLifetimeYears,
      Y: profile.typicalMigrationYears,
      dataSizeTB: a.dataSizeTB,
    })),
    scenario,
  );

  const riskScoreMap: Record<RiskAssessment['riskLevel'], number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
    none: 0,
  };

  const priorityOrder = assetAssessments
    .map((a) => ({
      name: a.assetName,
      score: riskScoreMap[a.riskLevel],
      riskLevel: a.riskLevel,
    }))
    .sort((a, b) => b.score - a.score);

  let topRecommendation: string;

  if (aggregateRisk.immediateActionRequired) {
    const criticalAssets = priorityOrder.filter((a) => a.riskLevel === 'critical');
    if (criticalAssets.length > 0) {
      const parameters = profile.securityProfile === 'CNSA 2.0'
        ? 'This national security system uses the CNSA 2.0 profile: ML-KEM-1024 for key establishment and ML-DSA-87 for signatures.'
        : 'For a general-purpose deployment, ML-KEM-768 for key establishment and ML-DSA-65 for signatures are examples. Select the parameters required by the application.';
      topRecommendation =
        `EMERGENCY: ${criticalAssets.length} asset(s) at critical risk including` +
        ` "${criticalAssets[0].name}". Begin migration planning now. ${parameters}`;
    } else if (aggregateRisk.exposedDataTB > 0) {
      topRecommendation =
        `URGENT: ${aggregateRisk.percentExposed.toFixed(1)}% of data (${aggregateRisk.exposedDataTB.toFixed(1)} TB)` +
        ' crosses the modeled planning boundary. Prioritize assets whose confidentiality lifetime plus migration time exceeds the assumed time to arrival.';
    } else {
      const atBoundary = assetAssessments.some(a => a.riskLevel === 'high' && a.moscaInequality.marginYears === 0);
      topRecommendation = atBoundary
        ? 'URGENT: At least one asset has no spare planning time. No data volume crosses the strict planning boundary in this scenario.'
        : 'URGENT: Little planning time remains. No data volume crosses the strict planning boundary in this scenario.';
    }
  } else if (aggregateRisk.percentExposed > 0) {
    topRecommendation =
      `${aggregateRisk.percentExposed.toFixed(1)}% of data has measurable exposure.` +
      ' Include PQC migration in 2-year roadmap. Start with crypto-agility layer.';
  } else {
    topRecommendation =
      'Current posture is within acceptable risk bounds for the selected CRQC scenario.' +
      ' Monitor NIST PQC updates and plan migration for next infrastructure cycle.';
  }

  return { assetAssessments, aggregateRisk, priorityOrder, topRecommendation };
}

/**
 * What-if analyzer: show how risk changes if migration starts today
 * vs in 1, 2, 5 years.
 */
export function whatIfMigrationDelay(
  profile: OrganizationProfile,
  scenario: CRQCScenario,
  delayYears: number,
): {
  exposedAssets: number;
  exposedDataTB: number;
  totalMigrationTimeAffected: number;
} {
  const delayedAssets = profile.assets.map((a) => ({
    name: a.name,
    algorithm: a.algorithm,
    X: a.dataLifetimeYears,
    Y: profile.typicalMigrationYears + delayYears,
    dataSizeTB: a.dataSizeTB,
  }));

  const assessments = delayedAssets.map((a) =>
    assessRisk(a.name, a.algorithm, a.X, a.Y, scenario),
  );

  const exposedAssets = assessments.filter((a) => a.moscaInequality.exposed && a.riskLevel !== 'none').length;
  const exposedDataTB = delayedAssets
    .filter((_, i) => assessments[i].moscaInequality.exposed && assessments[i].riskLevel !== 'none')
    .reduce((sum, a) => sum + a.dataSizeTB, 0);
  const totalMigrationTimeAffected = delayedAssets.reduce(
    (sum, a) => {
      const r = assessments.find((ar) => ar.assetName === a.name);
      return r?.moscaInequality.exposed && r.riskLevel !== 'none' ? sum + a.Y : sum;
    },
    0,
  );

  return { exposedAssets, exposedDataTB, totalMigrationTimeAffected };
}
