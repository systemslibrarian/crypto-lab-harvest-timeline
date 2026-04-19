import './style.css';
import {
  CURRENT_YEAR,
  ALGORITHM_SECURITY,
  DATA_TYPES,
  CRQC_SCENARIOS,
  assessRisk,
  computeExposureCurve,
} from './risk-engine.ts';
import {
  PRESET_ORGANIZATIONS,
  analyzeOrganization,
  whatIfMigrationDelay,
} from './scenarios.ts';

// ─── helpers ─────────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function riskIcon(level: string): string {
  const icons: Record<string, string> = {
    critical: '🔴', high: '🟠', medium: '🟡', low: '🟢', none: '✅',
  };
  return icons[level] ?? '⚪';
}

function actionLabel(action: string): string {
  const labels: Record<string, string> = {
    emergency_migration: 'EMERGENCY MIGRATE',
    urgent_migration:    'URGENT MIGRATE',
    plan_migration:      'Plan Migration',
    monitor:             'Monitor',
  };
  return labels[action] ?? action;
}

// ─── theme toggle ─────────────────────────────────────────────────────────────

function initTheme(): void {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme') ?? 'dark';
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    btn.textContent = next === 'dark' ? '☀ Light' : '🌙 Dark';
  });
  const cur = document.documentElement.getAttribute('data-theme') ?? 'dark';
  btn.textContent = cur === 'dark' ? '☀ Light' : '🌙 Dark';
}

// ─── Exhibit 1: Personal Risk Calculator ─────────────────────────────────────

function renderExhibit1(): string {
  const dataTypeOptions = DATA_TYPES.map(
    (dt) => `<option value="${esc(dt.name)}">${esc(dt.name)} (${dt.typicalLifetimeMin}–${dt.typicalLifetimeMax}y)</option>`
  ).join('');

  const algoOptions = ALGORITHM_SECURITY.map(
    (a) => `<option value="${esc(a.algorithm)}">${esc(a.algorithm)}</option>`
  ).join('');

  const scenarioOptions = CRQC_SCENARIOS.map(
    (s) => `<option value="${esc(s.label)}">${esc(s.label.charAt(0).toUpperCase() + s.label.slice(1))} (~${CURRENT_YEAR + s.yearsFromNow})</option>`
  ).join('');

  return `
<div class="exhibit" id="exhibit-1">
  <div class="exhibit-header">
    <span class="exhibit-number">EXHIBIT 1</span>
    <h3>Personal Risk Calculator — Mosca Inequality for Your Data</h3>
  </div>
  <div class="exhibit-body">
    <div class="calc-grid">
      <div class="calc-inputs">
        <div class="field-group">
          <label class="field-label" for="e1-datatype">Data Type</label>
          <select id="e1-datatype">${dataTypeOptions}</select>
          <span class="field-sublabel" id="e1-lifetime-hint"></span>
        </div>
        <div class="field-group">
          <label class="field-label" for="e1-algo">Current Algorithm</label>
          <select id="e1-algo">${algoOptions}</select>
          <div class="algo-status" id="e1-algo-status" role="status" aria-live="polite"></div>
        </div>
        <div class="field-group">
          <label class="field-label" for="e1-x">Data Lifetime X = <span id="e1-x-label" aria-hidden="true"></span></label>
          <div class="range-row">
            <input type="range" id="e1-x" min="0" max="100" step="1" value="30"
              aria-valuemin="0" aria-valuemax="100" aria-valuenow="30" aria-valuetext="30 years"
              aria-describedby="e1-x-val" />
            <span class="range-value" id="e1-x-val" aria-live="polite">30 yrs</span>
          </div>
        </div>
        <div class="field-group">
          <label class="field-label" for="e1-y">Migration Time Y = <span id="e1-y-label" aria-hidden="true"></span></label>
          <div class="range-row">
            <input type="range" id="e1-y" min="1" max="20" step="1" value="5"
              aria-valuemin="1" aria-valuemax="20" aria-valuenow="5" aria-valuetext="5 years"
              aria-describedby="e1-y-val" />
            <span class="range-value" id="e1-y-val" aria-live="polite">5 yrs</span>
          </div>
        </div>
        <div class="field-group">
          <label class="field-label" for="e1-scenario">CRQC Arrival Scenario (Z)</label>
          <select id="e1-scenario">${scenarioOptions}</select>
          <span class="field-sublabel" id="e1-scenario-hint"></span>
        </div>
      </div>
      <div class="mosca-result" id="e1-result" aria-live="polite" aria-label="Mosca inequality risk result">
        <!-- filled dynamically -->
      </div>
    </div>
  </div>
</div>`;
}

function initExhibit1(): void {
  const dtSel  = document.getElementById('e1-datatype') as HTMLSelectElement;
  const algoSel = document.getElementById('e1-algo')    as HTMLSelectElement;
  const xRange  = document.getElementById('e1-x')       as HTMLInputElement;
  const yRange  = document.getElementById('e1-y')       as HTMLInputElement;
  const scenSel = document.getElementById('e1-scenario') as HTMLSelectElement;

  function update(): void {
    const xVal = parseInt(xRange.value);
    const yVal = parseInt(yRange.value);
    const scenario = CRQC_SCENARIOS.find(s => s.label === scenSel.value) ?? CRQC_SCENARIOS[1];
    const algoName = algoSel.value;

    // Update value displays + ARIA attributes
    (document.getElementById('e1-x-val') as HTMLElement).textContent = `${xVal} yrs`;
    (document.getElementById('e1-y-val') as HTMLElement).textContent = `${yVal} yrs`;
    xRange.setAttribute('aria-valuenow', String(xVal));
    xRange.setAttribute('aria-valuetext', `${xVal} years`);
    yRange.setAttribute('aria-valuenow', String(yVal));
    yRange.setAttribute('aria-valuetext', `${yVal} years`);

    // Update data type hint
    const dt = DATA_TYPES.find(d => d.name === dtSel.value);
    if (dt) {
      (document.getElementById('e1-lifetime-hint') as HTMLElement).textContent =
        `Typical: ${dt.typicalLifetimeMin}–${dt.typicalLifetimeMax} years — ${dt.regulatoryBasis}`;
    }

    // Update X label
    (document.getElementById('e1-x-label') as HTMLElement).textContent = `${xVal} years`;
    (document.getElementById('e1-y-label') as HTMLElement).textContent = `${yVal} years`;

    // Update algo status
    const algInfo = ALGORITHM_SECURITY.find(a => a.algorithm === algoName);
    const statusEl = document.getElementById('e1-algo-status') as HTMLElement;
    if (algInfo) {
      if (algInfo.broken) {
        statusEl.className = 'algo-status broken';
        statusEl.textContent = `⚠ BROKEN: ${algInfo.notes}`;
      } else if (algInfo.longTermSafe) {
        statusEl.className = 'algo-status safe';
        statusEl.textContent = `✓ QUANTUM-SAFE: ${algInfo.notes}`;
      } else {
        statusEl.className = 'algo-status partial';
        statusEl.textContent = `~ PARTIAL: ${algInfo.notes}`;
      }
    }

    // Update scenario hint
    (document.getElementById('e1-scenario-hint') as HTMLElement).textContent =
      `Z = ${scenario.yearsFromNow}y (${CURRENT_YEAR + scenario.yearsFromNow}) — ${scenario.citation}`;

    // Compute and render result
    const result = assessRisk(algoName, algoName, xVal, yVal, scenario);
    const resultEl = document.getElementById('e1-result') as HTMLElement;

    const X = result.moscaInequality.X;
    const Y = result.moscaInequality.Y;
    const Z = result.moscaInequality.Z;
    const exposed = result.moscaInequality.exposed;
    const margin = result.moscaInequality.marginYears;
    const maxBar = Math.max(X + Y, Z) * 1.1;
    const pctXY = Math.min(100, ((X + Y) / maxBar) * 100);
    const pctX  = Math.min(100, (X / maxBar) * 100);
    const pctY  = Math.min(100, (Y / maxBar) * 100);
    const pctZ  = Math.min(100, (Z / maxBar) * 100);

    resultEl.innerHTML = `
      <div class="mosca-vars">
        <div class="row"><span class="label">X (data lifetime)</span><span class="value" style="color:var(--color-lifetime)">${X} years</span></div>
        <div class="row"><span class="label">Y (migration time)</span><span class="value" style="color:var(--color-migration)">${Y} years</span></div>
        <div class="row"><span class="label">Z (CRQC arrival)</span><span class="value" style="color:var(--color-crqc)">${Z} years (${CURRENT_YEAR + Z})</span></div>
        <div class="row"><span class="label">X + Y</span><span class="value">${X + Y} years ${exposed ? '&gt;' : '≤'} Z = ${Z}</span></div>
        <div class="row"><span class="label">${exposed ? 'Exposure' : 'Margin'}</span><span class="value" style="color:${exposed ? 'var(--color-critical)' : 'var(--color-safe)'}">${exposed ? '−' : '+'}${Math.abs(margin).toFixed(0)} years</span></div>
      </div>
      <div class="mosca-bar-container" style="height:60px;" aria-label="Mosca Inequality visual">
        <div class="mosca-bar-xy" style="width:${pctXY}%;top:8px;">
          <div class="seg-x" style="width:${(pctX/pctXY)*100}%;"></div>
          <div class="seg-y" style="width:${(pctY/pctXY)*100}%;"></div>
        </div>
        <span class="mosca-bar-label" style="left:${pctXY}%;">X+Y=${X+Y}y</span>
        <div class="mosca-bar-z" style="width:${pctZ}%;top:32px;"></div>
        <span class="mosca-bar-label" style="left:${pctZ}%;top:18px;color:var(--color-crqc);">Z=${Z}y</span>
      </div>
      <div class="result-verdict ${result.riskLevel}">
        <div class="verdict-level">${riskIcon(result.riskLevel)} RISK: ${result.riskLevel.toUpperCase()}</div>
        <div class="verdict-detail">
          ${exposed
            ? `Data encrypted today stays sensitive for <strong>${X} years</strong>. <br>
               You need <strong>${Y} years</strong> to migrate. <br>
               CRQC likely in ~<strong>${Z} years</strong> (${CURRENT_YEAR + Z}). <br>
               Exposure window: <strong>${Math.abs(margin).toFixed(0)} years</strong> of potential decryption.`
            : `Margin of <strong>${margin.toFixed(0)} years</strong> before CRQC threat arrives. <br>
               Data lifetime + migration completed before expected CRQC.`}
        </div>
      </div>
      <div class="recommendation">
        <strong>Recommendation:</strong> ${esc(result.recommendation)}
      </div>`;
  }

  // Sync data type → X slider default
  dtSel.addEventListener('change', () => {
    const dt = DATA_TYPES.find(d => d.name === dtSel.value);
    if (dt) {
      xRange.value = String(Math.round((dt.typicalLifetimeMin + dt.typicalLifetimeMax) / 2));
    }
    update();
  });

  algoSel.addEventListener('change', update);
  xRange.addEventListener('input', update);
  yRange.addEventListener('input', update);
  scenSel.addEventListener('change', update);

  update();
}

// ─── Exhibit 2: Organization Risk Profile ────────────────────────────────────

function renderExhibit2(): string {
  const orgOptions = PRESET_ORGANIZATIONS.map(
    (o, i) => `<option value="${i}">${esc(o.name)}</option>`
  ).join('');

  const scenarioOptions = CRQC_SCENARIOS.map(
    (s) => `<option value="${esc(s.label)}">${esc(s.label.charAt(0).toUpperCase() + s.label.slice(1))} (~${CURRENT_YEAR + s.yearsFromNow})</option>`
  ).join('');

  return `
<div class="exhibit" id="exhibit-2">
  <div class="exhibit-header">
    <span class="exhibit-number">EXHIBIT 2</span>
    <h3>Organization Risk Profile — Multi-Asset Mosca Analysis</h3>
  </div>
  <div class="exhibit-body">
    <div class="org-controls">
      <div class="field-group">
        <label class="field-label" for="e2-org">Organization Profile</label>
        <select id="e2-org">${orgOptions}</select>
      </div>
      <div class="field-group">
        <label class="field-label" for="e2-scenario">CRQC Scenario</label>
        <select id="e2-scenario">${scenarioOptions}</select>
      </div>
    </div>
    <div id="e2-content" aria-live="polite"></div>
  </div>
</div>`;
}

function initExhibit2(): void {
  const orgSel  = document.getElementById('e2-org')      as HTMLSelectElement;
  const scenSel = document.getElementById('e2-scenario') as HTMLSelectElement;

  function update(): void {
    const orgIdx = parseInt(orgSel.value);
    const profile = PRESET_ORGANIZATIONS[orgIdx];
    const scenario = CRQC_SCENARIOS.find(s => s.label === scenSel.value) ?? CRQC_SCENARIOS[1];
    const analysis = analyzeOrganization(profile, scenario);
    const { aggregateRisk, assetAssessments, priorityOrder, topRecommendation } = analysis;

    const tableRows = assetAssessments.map(a => `
      <tr>
        <td>${esc(a.assetName)}</td>
        <td style="font-family:var(--font-mono);font-size:0.78rem">${esc(a.algorithm)}</td>
        <td style="font-family:var(--font-mono)">${a.moscaInequality.X}y</td>
        <td style="font-family:var(--font-mono)">${a.moscaInequality.Y}y</td>
        <td><span class="risk-badge ${a.riskLevel}">${riskIcon(a.riskLevel)} ${a.riskLevel.toUpperCase()}</span></td>
        <td><span class="action-label ${a.recommendedAction}">${esc(actionLabel(a.recommendedAction))}</span></td>
      </tr>`).join('');

    const priorityList = priorityOrder.map((p, i) =>
      `<div style="display:flex;align-items:center;gap:0.5rem;padding:0.35rem 0;border-bottom:1px solid var(--color-border);font-size:0.82rem;">
        <span style="font-family:var(--font-mono);color:var(--color-text-muted);min-width:1.5rem">${i + 1}.</span>
        <span class="risk-badge ${p.riskLevel}">${riskIcon(p.riskLevel)}</span>
        <span>${esc(p.name)}</span>
      </div>`
    ).join('');

    const exposedPct = aggregateRisk.percentExposed.toFixed(1);
    const safePct = (100 - aggregateRisk.percentExposed).toFixed(1);

    const contentEl = document.getElementById('e2-content') as HTMLElement;
    contentEl.innerHTML = `
      <p style="margin-bottom:1rem;font-size:0.85rem;color:var(--color-text-muted)">${esc(profile.description)} — Migration horizon: ~${profile.typicalMigrationYears} years</p>

      <div class="aggregate-panel">
        <div class="agg-stat">
          <div class="stat-value">${aggregateRisk.totalDataTB.toFixed(1)} TB</div>
          <div class="stat-label">Total Data</div>
        </div>
        <div class="agg-stat">
          <div class="stat-value" style="color:var(--color-danger)">${aggregateRisk.exposedDataTB.toFixed(1)} TB</div>
          <div class="stat-label">Exposed (${exposedPct}%)</div>
        </div>
        <div class="agg-stat">
          <div class="stat-value" style="color:var(--color-safe)">${(aggregateRisk.totalDataTB - aggregateRisk.exposedDataTB).toFixed(1)} TB</div>
          <div class="stat-label">Protected (${safePct}%)</div>
        </div>
        <div class="agg-stat">
          <div class="stat-value" style="color:var(--color-${aggregateRisk.immediateActionRequired ? 'critical' : 'safe'})">${aggregateRisk.immediateActionRequired ? '⚠ ACTION' : '✓ OK'}</div>
          <div class="stat-label">Status</div>
        </div>
      </div>

      <div class="table-scroll" role="region" aria-label="Asset risk table">
      <table class="asset-table">
        <thead><tr>
          <th scope="col">Asset</th><th scope="col">Algorithm</th><th scope="col">X (Lifetime)</th><th scope="col">Y (Migration)</th><th scope="col">Risk</th><th scope="col">Action</th>
        </tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
      </div>

      <div class="two-col-grid">
        <div>
          <div class="field-label" style="margin-bottom:0.5rem">Priority Migration Order</div>
          ${priorityList}
        </div>
        <div>
          <div class="field-label" style="margin-bottom:0.5rem">Worst Exposed Asset</div>
          <div style="font-size:0.85rem;color:var(--color-danger);font-family:var(--font-mono);padding:0.5rem 0">
            ${esc(aggregateRisk.worstAsset)}
          </div>
        </div>
      </div><!-- /.two-col-grid -->

      <div class="top-recommendation">
        <strong style="font-family:var(--font-mono);font-size:0.75rem;color:var(--color-crqc)">TOP RECOMMENDATION</strong><br>
        ${esc(topRecommendation)}
      </div>`;
  }

  orgSel.addEventListener('change', update);
  scenSel.addEventListener('change', update);
  update();
}

// ─── Exhibit 3: Exposure Curve Over Time ─────────────────────────────────────

const CURVE_COLORS: Record<string, string> = {
  aggressive:       '#ff3366',
  median:           '#ffaa00',
  pessimistic:      '#4a90e2',
  'ultra-pessimistic': '#9d4edd',
};

function renderExhibit3(): string {
  const algoOptions = ALGORITHM_SECURITY.map(
    (a) => `<option value="${esc(a.algorithm)}">${esc(a.algorithm)}</option>`
  ).join('');

  return `
<div class="exhibit" id="exhibit-3">
  <div class="exhibit-header">
    <span class="exhibit-number">EXHIBIT 3</span>
    <h3>Exposure Probability Curve — Year-by-Year Risk</h3>
  </div>
  <div class="exhibit-body">
    <div class="curve-controls">
      <div class="field-group">
        <label class="field-label" for="e3-algo">Algorithm</label>
        <select id="e3-algo">${algoOptions}</select>
      </div>
      <fieldset class="field-group" style="flex:0;border:none;padding:0;min-width:0">
        <legend class="field-label">Show Scenarios</legend>
        <div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-top:0.3rem">
          ${CRQC_SCENARIOS.map(s => `
            <label style="display:flex;align-items:center;gap:0.4rem;font-size:0.78rem;cursor:pointer;color:${CURVE_COLORS[s.label]};min-height:44px">
              <input type="checkbox" id="e3-chk-${s.label}" checked style="accent-color:${CURVE_COLORS[s.label]}">
              ${s.label.charAt(0).toUpperCase() + s.label.slice(1)}
            </label>`).join('')}
        </div>
      </fieldset>
    </div>
    <div class="svg-chart-wrap" id="e3-chart"></div>
    <div class="chart-legend" id="e3-legend"></div>
  </div>
</div>`;
}

function initExhibit3(): void {
  const algoSel = document.getElementById('e3-algo') as HTMLSelectElement;

  function update(): void {
    const algoName = algoSel.value;
    const horizonYears = 50;
    const svgW = 800, svgH = 340;
    const padL = 55, padR = 30, padT = 20, padB = 50;
    const chartW = svgW - padL - padR;
    const chartH = svgH - padT - padB;

    const yearStart = CURRENT_YEAR;

    function xPx(year: number): number {
      return padL + ((year - yearStart) / horizonYears) * chartW;
    }
    function yPx(prob: number): number {
      return padT + chartH - prob * chartH;
    }

    let svgContent = '';

    // Grid lines
    for (let y = 0; y <= 4; y++) {
      const p = y / 4;
      const yy = yPx(p);
      svgContent += `<line x1="${padL}" y1="${yy}" x2="${svgW - padR}" y2="${yy}" stroke="var(--color-border)" stroke-width="1"/>`;
      svgContent += `<text x="${padL - 6}" y="${yy + 4}" text-anchor="end" font-size="11" fill="var(--color-text-muted)">${(p * 100).toFixed(0)}%</text>`;
    }

    // Year axis ticks every 5 years
    for (let i = 0; i <= horizonYears; i += 5) {
      const xx = xPx(yearStart + i);
      svgContent += `<line x1="${xx}" y1="${padT}" x2="${xx}" y2="${padT + chartH}" stroke="var(--color-border)" stroke-width="1" stroke-dasharray="3,3"/>`;
      svgContent += `<text x="${xx}" y="${padT + chartH + 18}" text-anchor="middle" font-size="11" fill="var(--color-text-muted)">${yearStart + i}</text>`;
    }

    // Today marker
    const todayX = xPx(CURRENT_YEAR);
    svgContent += `<line x1="${todayX}" y1="${padT}" x2="${todayX}" y2="${padT + chartH}" stroke="var(--color-today)" stroke-width="2" stroke-dasharray="6,3"/>`;
    svgContent += `<text x="${todayX + 4}" y="${padT + 14}" font-size="10" fill="var(--color-today)">Today</text>`;

    // CRQC markers and curves for each scenario
    const legendItems: string[] = [];

    for (const scenario of CRQC_SCENARIOS) {
      const chk = document.getElementById(`e3-chk-${scenario.label}`) as HTMLInputElement | null;
      if (!chk?.checked) continue;

      const color = CURVE_COLORS[scenario.label];
      const curve = computeExposureCurve(algoName, scenario, horizonYears);

      const points = curve.map(pt => `${xPx(pt.year)},${yPx(pt.probDecryptable)}`).join(' ');
      svgContent += `<polyline points="${points}" fill="none" stroke="${color}" stroke-width="2.5" opacity="0.9"/>`;

      // CRQC arrival year marker
      const crqcX = xPx(CURRENT_YEAR + scenario.yearsFromNow);
      if (crqcX >= padL && crqcX <= svgW - padR) {
        svgContent += `<line x1="${crqcX}" y1="${padT}" x2="${crqcX}" y2="${padT + chartH}" stroke="${color}" stroke-width="1.5" stroke-dasharray="4,3" opacity="0.5"/>`;
        svgContent += `<text x="${crqcX + 3}" y="${padT + chartH - 8}" font-size="9" fill="${color}" opacity="0.8">${CURRENT_YEAR + scenario.yearsFromNow}</text>`;
      }

      // Annotation at end of line
      const last = curve[curve.length - 1];
      const endY = yPx(last.probDecryptable);
      svgContent += `<circle cx="${xPx(last.year)}" cy="${endY}" r="3.5" fill="${color}"/>`;

      legendItems.push(`<div class="legend-item"><div class="legend-dot" style="background:${color}"></div><span>${scenario.label.charAt(0).toUpperCase() + scenario.label.slice(1)} scenario (CRQC ~${CURRENT_YEAR + scenario.yearsFromNow})</span></div>`);
    }

    // Axis border
    svgContent += `<rect x="${padL}" y="${padT}" width="${chartW}" height="${chartH}" fill="none" stroke="var(--color-border)" stroke-width="1"/>`;

    const algInfo = ALGORITHM_SECURITY.find(a => a.algorithm === algoName);
    const titleColor = algInfo?.broken ? 'var(--color-danger)' : algInfo?.longTermSafe ? 'var(--color-safe)' : 'var(--color-amber)';
    svgContent += `<text x="${padL + chartW / 2}" y="${svgH - 4}" text-anchor="middle" font-size="12" fill="${titleColor}">${algoName} — probability that harvested ciphertext becomes decryptable</text>`;

    const algStatus = ALGORITHM_SECURITY.find(a => a.algorithm === algoName);
    const algStatusText = algStatus?.broken ? 'broken (Shor-vulnerable)' : algStatus?.longTermSafe ? 'quantum-safe' : 'partially affected';
    const chartEl = document.getElementById('e3-chart') as HTMLElement;
    chartEl.innerHTML = `<svg viewBox="0 0 ${svgW} ${svgH}" style="width:100%;display:block" role="img" aria-labelledby="e3-chart-title">
      <title id="e3-chart-title">Exposure probability curve for ${esc(algoName)} (${esc(algStatusText)}), showing probability of harvested ciphertext becoming decryptable from ${CURRENT_YEAR} to ${CURRENT_YEAR + horizonYears} across 4 CRQC scenarios</title>
      ${svgContent}</svg>`;

    const legendEl = document.getElementById('e3-legend') as HTMLElement;
    legendEl.innerHTML = legendItems.join('');
  }

  algoSel.addEventListener('change', update);
  CRQC_SCENARIOS.forEach(s => {
    document.getElementById(`e3-chk-${s.label}`)?.addEventListener('change', update);
  });
  update();
}

// ─── Exhibit 4: Cost of Delay ─────────────────────────────────────────────────

function renderExhibit4(): string {
  const orgOptions = PRESET_ORGANIZATIONS.map(
    (o, i) => `<option value="${i}">${esc(o.name)}</option>`
  ).join('');

  const scenarioOptions = CRQC_SCENARIOS.map(
    (s) => `<option value="${esc(s.label)}">${esc(s.label.charAt(0).toUpperCase() + s.label.slice(1))} (~${CURRENT_YEAR + s.yearsFromNow})</option>`
  ).join('');

  return `
<div class="exhibit" id="exhibit-4">
  <div class="exhibit-header">
    <span class="exhibit-number">EXHIBIT 4</span>
    <h3>Cost of Delay — What Does Waiting 1, 2, 5, 10 Years Look Like?</h3>
  </div>
  <div class="exhibit-body">
    <div class="delay-controls">
      <div class="field-group">
        <label class="field-label" for="e4-org">Organization</label>
        <select id="e4-org">${orgOptions}</select>
      </div>
      <div class="field-group">
        <label class="field-label" for="e4-scenario">CRQC Scenario</label>
        <select id="e4-scenario">${scenarioOptions}</select>
      </div>
    </div>
    <div id="e4-content" aria-live="polite"></div>
  </div>
</div>`;
}

function initExhibit4(): void {
  const orgSel  = document.getElementById('e4-org')      as HTMLSelectElement;
  const scenSel = document.getElementById('e4-scenario') as HTMLSelectElement;

  function update(): void {
    const orgIdx = parseInt(orgSel.value);
    const profile = PRESET_ORGANIZATIONS[orgIdx];
    const scenario = CRQC_SCENARIOS.find(s => s.label === scenSel.value) ?? CRQC_SCENARIOS[1];

    const delays = [0, 1, 2, 5, 10];

    const rows = delays.map(d => {
      const result = whatIfMigrationDelay(profile, scenario, d);
      const startYear = CURRENT_YEAR + d;
      const completeYear = CURRENT_YEAR + d + profile.typicalMigrationYears;

      const totalTB = profile.assets.reduce((s, a) => s + a.dataSizeTB, 0);

      let exposedClass = 'delay-cell-safe';
      if (result.exposedDataTB > 0) {
        const pct = result.exposedDataTB / totalTB;
        if (pct >= 0.6) exposedClass = 'delay-cell-critical';
        else if (pct >= 0.3) exposedClass = 'delay-cell-danger';
        else exposedClass = 'delay-cell-amber';
      }

      const pctExposed = totalTB > 0
        ? ((result.exposedDataTB / totalTB) * 100).toFixed(0)
        : '0';

      const crqcYear = CURRENT_YEAR + scenario.yearsFromNow;
      const missesWindow = completeYear > crqcYear;

      return `<tr>
        <td style="text-align:left;font-family:var(--font-mono)">Start ${startYear}${d === 0 ? ' (Now)' : ''}</td>
        <td style="font-family:var(--font-mono)">${completeYear}</td>
        <td class="${exposedClass}">${result.exposedAssets}</td>
        <td class="${exposedClass}">${result.exposedDataTB.toFixed(1)} TB</td>
        <td class="${exposedClass}">${pctExposed}%</td>
        <td style="color:${missesWindow ? 'var(--color-danger)' : 'var(--color-safe)'};">${missesWindow ? '⚠ MISS' : '✓ BEAT'} CRQC</td>
      </tr>`;
    });

    const contentEl = document.getElementById('e4-content') as HTMLElement;
    contentEl.innerHTML = `
      <div class="table-scroll" role="region" aria-label="Cost of delay table">
      <table class="delay-table">
        <thead><tr>
          <th scope="col">Migration Start</th>
          <th scope="col">Completes By</th>
          <th scope="col">Exposed Assets</th>
          <th scope="col">Exposed Data</th>
          <th scope="col">% Exposed</th>
          <th scope="col">vs CRQC (~${CURRENT_YEAR + scenario.yearsFromNow})</th>
        </tr></thead>
        <tbody>${rows.join('')}</tbody>
      </table>
      </div>`;
      contentEl.innerHTML += `
      <div class="delay-insight">
        <strong>Key Insight:</strong> Every year of delay increases the exposure window.
        Data encrypted <em>today</em> under classical algorithms may already be harvested
        by adversaries waiting for a CRQC. "Waiting to see" is a choice to accept exposure —
        not a neutral decision. The ${esc(scenario.label)} scenario puts CRQC arrival around
        <strong>${CURRENT_YEAR + scenario.yearsFromNow}</strong>. 
        ${profile.name}'s migration takes ~${profile.typicalMigrationYears} years —
        starting now means completing by <strong>${CURRENT_YEAR + profile.typicalMigrationYears}</strong>.
        <br><br>
        <em>Source: Mosca &amp; Piani, GRI/evolutionQ Quantum Threat Timeline 2025.
        Migration timelines from NIST SP 1800-38B and vendor analyses.</em>
      </div>`;
  }

  orgSel.addEventListener('change', update);
  scenSel.addEventListener('change', update);
  update();
}

// ─── Exhibit 5: Personal Application ─────────────────────────────────────────

function renderExhibit5(): string {
  return `
<div class="exhibit" id="exhibit-5">
  <div class="exhibit-header">
    <span class="exhibit-number">EXHIBIT 5</span>
    <h3>Personal Application — New Systems & Your Own Projects</h3>
  </div>
  <div class="exhibit-body">
    <div class="tldr-panel">
      <h4>TL;DR — Building New Systems Quantum-Safe From Day&nbsp;1</h4>
      <ul class="tldr-list">
        <li>Use <strong>ML-KEM-768</strong> for asymmetric/KEM operations (NIST FIPS 203, 2024)</li>
        <li>Use <strong>AES-256-GCM</strong> for symmetric encryption (Grover → 128-bit, still safe)</li>
        <li>Use <strong>ML-DSA-65</strong> or <strong>SLH-DSA</strong> for signatures (NIST FIPS 204/205, 2024)</li>
        <li>Design for <strong>crypto-agility</strong>: abstract all crypto behind an interface so algorithms can be swapped</li>
        <li><strong>NEVER</strong> use RSA-2048, ECDSA-P256, Ed25519, or X25519 for anything with a >5 year sensitivity horizon</li>
        <li>For messaging: use Signal Protocol V2 design (hybrid X25519+ML-KEM) or MLS protocol with PQC</li>
        <li>For firmware/IoT: use LMS or XMSS (stateful hash-based — CNSA 2.0 required for firmware signing)</li>
      </ul>
    </div>

    <h4 style="font-family:var(--font-mono);font-size:0.85rem;color:var(--color-crqc);margin-bottom:1rem;text-transform:uppercase;letter-spacing:0.06em">
      Example: PrayerWarriors — Ministry App Analysis
    </h4>

    <div class="table-scroll" role="region" aria-label="PrayerWarriors data asset recommendations">
    <table class="personal-table">
      <thead><tr>
        <th scope="col">Data Asset</th>
        <th scope="col">Sensitivity Lifetime</th>
        <th scope="col">Recommended Algorithm(s)</th>
        <th scope="col">Notes</th>
      </tr></thead>
      <tbody>
        <tr>
          <td>Prayer requests<br><small style="color:var(--color-text-muted)">(personal, often deeply private)</small></td>
          <td>Permanent (user lifetime)</td>
          <td>
            <span class="algo-recommended">AES-256-GCM</span><br>
            <span class="algo-recommended">ML-KEM-768 (KEM)</span><br>
            <small>E2E encrypted at rest</small>
          </td>
          <td>Users' spiritual and personal concerns — indefinite sensitivity. E2E encryption by design; server sees only ciphertext.</td>
        </tr>
        <tr>
          <td>User accounts<br><small style="color:var(--color-text-muted)">(email, name, identity)</small></td>
          <td>3–5 years active</td>
          <td>
            <span class="algo-recommended">AES-256-GCM</span><br>
            <span class="algo-recommended">Argon2id (passwords)</span><br>
            <small>With crypto-agile abstraction</small>
          </td>
          <td>Low-medium sensitivity. Wrap in a crypto-agile interface so you can upgrade when needed. No RSA for key wrapping.</td>
        </tr>
        <tr>
          <td>Partner messages<br><small style="color:var(--color-text-muted)">(prayer partner chat)</small></td>
          <td>Indefinite (E2E)</td>
          <td>
            <span class="algo-recommended">Signal Protocol V2</span><br>
            <span class="algo-recommended">X25519 + ML-KEM-768 hybrid</span><br>
            <span class="algo-recommended">AES-256-GCM</span>
          </td>
          <td>Use hybrid key agreement: classical X25519 for today's security + ML-KEM-768 for quantum safety. Same approach as NIST SP 1800-38B hybrid TLS recommendation.</td>
        </tr>
        <tr>
          <td>Media attachments<br><small style="color:var(--color-text-muted)">(voice prayers, photos)</small></td>
          <td>10+ years (personal albums)</td>
          <td>
            <span class="algo-recommended">AES-256-GCM</span><br>
            <small>Keys wrapped with ML-KEM-768</small>
          </td>
          <td>AES-256 symmetric is quantum-safe (Grover → 128-bit). Protect the key transport with PQ-safe KEM. This is already safe.</td>
        </tr>
        <tr>
          <td>Relationship graph<br><small style="color:var(--color-text-muted)">(who prays with whom)</small></td>
          <td>5–10 years</td>
          <td>
            <span class="algo-recommended">AES-256-GCM</span><br>
            <small>Application-level access control</small>
          </td>
          <td>Social graph can reveal community structure — warrants encryption at rest. Medium sensitivity horizon — AES-256 is sufficient.</td>
        </tr>
      </tbody>
    </table>
    </div><!-- /.table-scroll -->

    <div style="margin-bottom:1.5rem">
      <div class="field-label" style="margin-bottom:0.75rem">Mosca Check: PrayerWarriors Prayer Requests</div>
      <div id="e5-mosca-check"></div>
    </div>

    <div style="margin-bottom:1.5rem">
      <div class="field-label" style="margin-bottom:0.5rem">Related Tools in This Series</div>
      <div class="related-links">
        <a class="related-link" href="https://systemslibrarian.github.io/crypto-lab-harvest-vault/">crypto-lab-harvest-vault</a>
        <a class="related-link" href="https://systemslibrarian.github.io/crypto-lab-pq-rotation/">crypto-lab-pq-rotation</a>
        <a class="related-link" href="https://systemslibrarian.github.io/crypto-lab-pq-tls-handshake/">crypto-lab-pq-tls-handshake</a>
        <a class="related-link" href="https://systemslibrarian.github.io/crypto-lab-shor/">crypto-lab-shor</a>
        <a class="related-link" href="https://systemslibrarian.github.io/crypto-lab-grover/">crypto-lab-grover</a>
        <a class="related-link" href="https://systemslibrarian.github.io/crypto-lab-kyber-vault/">crypto-lab-kyber-vault</a>
        <a class="related-link" href="https://systemslibrarian.github.io/crypto-lab-dilithium-seal/">crypto-lab-dilithium-seal</a>
        <a class="related-link" href="https://systemslibrarian.github.io/crypto-lab-lms-xmss/">crypto-lab-lms-xmss</a>
      </div>
    </div>
  </div>
</div>`;
}

function initExhibit5(): void {
  // Show Mosca check for PrayerWarriors prayer requests using ML-KEM-768 vs RSA-2048
  const resultEl = document.getElementById('e5-mosca-check') as HTMLElement;

  const vulnerable = assessRisk('Prayer Requests (RSA-2048)', 'RSA-2048', 50, 3, CRQC_SCENARIOS[1]);
  const safe       = assessRisk('Prayer Requests (ML-KEM-768)', 'ML-KEM-768', 50, 3, CRQC_SCENARIOS[1]);

  resultEl.innerHTML = `
    <div class="two-col-grid" style="gap:1rem;margin-bottom:0">
      <div class="result-verdict ${vulnerable.riskLevel}">
        <div class="verdict-level" style="font-size:0.95rem">${riskIcon(vulnerable.riskLevel)} If using RSA-2048</div>
        <div class="verdict-detail">X=50y + Y=3y = 53y &gt; Z=${vulnerable.moscaInequality.Z}y<br>
        <strong>Exposed by ${Math.abs(vulnerable.moscaInequality.marginYears).toFixed(0)} years.</strong><br>
        User's prayer history harvested today, decrypted when CRQC arrives.</div>
      </div>
      <div class="result-verdict ${safe.riskLevel}">
        <div class="verdict-level" style="font-size:0.95rem">${riskIcon(safe.riskLevel)} If using ML-KEM-768</div>
        <div class="verdict-detail">No known quantum attack.<br>
        <strong>Risk: NONE.</strong><br>
        Quantum-safe from deployment. No migration needed.</div>
      </div>
    </div>`;
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────

function buildApp(): void {
  const app = document.getElementById('app');
  if (!app) return;

  app.innerHTML = `
<header class="app-header">
  <h1>crypto-lab-<span>harvest-timeline</span></h1>
  <button class="theme-toggle" id="theme-toggle" aria-label="Toggle color theme">☀ Light</button>
</header>

<main class="app-main">
  <div class="mosca-banner">
    <h2>The Mosca Inequality — Is Your Data Already at Risk?</h2>
    <div class="mosca-formula">
      <span class="var-x">X</span>
      <span class="op">+</span>
      <span class="var-y">Y</span>
      <span class="op">&gt;</span>
      <span class="var-z">Z</span>
      <span class="op" style="margin-left:2rem;font-size:0.9rem;color:var(--color-text-muted)">→ YOUR DATA IS ALREADY AT RISK</span>
    </div>
    <dl class="mosca-legend">
      <div><dt class="term-x">X</dt> <dd>= years data must stay secret (shelf life)</dd></div>
      <div><dt class="term-y">Y</dt> <dd>= years to complete PQC migration</dd></div>
      <div><dt class="term-z">Z</dt> <dd>= years until CRQC arrives</dd></div>
    </dl>
    <p style="font-size:0.75rem;color:var(--color-text-dim);margin-top:0.75rem">
      Citation: Michele Mosca, "Cybersecurity in an era with quantum computers: will we be ready?" IEEE Security &amp; Privacy, 2018.
      CRQC estimates: Mosca &amp; Piani, GRI/evolutionQ Quantum Threat Timeline Report, 2025
      (10-year: 28–49% · 15-year: 69% say ≥50% · 20-year: 92% say ≥50%).
    </p>
  </div>

  ${renderExhibit1()}
  ${renderExhibit2()}
  ${renderExhibit3()}
  ${renderExhibit4()}
  ${renderExhibit5()}
</main>

<footer class="app-footer">
  <p>
    Mosca Inequality: Michele Mosca, IEEE Security &amp; Privacy 2018 ·
    CRQC Estimates: GRI/evolutionQ Quantum Threat Timeline Report 2025 (Mosca &amp; Piani) ·
    NIST PQC Standards: FIPS 203/204/205 (2024) ·
    CNSA 2.0: NSA CNSS Advisory 2022 ·
    No Math.random() — all deterministic · No backends · No tracking
  </p>
  <p style="margin-top:0.5rem;font-style:italic;color:var(--color-text-dim)">
    "Whether therefore ye eat, or drink, or whatsoever ye do, do all to the glory of God." — 1 Corinthians 10:31
  </p>
</footer>`;

  initTheme();
  initExhibit1();
  initExhibit2();
  initExhibit3();
  initExhibit4();
  initExhibit5();
}

buildApp();
