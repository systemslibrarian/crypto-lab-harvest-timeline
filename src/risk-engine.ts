/**
 * Core risk calculation following the Mosca Inequality.
 * All times are in years from today (2026).
 *
 * Mosca Inequality: X + Y > Z
 *   X = data shelf life (years data must remain secret)
 *   Y = migration time (years to deploy PQC)
 *   Z = CRQC arrival (years until cryptographically-relevant quantum computer)
 *
 * Citation: Michele Mosca, "Cybersecurity in an era with quantum computers:
 * will we be ready?" IEEE Security & Privacy, 2018.
 */

/**
 * Reference year for all CRQC scenario timelines.
 *
 * CRQC_SCENARIOS.yearsFromNow (7 / 12 / 17 / 25) is calibrated against the
 * 2025 GRI/evolutionQ Quantum Threat Timeline Report, which anchors its
 * expert survey to 2025–2026. Using new Date().getFullYear() would silently
 * shift CRQC arrival predictions every January, so we hardcode the anchor
 * and bump it deliberately when a new GRI report ships.
 */
export const CURRENT_YEAR = 2026;

/**
 * Different expert views of when CRQC arrives.
 * Based on 2025 GRI/evolutionQ Quantum Threat Timeline Report.
 * Citation: Mosca & Piani, evolutionQ / Global Risk Institute, 2025.
 */
export interface CRQCScenario {
  label: 'aggressive' | 'median' | 'pessimistic' | 'ultra-pessimistic';
  yearsFromNow: number;
  probabilityBy10Years: number;
  probabilityBy15Years: number;
  probabilityBy20Years: number;
  description: string;
  citation: string;
}

export const CRQC_SCENARIOS: CRQCScenario[] = [
  {
    label: 'aggressive',
    yearsFromNow: 7, // 2033
    probabilityBy10Years: 0.49, // 2025 optimistic expert estimate
    probabilityBy15Years: 0.85,
    probabilityBy20Years: 0.95,
    description:
      'Aggressive: assumes continued quantum breakthroughs (Google Willow trajectory,' +
      ' Gidney sub-million-qubit RSA factoring, error-correction acceleration)',
    citation: 'GRI/evolutionQ 2025, optimistic interpretation',
  },
  {
    label: 'median',
    yearsFromNow: 12, // 2038
    probabilityBy10Years: 0.38,
    probabilityBy15Years: 0.69, // 2025 survey: 69% say ≥50% by 15 yrs
    probabilityBy20Years: 0.92, // 2025 survey: 92% say ≥50% by 20 yrs
    description:
      'Median: balanced view based on GRI 2025 expert consensus — sharpest upward' +
      ' shift since surveys began in 2019',
    citation: 'GRI/evolutionQ 2025, median interpretation — Mosca & Piani',
  },
  {
    label: 'pessimistic',
    yearsFromNow: 17, // 2043
    probabilityBy10Years: 0.28, // 2025 pessimistic expert estimate
    probabilityBy15Years: 0.5,
    probabilityBy20Years: 0.75,
    description:
      'Pessimistic: assumes hard engineering challenges remain (qubit coherence,' +
      ' error-correction overhead, fault-tolerant scaling)',
    citation: 'GRI/evolutionQ 2025, pessimistic interpretation',
  },
  {
    label: 'ultra-pessimistic',
    yearsFromNow: 25, // 2051
    probabilityBy10Years: 0.05,
    probabilityBy15Years: 0.15,
    probabilityBy20Years: 0.3,
    description:
      'Ultra-pessimistic: assumes fundamental physical limits prevent near-term CRQC',
    citation: 'Academic skeptics: Scholten et al. 2024, Gagliardoni 2017',
  },
];

/**
 * How different algorithms fare against quantum attacks.
 */
export interface AlgorithmQuantumSecurity {
  algorithm: string;
  classicalStrength: number; // bits
  quantumStrength: number;   // bits (post-Grover/Shor)
  broken: boolean;           // completely broken by quantum
  longTermSafe: boolean;     // safe for 50+ year horizons
  notes: string;
}

export const ALGORITHM_SECURITY: AlgorithmQuantumSecurity[] = [
  // BROKEN by Shor's algorithm (need urgent migration)
  {
    algorithm: 'RSA-2048',
    classicalStrength: 112,
    quantumStrength: 0,
    broken: true,
    longTermSafe: false,
    notes: "Fully broken by Shor's algorithm",
  },
  {
    algorithm: 'RSA-4096',
    classicalStrength: 152,
    quantumStrength: 0,
    broken: true,
    longTermSafe: false,
    notes: "Larger key helps classically, still Shor-vulnerable",
  },
  {
    algorithm: 'ECDSA-P256',
    classicalStrength: 128,
    quantumStrength: 0,
    broken: true,
    longTermSafe: false,
    notes: 'Broken by Shor (ECDLP)',
  },
  {
    algorithm: 'ECDSA-P384',
    classicalStrength: 192,
    quantumStrength: 0,
    broken: true,
    longTermSafe: false,
    notes: 'Same attack as P-256, larger key only slows classical attack',
  },
  {
    algorithm: 'Ed25519',
    classicalStrength: 128,
    quantumStrength: 0,
    broken: true,
    longTermSafe: false,
    notes: 'Broken by Shor (ECDLP)',
  },
  {
    algorithm: 'X25519 ECDH',
    classicalStrength: 128,
    quantumStrength: 0,
    broken: true,
    longTermSafe: false,
    notes: 'Broken by Shor (ECDLP)',
  },
  {
    algorithm: 'TLS-ECDSA',
    classicalStrength: 128,
    quantumStrength: 0,
    broken: true,
    longTermSafe: false,
    notes: 'ECDSA component broken by Shor (ECDLP)',
  },
  {
    algorithm: 'RSA-2048 + AES-256',
    classicalStrength: 112,
    quantumStrength: 0,
    broken: true,
    longTermSafe: false,
    notes: "RSA key exchange broken by Shor's; AES-256 layer alone cannot protect",
  },
  {
    algorithm: 'RSA-4096 + AES-256',
    classicalStrength: 152,
    quantumStrength: 0,
    broken: true,
    longTermSafe: false,
    notes: "RSA key exchange broken by Shor's; overall system remains vulnerable",
  },
  {
    algorithm: 'ECDSA-P256 + AES-256',
    classicalStrength: 128,
    quantumStrength: 0,
    broken: true,
    longTermSafe: false,
    notes: 'ECDSA component broken by Shor (ECDLP)',
  },
  {
    algorithm: 'ECDSA-P384 + AES-256',
    classicalStrength: 192,
    quantumStrength: 0,
    broken: true,
    longTermSafe: false,
    notes: 'ECDSA component broken by Shor (ECDLP)',
  },
  {
    algorithm: 'Ed25519 + AES-256',
    classicalStrength: 128,
    quantumStrength: 0,
    broken: true,
    longTermSafe: false,
    notes: 'Ed25519 component broken by Shor (ECDLP)',
  },
  {
    algorithm: 'ECDH + AES-256',
    classicalStrength: 128,
    quantumStrength: 0,
    broken: true,
    longTermSafe: false,
    notes: 'ECDH key agreement broken by Shor (ECDLP)',
  },

  // PARTIALLY AFFECTED by Grover's algorithm
  {
    algorithm: 'AES-128',
    classicalStrength: 128,
    quantumStrength: 64,
    broken: false,
    longTermSafe: false,
    notes: "Grover halves bit-strength to 64 bits; weak for long-term",
  },
  {
    algorithm: 'AES-256',
    classicalStrength: 256,
    quantumStrength: 128,
    broken: false,
    longTermSafe: true,
    notes: 'Grover gives 128-bit effective security; still quantum-safe for decades',
  },
  {
    algorithm: 'SHA-256',
    classicalStrength: 128,
    quantumStrength: 85,
    broken: false,
    longTermSafe: true,
    notes:
      'Preimage ~128 bits post-Grover; collision ~85 bits (Brassard-Høyer-Tapp).' +
      ' Still safe for short-lived signatures but consider SHA-384 for long horizons.',
  },
  {
    algorithm: 'SHA-384',
    classicalStrength: 192,
    quantumStrength: 128,
    broken: false,
    longTermSafe: true,
    notes:
      'Preimage ~192 bits post-Grover; collision ~128 bits (BHT). CNSA 2.0 baseline.',
  },

  // QUANTUM-SAFE (NIST PQC standards — migrate TO these)
  {
    algorithm: 'ML-KEM-768',
    classicalStrength: 128,
    quantumStrength: 128,
    broken: false,
    longTermSafe: true,
    notes: 'NIST FIPS 203 (2024); lattice-based KEM, no known quantum attack',
  },
  {
    algorithm: 'ML-KEM-1024',
    classicalStrength: 192,
    quantumStrength: 192,
    broken: false,
    longTermSafe: true,
    notes: 'Higher security level; CNSA 2.0 requirement for TOP SECRET',
  },
  {
    algorithm: 'ML-DSA-65',
    classicalStrength: 128,
    quantumStrength: 128,
    broken: false,
    longTermSafe: true,
    notes: 'NIST FIPS 204 (2024); lattice-based signatures',
  },
  {
    algorithm: 'ML-DSA-87',
    classicalStrength: 192,
    quantumStrength: 192,
    broken: false,
    longTermSafe: true,
    notes: 'Higher security level FIPS 204 variant',
  },
  {
    algorithm: 'SLH-DSA',
    classicalStrength: 128,
    quantumStrength: 128,
    broken: false,
    longTermSafe: true,
    notes: 'Hash-based signatures (FIPS 205); minimal cryptographic assumptions',
  },
  {
    algorithm: 'LMS_H10',
    classicalStrength: 128,
    quantumStrength: 128,
    broken: false,
    longTermSafe: true,
    notes: 'Stateful hash-based signatures; firmware signing use case',
  },
  {
    algorithm: 'XMSS_H10',
    classicalStrength: 128,
    quantumStrength: 128,
    broken: false,
    longTermSafe: true,
    notes: 'Stateful hash-based; IETF RFC 8391',
  },
];

/**
 * Data type catalog with typical sensitivity lifetimes.
 */
export interface DataTypeCategory {
  name: string;
  typicalLifetimeMin: number; // years
  typicalLifetimeMax: number;
  examples: string[];
  regulatoryBasis: string;
}

export const DATA_TYPES: DataTypeCategory[] = [
  {
    name: 'Medical records',
    typicalLifetimeMin: 20,
    typicalLifetimeMax: 50,
    examples: ['Patient history', 'Diagnostic imaging', 'Treatment plans'],
    regulatoryBasis: 'HIPAA (US), GDPR Art 9 (EU) — typically 10+ years minimum',
  },
  {
    name: 'Genetic/genomic data',
    typicalLifetimeMin: 70,
    typicalLifetimeMax: 100,
    examples: ['DNA sequences', 'Ancestry data', 'Pharmacogenomic profiles'],
    regulatoryBasis: 'GINA (US), lifetime + heirs (EU)',
  },
  {
    name: 'Financial transactions',
    typicalLifetimeMin: 7,
    typicalLifetimeMax: 30,
    examples: ['Bank transactions', 'Tax records', 'Audit trails'],
    regulatoryBasis: 'SOX (US), GDPR, tax retention',
  },
  {
    name: 'Intellectual property',
    typicalLifetimeMin: 20,
    typicalLifetimeMax: 70,
    examples: ['Patents', 'Trade secrets', 'Designs'],
    regulatoryBasis: 'Trade secret law (indefinite for some)',
  },
  {
    name: 'Classified government',
    typicalLifetimeMin: 25,
    typicalLifetimeMax: 75,
    examples: ['TOP SECRET', 'National defense info', 'Intelligence sources'],
    regulatoryBasis: 'NARA declassification schedules',
  },
  {
    name: 'Personal data (PII)',
    typicalLifetimeMin: 3,
    typicalLifetimeMax: 10,
    examples: ['User accounts', 'Email addresses', 'Phone numbers'],
    regulatoryBasis: 'GDPR, CCPA, various',
  },
  {
    name: 'Critical infrastructure',
    typicalLifetimeMin: 30,
    typicalLifetimeMax: 50,
    examples: ['SCADA configs', 'Power grid designs', 'Water system schematics'],
    regulatoryBasis: 'NERC CIP, CISA critical infrastructure',
  },
  {
    name: 'Legal documents',
    typicalLifetimeMin: 7,
    typicalLifetimeMax: 80,
    examples: ['Wills', 'Contracts', 'Court records'],
    regulatoryBasis: 'Varies: statute of limitations, perpetual for some',
  },
  {
    name: 'Corporate comms',
    typicalLifetimeMin: 1,
    typicalLifetimeMax: 7,
    examples: ['Internal email', 'Slack/Teams chat', 'Meeting notes'],
    regulatoryBasis: 'Discovery / e-discovery typical retention',
  },
  {
    name: 'Research data',
    typicalLifetimeMin: 5,
    typicalLifetimeMax: 50,
    examples: ['Clinical trials', 'Academic datasets', 'Experimental results'],
    regulatoryBasis: 'NIH, NSF, journal requirements',
  },
];

/**
 * Compute the Mosca Inequality for a specific data asset.
 * Returns the core risk assessment.
 */
export interface RiskAssessment {
  assetName: string;
  algorithm: string;
  dataLifetimeYears: number; // X
  migrationTimeYears: number; // Y
  crqcYear: number;           // T0 + Z
  today: number;

  moscaInequality: {
    X: number;
    Y: number;
    Z: number;
    exposed: boolean;    // X + Y > Z?
    marginYears: number; // Z - (X + Y), negative = exposed
  };

  riskLevel: 'none' | 'low' | 'medium' | 'high' | 'critical';
  exposureWindow: {
    startYear: number;  // earliest year of risk
    endYear: number;    // latest year of risk
    duration: number;
  };

  recommendation: string;
  recommendedAction:
    | 'monitor'
    | 'plan_migration'
    | 'urgent_migration'
    | 'emergency_migration';
}

function getAlgorithmSecurity(algorithm: string): AlgorithmQuantumSecurity | undefined {
  return ALGORITHM_SECURITY.find(
    (a) => a.algorithm.toLowerCase() === algorithm.toLowerCase(),
  );
}

function computeRiskLevel(
  algInfo: AlgorithmQuantumSecurity | undefined,
  X: number,
  Y: number,
  Z: number,
): RiskAssessment['riskLevel'] {
  // Quantum-safe algorithms: no risk regardless of lifetimes
  if (algInfo && !algInfo.broken && algInfo.longTermSafe) {
    return 'none';
  }

  const margin = Z - (X + Y);

  if (algInfo?.broken === false && algInfo.quantumStrength >= 128) {
    // Partially affected but still strong (e.g. AES-256)
    if (margin > 10) return 'low';
    if (margin > 0) return 'medium';
    return 'high';
  }

  // Broken algorithms
  if (margin > 15) return 'low';
  if (margin > 5) return 'medium';
  if (margin > -10) return 'high';
  return 'critical';
}

export function assessRisk(
  assetName: string,
  algorithm: string,
  dataLifetimeYears: number,
  migrationTimeYears: number,
  scenario: CRQCScenario,
): RiskAssessment {
  const X = dataLifetimeYears;
  const Y = migrationTimeYears;
  const Z = scenario.yearsFromNow;
  const today = CURRENT_YEAR;
  const crqcYear = today + Z;

  const exposed = X + Y > Z;
  const marginYears = Z - (X + Y);

  const algInfo = getAlgorithmSecurity(algorithm);
  const riskLevel = computeRiskLevel(algInfo, X, Y, Z);

  // Exposure window: the period during which harvested data can be decrypted
  // Starts at CRQC arrival (or earlier if already past), ends at data expiry
  const dataExpiryYear = today + X;
  const startYear = Math.min(crqcYear, dataExpiryYear);
  const endYear = dataExpiryYear;
  const duration = Math.max(0, endYear - startYear);

  let recommendation: string;
  let recommendedAction: RiskAssessment['recommendedAction'];

  if (riskLevel === 'none') {
    recommendation =
      'Algorithm is quantum-safe. Continue monitoring NIST PQC standards for updates.';
    recommendedAction = 'monitor';
  } else if (riskLevel === 'low') {
    recommendation =
      `Margin of ${marginYears.toFixed(0)} years. Include in planned PQC migration roadmap.` +
      ' Implement crypto-agility layer for future flexibility.';
    recommendedAction = 'plan_migration';
  } else if (riskLevel === 'medium') {
    recommendation =
      `Margin of ${marginYears.toFixed(0)} years. Begin PQC migration planning now.` +
      ' Prioritize deploying hybrid classical+PQC within 12-18 months.';
    recommendedAction = 'plan_migration';
  } else if (riskLevel === 'high') {
    recommendation =
      `EXPOSED by ${Math.abs(marginYears).toFixed(0)} years.` +
      ' Begin PQC migration immediately. Use hybrid classical+ML-KEM-768 for new data.' +
      ' Prioritize re-encryption of high-value assets.';
    recommendedAction = 'urgent_migration';
  } else {
    // critical
    recommendation =
      `CRITICAL: Exposed by ${Math.abs(marginYears).toFixed(0)} years.` +
      ' Data encrypted today is ALREADY being harvested for future decryption.' +
      ' Emergency migration required — deploy ML-KEM-1024/ML-DSA-87 immediately.' +
      ' CNSA 2.0 compliance may be required (classified data).';
    recommendedAction = 'emergency_migration';
  }

  return {
    assetName,
    algorithm,
    dataLifetimeYears: X,
    migrationTimeYears: Y,
    crqcYear,
    today,
    moscaInequality: { X, Y, Z, exposed, marginYears },
    riskLevel,
    exposureWindow: { startYear, endYear, duration },
    recommendation,
    recommendedAction,
  };
}

/**
 * Compute year-by-year probability that data encrypted today
 * becomes decryptable.
 *
 * For broken algorithms: follows S-curve growth from known probability anchors.
 * For quantum-safe: constant ~0%.
 * Returns array of (year, probability) pairs.
 */
export function computeExposureCurve(
  algorithm: string,
  scenario: CRQCScenario,
  horizonYears: number = 50,
): Array<{ year: number; probDecryptable: number }> {
  const algInfo = getAlgorithmSecurity(algorithm);

  // Quantum-safe: negligible probability
  if (algInfo && !algInfo.broken && algInfo.longTermSafe) {
    return Array.from({ length: horizonYears + 1 }, (_, i) => ({
      year: CURRENT_YEAR + i,
      probDecryptable: 0,
    }));
  }

  // Build probability curve using known anchors from GRI 2025 report
  // Anchor points: (0, 0%), (10y, p10), (15y, p15), (20y, p20), (crqcYear, 50%)
  // We interpolate with a logistic/S-curve between anchors

  const anchors: Array<{ yearsFromNow: number; prob: number }> = [
    { yearsFromNow: 0, prob: 0 },
    { yearsFromNow: 10, prob: scenario.probabilityBy10Years },
    { yearsFromNow: 15, prob: scenario.probabilityBy15Years },
    { yearsFromNow: 20, prob: scenario.probabilityBy20Years },
    { yearsFromNow: 30, prob: Math.min(0.99, scenario.probabilityBy20Years + 0.05) },
  ];

  // Partially-broken algorithms (AES-128) have half the risk due to reduced quantum advantage
  const modifier = algInfo && !algInfo.broken ? 0.5 : 1.0;

  const result: Array<{ year: number; probDecryptable: number }> = [];
  let lastProb = 0;

  for (let i = 0; i <= horizonYears; i++) {
    const yearsFromNow = i;
    let prob = interpolateAnchors(anchors, yearsFromNow) * modifier;
    // Ensure monotonically increasing
    prob = Math.max(prob, lastProb);
    prob = Math.min(prob, 1);
    lastProb = prob;
    result.push({ year: CURRENT_YEAR + i, probDecryptable: prob });
  }

  return result;
}

function interpolateAnchors(
  anchors: Array<{ yearsFromNow: number; prob: number }>,
  t: number,
): number {
  // Find surrounding anchors
  for (let i = 0; i < anchors.length - 1; i++) {
    const a = anchors[i];
    const b = anchors[i + 1];
    if (t >= a.yearsFromNow && t <= b.yearsFromNow) {
      const span = b.yearsFromNow - a.yearsFromNow;
      const frac = (t - a.yearsFromNow) / span;
      // Smooth step (cubic) for S-curve feel
      const smooth = frac * frac * (3 - 2 * frac);
      return a.prob + smooth * (b.prob - a.prob);
    }
  }
  // Beyond last anchor
  return anchors[anchors.length - 1].prob;
}

/**
 * Compute an aggregate organizational risk score.
 * Input: multiple assets with their own X, Y.
 * Output: overall exposure percentage.
 */
export function aggregateOrgRisk(
  assets: Array<{
    name: string;
    algorithm: string;
    X: number;
    Y: number;
    dataSizeTB: number;
  }>,
  scenario: CRQCScenario,
): {
  totalDataTB: number;
  exposedDataTB: number;
  percentExposed: number;
  worstAsset: string;
  immediateActionRequired: boolean;
} {
  let totalDataTB = 0;
  let exposedDataTB = 0;
  let worstAsset = '';
  let worstScore = -Infinity;
  let immediateActionRequired = false;

  for (const asset of assets) {
    totalDataTB += asset.dataSizeTB;
    const assessment = assessRisk(
      asset.name,
      asset.algorithm,
      asset.X,
      asset.Y,
      scenario,
    );

    const riskScore = riskLevelScore(assessment.riskLevel);
    if (riskScore > worstScore) {
      worstScore = riskScore;
      worstAsset = asset.name;
    }

    // Only count as exposed if the algorithm is actually vulnerable to quantum attack.
    // Quantum-safe algorithms (riskLevel 'none') are never exposed regardless of Mosca math.
    if (assessment.moscaInequality.exposed && assessment.riskLevel !== 'none') {
      exposedDataTB += asset.dataSizeTB;
    }

    if (
      assessment.riskLevel === 'critical' ||
      assessment.riskLevel === 'high'
    ) {
      immediateActionRequired = true;
    }
  }

  const percentExposed =
    totalDataTB > 0 ? (exposedDataTB / totalDataTB) * 100 : 0;

  return {
    totalDataTB,
    exposedDataTB,
    percentExposed,
    worstAsset,
    immediateActionRequired,
  };
}

function riskLevelScore(level: RiskAssessment['riskLevel']): number {
  const scores: Record<RiskAssessment['riskLevel'], number> = {
    none: 0,
    low: 1,
    medium: 2,
    high: 3,
    critical: 4,
  };
  return scores[level];
}
