# crypto-lab-harvest-timeline

[![CI](https://github.com/systemslibrarian/crypto-lab-harvest-timeline/actions/workflows/ci.yml/badge.svg)](https://github.com/systemslibrarian/crypto-lab-harvest-timeline/actions/workflows/ci.yml)
[![Deploy](https://github.com/systemslibrarian/crypto-lab-harvest-timeline/actions/workflows/deploy.yml/badge.svg)](https://github.com/systemslibrarian/crypto-lab-harvest-timeline/actions/workflows/deploy.yml)

## What It Is

This tool operationalizes the Harvest-Now-Decrypt-Later threat into concrete, quantified risk for specific data types, algorithms, and organizations. It is built around the **Mosca Inequality**:

```
X + Y > Z  →  YOUR DATA IS ALREADY AT RISK

  X = data shelf life (years data must stay secret)
  Y = migration time (years to deploy PQC protection)
  Z = CRQC arrival time (years until cryptographically-relevant quantum computer)
```

*Citation: Michele Mosca, "Cybersecurity in an era with quantum computers: will we be ready?" IEEE Security & Privacy, 2018.*

CRQC arrival probabilities use the **2025 GRI/evolutionQ Quantum Threat Timeline Report** (Mosca & Piani), which showed the sharpest upward shift in expert estimates since surveys began in 2019 — driven by Google's Willow processor, Gidney's sub-million-qubit RSA factoring result, and error-correction breakthroughs:

| Horizon | 10-year | 15-year | 20-year |
|---------|---------|---------|---------|
| Probability range | 28–49% | 69% say ≥50% | 92% say ≥50% (~46% say "extremely likely") |

The simulator covers **20+ cryptographic algorithms** across **4 CRQC scenarios** (aggressive, median, pessimistic, ultra-pessimistic) and analyzes **5 realistic organizational profiles**.

## When to Use It

- Answering **"do I need to migrate, and when?"** for specific data assets in your organization
- Communicating the HNDL threat to non-technical executives or board members (regulatory risk + data exposure framing)
- Planning **migration priorities** based on data sensitivity lifetime, not just algorithm age
- Comparing the **cost of migrating now vs. waiting** 1, 2, 5, or 10 years
- **Building new systems** quantum-safe from day 1 (personal application section)
- Do NOT use it for making binding legal/regulatory compliance decisions without independent expert review — the Mosca Inequality is a planning framework and this is a teaching demo, not a compliance tool.

## Live Demo

**[systemslibrarian.github.io/crypto-lab-harvest-timeline](https://systemslibrarian.github.io/crypto-lab-harvest-timeline/)**

Five interactive exhibits let you compute X+Y vs Z for a single asset, profile a whole organization's portfolio, watch year-by-year exposure curves from 2026 to 2076 across all four CRQC scenarios, run a cost-of-delay what-if table, and generate quantum-safe architecture recommendations for new systems. Results update live as you change data type, algorithm, lifetimes, and scenario.

## What Can Go Wrong

- **CRQC estimates are uncertain.** The 2025 GRI survey gives ranges (28–49%, not point estimates). The aggressive scenario assumes breakthroughs that might not happen. The pessimistic assumes engineering bottlenecks that might be solved.
- **Data sensitivity lifetimes vary.** "30 years for medical records" is typical but specific records may be shorter or longer. Regulatory minimums are floors, not averages.
- **Migration times are estimates.** Actual migration time depends heavily on organizational maturity, vendor support, and crypto-agility. 5 years for a small org could be 2 with good architecture or 10 with legacy constraints.
- **Mosca Inequality is a planning tool, not a proof.** Satisfying the inequality doesn't guarantee safety — implementation vulnerabilities (like KyberSlash) could still leak data even with quantum-safe algorithms.
- **Simplifications.** Real organizations have thousands of cryptographic dependencies, complex migration sequencing, and technical debt. This tool gives first-order estimates.
- **Regulatory changes.** CNSA 2.0, NIS2, and other frameworks may update their timelines. "By 2030" or "by 2035" dates are current as of 2025–2026 but subject to political change.

## Real-World Usage

The Mosca Inequality was formalized by Michele Mosca in "Cybersecurity in an era with quantum computers: will we be ready?" (IEEE Security & Privacy, 2018), building on his earlier work at the University of Waterloo and evolutionQ. The Global Risk Institute / evolutionQ Quantum Threat Timeline Report has been published annually since 2019; the 2025 edition (authored by Mosca and Marco Piani) is the most recent and shows the sharpest upward shift in expert CRQC probability estimates since the survey began.

The framework has been adopted by NIST, NSA (CNSA 2.0), UK NCSC, Germany BSI, ETSI, and multiple Fortune 500 cryptographic risk programs. The "Harvest-Now-Decrypt-Later" terminology itself was popularized by this risk model and now appears in NIST SP 1800-38B and related guidance documents.

## How to Run Locally

```bash
git clone https://github.com/systemslibrarian/crypto-lab-harvest-timeline
cd crypto-lab-harvest-timeline
npm install
npm run dev
```

## Related Demos

- [crypto-lab-harvest-vault](https://systemslibrarian.github.io/crypto-lab-harvest-vault/) — the HNDL concept demonstration this calculator quantifies.
- [crypto-lab-pq-rotation](https://systemslibrarian.github.io/crypto-lab-pq-rotation/) — hybrid key-rotation and migration planning under CNSA 2.0.
- [crypto-lab-pq-tls-handshake](https://systemslibrarian.github.io/crypto-lab-pq-tls-handshake/) — hybrid PQ+classical TLS 1.3 handshake.
- [crypto-lab-shor](https://systemslibrarian.github.io/crypto-lab-shor/) — what a CRQC actually does to RSA (Shor's algorithm).
- [crypto-lab-kyber-vault](https://systemslibrarian.github.io/crypto-lab-kyber-vault/) — ML-KEM-768, a quantum-safe destination algorithm.

## Five Exhibits

### Exhibit 1 — Personal Risk Calculator
Interactive single-asset Mosca Inequality calculator. Choose a data type, algorithm, data lifetime (X), migration time (Y), and CRQC scenario (Z). Results update live. Shows the visual X+Y vs Z bar comparison and a specific recommendation.

### Exhibit 2 — Organization Risk Profile
Multi-asset dashboard for 5 preset organizations (small medical clinic, mid-size bank, government intelligence agency, tech startup, research university). Shows per-asset risk table, aggregate TB exposure, and priority migration order.

### Exhibit 3 — Exposure Curve Over Time
SVG year-by-year exposure probability chart (2026–2076). Overlays all 4 CRQC scenarios. Switch algorithms to see how curves shift. Quantum-safe algorithms (ML-KEM-768, etc.) hold flat at 0%.

### Exhibit 4 — Cost of Delay
What-if table: what does starting migration now vs. in 1, 2, 5, or 10 years look like? Shows exposed assets, exposed TB, and whether you beat or miss the CRQC arrival window.

### Exhibit 5 — Personal Application
Concrete quantum-safe architecture recommendations for new systems. Includes a worked example for a ministry app (PrayerWarriors) with asset-by-asset algorithm recommendations, cross-linked to other tools in this series.

## Algorithm Coverage

**Broken by Shor's algorithm (urgent migration needed):**  
RSA-2048, RSA-4096, ECDSA-P256, ECDSA-P384, Ed25519, X25519 ECDH, TLS-ECDSA, and common hybrid combinations thereof.

**Partially affected by Grover's algorithm:**  
AES-128 (64-bit effective security — weak long-term), AES-256 (128-bit — still strong), SHA-256/SHA-384.

**Quantum-safe (migrate TO these):**  
ML-KEM-768, ML-KEM-1024 (NIST FIPS 203, 2024), ML-DSA-65, ML-DSA-87 (FIPS 204, 2024), SLH-DSA (FIPS 205, 2024), LMS_H10, XMSS_H10.

## Stack

- **Vite** + **TypeScript strict** + **Vanilla CSS**
- **Vitest** for unit + DOM + a11y tests (76 tests: Mosca math, exposure curves, aggregate risk, catalog invariants, happy-dom smoke tests that mount the UI and verify all five exhibits render, and a WCAG-AA contrast guard that parses the CSS palette and asserts every text color clears 4.5:1 in both light and dark themes)
- SVG for timeline visualization (no canvas dependencies)
- No backends, no tracking, no `Math.random()` (deterministic algorithms only)
- GitHub Pages deployment

## Accessibility & Mobile

Built to meet **WCAG 2.1 AA** and work on a phone:

- **Contrast:** every text color is verified ≥4.5:1 against the surfaces it sits on, in **both** light and dark themes (a CSS-parsing contrast test in CI fails the build on any regression). Severity and accent colors are themed per mode so nothing relies on a bright-on-white pairing.
- **Color is never the only signal:** risk levels carry an icon + text label, scenario curves carry a legend and labels, and the exposure chart renders on a fixed dark panel so its multi-hue lines stay legible regardless of theme.
- **Keyboard & screen reader:** skip link, single `banner`/`main`/`nav` landmarks, labelled form controls, `aria-live` result regions, `aria-sort` + keyboard-operable sortable tables, `aria-pressed` preset chips, an SVG `<title>` describing the chart, and a visible focus ring (`:focus-visible`).
- **Motion & output:** honors `prefers-reduced-motion`, ships a print stylesheet, and degrades to a styled `<noscript>` fallback when JavaScript is off.
- **Touch & layout:** ≥44px touch targets, responsive breakpoints at 900/640px, horizontally scrollable tables, and `dvh`-based sizing.

## Development

```bash
npm install        # install dependencies
npm run dev        # start Vite dev server (http://localhost:5173)
npm test           # run the Vitest suite once
npm run test:watch # run tests in watch mode
npm run build      # type-check + build to dist/
npm run preview    # preview the production build
```

CI runs `npm test` and `npm run build` on every push and PR to `main`. The
`deploy.yml` workflow publishes `dist/` to GitHub Pages on push to `main`.

---

*One of 120+ browser demos in the [Crypto Lab](https://crypto-lab.systemslibrarian.dev/) suite.*

*"So whether you eat or drink or whatever you do, do it all for the glory of God." — 1 Corinthians 10:31*
