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

/**
 * Build <optgroup>-grouped <option> HTML for the algorithm catalog, split into
 * Broken (Shor-vulnerable) / Partial (Grover-affected) / Quantum-safe (NIST PQC).
 * The whole point of the tool is the contrast between these buckets — make it
 * visible in the picker.
 */
function buildAlgoOptgroups(): string {
  const broken  = ALGORITHM_SECURITY.filter(a => a.broken);
  const partial = ALGORITHM_SECURITY.filter(a => !a.broken && !a.longTermSafe);
  const safe    = ALGORITHM_SECURITY.filter(a => !a.broken && a.longTermSafe);

  const opts = (algs: typeof ALGORITHM_SECURITY): string =>
    algs.map(a => `<option value="${esc(a.algorithm)}">${esc(a.algorithm)}</option>`).join('');

  return [
    broken.length  ? `<optgroup label="⚠ Broken by Shor (urgent migration)">${opts(broken)}</optgroup>`  : '',
    partial.length ? `<optgroup label="~ Partially affected by Grover">${opts(partial)}</optgroup>`      : '',
    safe.length    ? `<optgroup label="✓ Quantum-safe (NIST PQC)">${opts(safe)}</optgroup>`              : '',
  ].join('');
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

// ─── exhibit nav (sticky TOC) ─────────────────────────────────────────────────

function initExhibitNav(): void {
  const nav = document.getElementById('exhibit-nav');
  if (!nav) return;
  const links = Array.from(nav.querySelectorAll<HTMLAnchorElement>('a[data-target]'));
  const sections = links
    .map(l => document.getElementById(l.dataset.target ?? ''))
    .filter((el): el is HTMLElement => el !== null);

  if (sections.length === 0 || typeof IntersectionObserver === 'undefined') return;

  function setActive(id: string): void {
    for (const l of links) {
      l.classList.toggle('active', l.dataset.target === id);
    }
  }

  // Track the section closest to the top of the viewport
  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter(e => e.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible[0]) setActive(visible[0].target.id);
    },
    { rootMargin: '-120px 0px -55% 0px', threshold: 0 },
  );

  sections.forEach(s => observer.observe(s));
  setActive(sections[0].id);
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

interface QuickScenario {
  id: string;
  label: string;
  hint: string;
  dt: string;
  algo: string;
  x: number;
  y: number;
  z: 'aggressive' | 'median' | 'pessimistic' | 'ultra-pessimistic';
}

const QUICK_SCENARIOS: QuickScenario[] = [
  { id: 'medical-rsa',    label: 'Medical · RSA-2048',    hint: 'EHR encrypted with legacy RSA', dt: 'Medical records',        algo: 'RSA-2048',          x: 30, y: 5,  z: 'median' },
  { id: 'genomic-rsa',    label: 'Genomic · RSA-4096',    hint: '100-year sensitivity horizon',  dt: 'Genetic/genomic data',   algo: 'RSA-4096',          x: 80, y: 8,  z: 'median' },
  { id: 'classified-ec',  label: 'Classified · ECDSA',    hint: 'CNSA 2.0-bound government',     dt: 'Classified government',  algo: 'ECDSA-P384 + AES-256', x: 50, y: 15, z: 'median' },
  { id: 'finance-ecdh',   label: 'Financial · ECDH',      hint: 'Banking TLS at rest',           dt: 'Financial transactions', algo: 'ECDH + AES-256',    x: 10, y: 10, z: 'median' },
  { id: 'pii-mlkem',      label: 'PII · ML-KEM-768',      hint: 'Quantum-safe baseline',         dt: 'Personal data (PII)',    algo: 'ML-KEM-768',        x: 10, y: 2,  z: 'median' },
];

function renderExhibit1(): string {
  const dataTypeOptions = DATA_TYPES.map(
    (dt) => `<option value="${esc(dt.name)}">${esc(dt.name)} (${dt.typicalLifetimeMin}–${dt.typicalLifetimeMax}y)</option>`
  ).join('');

  const algoOptions = buildAlgoOptgroups();

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
    <div class="quick-scenarios" role="group" aria-label="Quick scenarios">
      <span class="quick-label">Try:</span>
      ${QUICK_SCENARIOS.map(s => `
        <button type="button" class="chip" data-preset="${esc(s.id)}" title="${esc(s.hint)}" aria-pressed="false">
          ${esc(s.label)}
        </button>`).join('')}
    </div>
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
    <div class="exhibit-toolbar">
      <button class="toolbar-btn" id="e1-share" type="button" aria-label="Copy a shareable URL for this scenario">
        <span aria-hidden="true">🔗</span> <span class="btn-label">Copy share link</span>
      </button>
      <button class="toolbar-btn" id="e1-reset" type="button" aria-label="Reset calculator to defaults">
        <span aria-hidden="true">↺</span> Reset
      </button>
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
  const shareBtn = document.getElementById('e1-share')  as HTMLButtonElement;
  const resetBtn = document.getElementById('e1-reset')  as HTMLButtonElement;

  // ── URL state: dt, algo, x, y, z ─────────────────────────────────────────
  const params = new URLSearchParams(window.location.search);
  const findOption = (sel: HTMLSelectElement, value: string | null): boolean => {
    if (!value) return false;
    const match = Array.from(sel.options).find(
      (o) => o.value.toLowerCase() === value.toLowerCase(),
    );
    if (match) { sel.value = match.value; return true; }
    return false;
  };
  findOption(dtSel, params.get('dt'));
  findOption(algoSel, params.get('algo'));
  findOption(scenSel, params.get('z'));
  const urlX = parseInt(params.get('x') ?? '');
  if (Number.isFinite(urlX) && urlX >= 0 && urlX <= 100) xRange.value = String(urlX);
  const urlY = parseInt(params.get('y') ?? '');
  if (Number.isFinite(urlY) && urlY >= 1 && urlY <= 20) yRange.value = String(urlY);

  function syncURL(): void {
    const p = new URLSearchParams();
    p.set('dt',   dtSel.value);
    p.set('algo', algoSel.value);
    p.set('x',    xRange.value);
    p.set('y',    yRange.value);
    p.set('z',    scenSel.value);
    const next = `${window.location.pathname}?${p.toString()}${window.location.hash}`;
    window.history.replaceState(null, '', next);
  }

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
    const maxBar = Math.max(X + Y, Z, 1) * 1.1;
    const pctXY = Math.min(100, ((X + Y) / maxBar) * 100);
    const pctX  = Math.min(100, (X / maxBar) * 100);
    const pctY  = Math.min(100, (Y / maxBar) * 100);
    const pctZ  = Math.min(100, (Z / maxBar) * 100);
    const pctXYsafe = Math.max(pctXY, 0.01);

    resultEl.innerHTML = `
      <div class="mosca-vars">
        <div class="row"><span class="label">X (data lifetime)</span><span class="value" style="color:var(--color-lifetime)">${X} years</span></div>
        <div class="row"><span class="label">Y (migration time)</span><span class="value" style="color:var(--color-migration)">${Y} years</span></div>
        <div class="row"><span class="label">Z (CRQC arrival)</span><span class="value" style="color:var(--color-crqc)">${Z} years (${CURRENT_YEAR + Z})</span></div>
        <div class="row"><span class="label">X + Y</span><span class="value">${X + Y} years ${exposed ? '&gt;' : '≤'} Z = ${Z}</span></div>
        <div class="row"><span class="label">${exposed ? 'Exposure' : 'Margin'}</span><span class="value" style="color:${exposed ? 'var(--color-critical)' : 'var(--color-safe)'}">${exposed ? '−' : '+'}${Math.abs(margin).toFixed(0)} years</span></div>
      </div>
      <div class="mosca-bar-container" role="img"
           aria-label="X+Y of ${X + Y} years versus CRQC arrival in ${Z} years — ${exposed ? 'exposed by ' + Math.abs(margin).toFixed(0) + ' years' : 'safe with ' + margin.toFixed(0) + ' year margin'}">
        <div class="mosca-bar-xy" style="width:${pctXYsafe}%;">
          <div class="seg-x" style="width:${(pctX / pctXYsafe) * 100}%;" title="X = ${X} years (data lifetime)"></div>
          <div class="seg-y" style="width:${(pctY / pctXYsafe) * 100}%;" title="Y = ${Y} years (migration time)"></div>
        </div>
        <span class="mosca-bar-label label-top" style="left:${pctXYsafe}%;">X+Y = ${X + Y}y</span>
        <div class="mosca-bar-z" style="width:${pctZ}%;"></div>
        <span class="mosca-bar-label label-bottom" style="left:${Math.max(pctZ, 6)}%;">Z = ${Z}y (${CURRENT_YEAR + Z})</span>
        <div class="mosca-bar-axis"></div>
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

    syncURL();
  }

  // A preset chip stays highlighted only while every input still matches it.
  // The moment the user touches any control by hand, the inputs have diverged
  // from the preset, so clear the active chip to avoid a misleading highlight.
  function clearActiveChips(): void {
    document.querySelectorAll('#exhibit-1 .chip[data-preset]').forEach(b => {
      b.classList.remove('active');
      b.setAttribute('aria-pressed', 'false');
    });
  }

  // Sync data type → X slider default (unless URL already pinned X)
  dtSel.addEventListener('change', () => {
    clearActiveChips();
    const dt = DATA_TYPES.find(d => d.name === dtSel.value);
    if (dt) {
      xRange.value = String(Math.round((dt.typicalLifetimeMin + dt.typicalLifetimeMax) / 2));
    }
    update();
  });

  const onManualEdit = (): void => { clearActiveChips(); update(); };
  algoSel.addEventListener('change', onManualEdit);
  xRange.addEventListener('input', onManualEdit);
  yRange.addEventListener('input', onManualEdit);
  scenSel.addEventListener('change', onManualEdit);

  shareBtn.addEventListener('click', async () => {
    syncURL();
    const url = window.location.href;
    let copied = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        copied = true;
      }
    } catch { /* fall through to manual prompt */ }
    const lbl = shareBtn.querySelector('.btn-label') as HTMLElement | null;
    if (copied && lbl) {
      const orig = lbl.textContent;
      lbl.textContent = 'Copied!';
      shareBtn.classList.add('copied');
      setTimeout(() => {
        lbl.textContent = orig ?? 'Copy share link';
        shareBtn.classList.remove('copied');
      }, 1800);
    } else {
      window.prompt('Copy this URL:', url);
    }
  });

  resetBtn.addEventListener('click', () => {
    clearActiveChips();
    dtSel.selectedIndex = 0;
    algoSel.selectedIndex = 0;
    scenSel.value = 'median';
    const dt = DATA_TYPES.find(d => d.name === dtSel.value);
    xRange.value = dt ? String(Math.round((dt.typicalLifetimeMin + dt.typicalLifetimeMax) / 2)) : '30';
    yRange.value = '5';
    update();
  });

  // Quick-scenario chips: one-click presets that hydrate all five inputs
  document.querySelectorAll('#exhibit-1 .chip[data-preset]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = (btn as HTMLElement).dataset.preset;
      const preset = QUICK_SCENARIOS.find(p => p.id === id);
      if (!preset) return;
      const dtOpt = Array.from(dtSel.options).find(o => o.value === preset.dt);
      if (dtOpt) dtSel.value = dtOpt.value;
      const algoOpt = Array.from(algoSel.options).find(o => o.value === preset.algo);
      if (algoOpt) algoSel.value = algoOpt.value;
      xRange.value = String(preset.x);
      yRange.value = String(preset.y);
      scenSel.value = preset.z;
      document.querySelectorAll('#exhibit-1 .chip[data-preset]').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
      update();
    });
  });

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
    <div class="exhibit-toolbar">
      <button class="toolbar-btn" id="e2-csv" type="button" aria-label="Download organization risk analysis as CSV">
        <span aria-hidden="true">⬇</span> Export CSV
      </button>
    </div>
  </div>
</div>`;
}

function csvEscape(v: string | number): string {
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function triggerDownload(filename: string, content: string | Blob, mime?: string): void {
  const blob = content instanceof Blob ? content : new Blob([content], { type: `${mime ?? 'text/plain'};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Export an inline <svg> element as a PNG.
 * CSS variables in the SVG are resolved against the live document so the
 * exported image matches whatever theme is currently active.
 */
async function exportSVGAsPNG(svgEl: SVGSVGElement, filename: string): Promise<void> {
  const rootStyle = getComputedStyle(document.documentElement);
  const resolveVar = (name: string): string => rootStyle.getPropertyValue(name).trim() || '#000';
  const bg = '#141d2e'; // chart is a fixed dark panel (see initExhibit3)

  // Clone so we don't mutate the live SVG
  const clone = svgEl.cloneNode(true) as SVGSVGElement;
  // Remove interactive layers (crosshair, dot group, overlay) — they shouldn't appear in the export
  clone.querySelector('#e3-crosshair')?.remove();
  clone.querySelector('#e3-crosshair-dots')?.remove();
  clone.querySelector('#e3-overlay')?.remove();

  // Serialize and substitute any var(--…) refs with resolved values
  let svgStr = new XMLSerializer().serializeToString(clone);
  svgStr = svgStr.replace(/var\(\s*(--[\w-]+)\s*\)/g, (_, name: string) => resolveVar(name));
  if (!svgStr.includes('xmlns="http://www.w3.org/2000/svg"')) {
    svgStr = svgStr.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
  }

  // Read viewBox to size the canvas
  const vb = clone.getAttribute('viewBox')?.split(/\s+/).map(Number) ?? [0, 0, 800, 340];
  const [, , w, h] = vb.length === 4 ? vb : [0, 0, 800, 340];
  const scale = 2;

  const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
  const objURL = URL.createObjectURL(svgBlob);

  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('SVG image failed to load'));
      img.src = objURL;
    });
    const canvas = document.createElement('canvas');
    canvas.width = w * scale;
    canvas.height = h * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas 2d context unavailable');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    await new Promise<void>((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) triggerDownload(filename, blob);
        resolve();
      }, 'image/png');
    });
  } finally {
    URL.revokeObjectURL(objURL);
  }
}

/** Map a 0-100 risk score to a themed CSS variable for the headline number. */
function riskScoreColor(score: number): string {
  if (score >= 81) return 'var(--color-critical)';
  if (score >= 61) return 'var(--color-danger)';
  if (score >= 41) return 'var(--color-amber)';
  if (score >= 21) return 'var(--color-low)';
  return 'var(--color-safe)';
}

const RISK_LEVEL_VALUE: Record<'none' | 'low' | 'medium' | 'high' | 'critical', number> = {
  none: 0, low: 20, medium: 50, high: 80, critical: 100,
};

type E2SortKey = 'asset' | 'algo' | 'x' | 'y' | 'risk' | 'action';

function initExhibit2(): void {
  const orgSel  = document.getElementById('e2-org')      as HTMLSelectElement;
  const scenSel = document.getElementById('e2-scenario') as HTMLSelectElement;

  let sortKey: E2SortKey | null = 'risk';
  let sortDir: 'asc' | 'desc' = 'desc';

  function sortArrow(key: E2SortKey): string {
    if (sortKey !== key) return '<span class="sort-arrow inactive" aria-hidden="true">⇅</span>';
    return sortDir === 'asc'
      ? '<span class="sort-arrow" aria-hidden="true">↑</span>'
      : '<span class="sort-arrow" aria-hidden="true">↓</span>';
  }
  function ariaSort(key: E2SortKey): string {
    if (sortKey !== key) return 'none';
    return sortDir === 'asc' ? 'ascending' : 'descending';
  }

  function update(): void {
    const orgIdx = parseInt(orgSel.value);
    const profile = PRESET_ORGANIZATIONS[orgIdx];
    const scenario = CRQC_SCENARIOS.find(s => s.label === scenSel.value) ?? CRQC_SCENARIOS[1];
    const analysis = analyzeOrganization(profile, scenario);
    const { aggregateRisk, priorityOrder, topRecommendation } = analysis;
    let { assetAssessments } = analysis;

    if (sortKey) {
      const keyFn: Record<E2SortKey, (a: typeof assetAssessments[number]) => string | number> = {
        asset:  a => a.assetName.toLowerCase(),
        algo:   a => a.algorithm.toLowerCase(),
        x:      a => a.moscaInequality.X,
        y:      a => a.moscaInequality.Y,
        risk:   a => RISK_LEVEL_VALUE[a.riskLevel],
        action: a => a.recommendedAction,
      };
      const dir = sortDir === 'asc' ? 1 : -1;
      const fn = keyFn[sortKey];
      assetAssessments = [...assetAssessments].sort((a, b) => {
        const va = fn(a);
        const vb = fn(b);
        if (va < vb) return -1 * dir;
        if (va > vb) return  1 * dir;
        return 0;
      });
    }

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

    // TB-weighted 0-100 risk score: critical=100, high=80, medium=50, low=20, none=0
    let weightedSum = 0;
    let weightedTB = 0;
    for (const a of assetAssessments) {
      const asset = profile.assets.find(p => p.name === a.assetName);
      if (asset) {
        weightedSum += RISK_LEVEL_VALUE[a.riskLevel] * asset.dataSizeTB;
        weightedTB  += asset.dataSizeTB;
      }
    }
    const riskScore = weightedTB > 0 ? Math.round(weightedSum / weightedTB) : 0;
    const scoreLabel =
      riskScore >= 81 ? 'CRITICAL' :
      riskScore >= 61 ? 'HIGH'     :
      riskScore >= 41 ? 'MEDIUM'   :
      riskScore >= 21 ? 'LOW'      : 'SAFE';

    const contentEl = document.getElementById('e2-content') as HTMLElement;
    contentEl.innerHTML = `
      <p style="margin-bottom:1rem;font-size:0.85rem;color:var(--color-text-muted)">${esc(profile.description)} — Migration horizon: ~${profile.typicalMigrationYears} years</p>

      <div class="aggregate-panel">
        <div class="agg-stat risk-score-stat" title="TB-weighted Mosca risk score (0 = safe, 100 = critical)">
          <div class="stat-value" style="color:${riskScoreColor(riskScore)}">${riskScore}<span class="stat-unit">/100</span></div>
          <div class="stat-label">Risk Score · ${scoreLabel}</div>
        </div>
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
      </div>

      <div class="table-scroll" role="region" aria-label="Asset risk table">
      <table class="asset-table sortable">
        <thead><tr>
          <th scope="col" data-sort="asset"  aria-sort="${ariaSort('asset')}"  tabindex="0">Asset ${sortArrow('asset')}</th>
          <th scope="col" data-sort="algo"   aria-sort="${ariaSort('algo')}"   tabindex="0">Algorithm ${sortArrow('algo')}</th>
          <th scope="col" data-sort="x"      aria-sort="${ariaSort('x')}"      tabindex="0">X (Lifetime) ${sortArrow('x')}</th>
          <th scope="col" data-sort="y"      aria-sort="${ariaSort('y')}"      tabindex="0">Y (Migration) ${sortArrow('y')}</th>
          <th scope="col" data-sort="risk"   aria-sort="${ariaSort('risk')}"   tabindex="0">Risk ${sortArrow('risk')}</th>
          <th scope="col" data-sort="action" aria-sort="${ariaSort('action')}" tabindex="0">Action ${sortArrow('action')}</th>
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

    // Wire sortable headers (re-attached after innerHTML re-renders the table)
    contentEl.querySelectorAll<HTMLTableCellElement>('th[data-sort]').forEach((th) => {
      const handleSort = (): void => {
        const key = th.dataset.sort as E2SortKey;
        if (sortKey === key) {
          sortDir = sortDir === 'asc' ? 'desc' : 'asc';
        } else {
          sortKey = key;
          sortDir = key === 'asset' || key === 'algo' ? 'asc' : 'desc';
        }
        update();
      };
      th.addEventListener('click', handleSort);
      th.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleSort();
        }
      });
    });
  }

  orgSel.addEventListener('change', update);
  scenSel.addEventListener('change', update);

  const csvBtn = document.getElementById('e2-csv') as HTMLButtonElement;
  csvBtn.addEventListener('click', () => {
    const orgIdx = parseInt(orgSel.value);
    const profile = PRESET_ORGANIZATIONS[orgIdx];
    const scenario = CRQC_SCENARIOS.find(s => s.label === scenSel.value) ?? CRQC_SCENARIOS[1];
    const analysis = analyzeOrganization(profile, scenario);

    const header = [
      'Organization',
      'CRQC Scenario',
      'CRQC Year (Z)',
      'Asset',
      'Algorithm',
      'Data Lifetime X (yrs)',
      'Migration Time Y (yrs)',
      'X + Y',
      'Exposed (X+Y > Z)',
      'Margin Years',
      'Risk Level',
      'Action',
      'Recommendation',
    ];
    const rows = analysis.assetAssessments.map(a => [
      profile.name,
      scenario.label,
      String(CURRENT_YEAR + scenario.yearsFromNow),
      a.assetName,
      a.algorithm,
      String(a.moscaInequality.X),
      String(a.moscaInequality.Y),
      String(a.moscaInequality.X + a.moscaInequality.Y),
      a.moscaInequality.exposed ? 'YES' : 'NO',
      a.moscaInequality.marginYears.toFixed(0),
      a.riskLevel,
      a.recommendedAction,
      a.recommendation,
    ]);

    const totals = [
      '',
      '',
      '',
      'TOTAL',
      '',
      '',
      '',
      '',
      '',
      '',
      `${analysis.aggregateRisk.percentExposed.toFixed(1)}% exposed`,
      analysis.aggregateRisk.immediateActionRequired ? 'ACTION REQUIRED' : 'OK',
      `Total ${analysis.aggregateRisk.totalDataTB.toFixed(1)} TB · Exposed ${analysis.aggregateRisk.exposedDataTB.toFixed(1)} TB`,
    ];

    const csv = [header, ...rows, totals]
      .map(r => r.map(csvEscape).join(','))
      .join('\r\n');

    const slug = profile.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    triggerDownload(`hndl-risk-${slug}-${scenario.label}.csv`, csv, 'text/csv');
  });

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
  const algoOptions = buildAlgoOptgroups();

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
            <label style="display:flex;align-items:center;gap:0.4rem;font-size:0.78rem;cursor:pointer;color:var(--color-text);min-height:44px">
              <input type="checkbox" id="e3-chk-${s.label}" checked style="accent-color:${CURVE_COLORS[s.label]}">
              <span aria-hidden="true" style="width:10px;height:10px;border-radius:2px;background:${CURVE_COLORS[s.label]};flex-shrink:0"></span>
              ${s.label.charAt(0).toUpperCase() + s.label.slice(1)}
            </label>`).join('')}
        </div>
      </fieldset>
    </div>
    <div class="svg-chart-wrap" id="e3-chart"></div>
    <div class="chart-legend" id="e3-legend"></div>
    <div class="exhibit-toolbar">
      <button class="toolbar-btn" id="e3-png" type="button" aria-label="Download exposure curve as PNG image">
        <span aria-hidden="true">⬇</span> Download PNG
      </button>
    </div>
  </div>
</div>`;
}

function initExhibit3(): void {
  const algoSel = document.getElementById('e3-algo') as HTMLSelectElement;
  const chartEl = document.getElementById('e3-chart') as HTMLElement;
  const legendEl = document.getElementById('e3-legend') as HTMLElement;

  // The SVG scales to its container width, so on a phone the fixed-size internal
  // text shrinks to ~5px. In "compact" mode (narrow viewports) we enlarge fonts,
  // paddings and stroke widths and thin out the year ticks so the chart stays
  // legible. The chart re-renders when crossing the breakpoint (see resize wiring).
  const isCompact = (): boolean =>
    (typeof window !== 'undefined' ? window.innerWidth : 1024) <= 640;

  function update(): void {
    const algoName = algoSel.value;
    const horizonYears = 50;
    const compact = isCompact();
    const svgW = 800, svgH = compact ? 400 : 340;
    const padL = compact ? 66 : 55, padR = compact ? 34 : 30;
    const padT = compact ? 24 : 20, padB = compact ? 70 : 50;
    const chartW = svgW - padL - padR;
    const chartH = svgH - padT - padB;
    const fLabel = compact ? 18 : 11; // axis tick labels
    const fToday = compact ? 15 : 10;
    const fCrqc = compact ? 14 : 9;   // per-scenario CRQC year markers
    const fTitle = compact ? 17 : 12;
    const yearStep = compact ? 10 : 5;
    const wCurve = compact ? 3.5 : 2.5;
    const rEnd = compact ? 5 : 3.5;

    const yearStart = CURRENT_YEAR;

    function xPx(year: number): number {
      return padL + ((year - yearStart) / horizonYears) * chartW;
    }
    function yPx(prob: number): number {
      return padT + chartH - prob * chartH;
    }

    // The chart is a fixed dark panel in BOTH themes. The four curves use a
    // bright multi-hue palette (CURVE_COLORS); on a light background the amber
    // and blue lines would fall below the WCAG 1.4.11 3:1 non-text-contrast
    // floor. Pinning the panel + its axes/labels to fixed colors keeps the data
    // viz legible regardless of the page theme. (The CSS sets the same panel bg.)
    const C_AXIS = '#2a3a5c';
    const C_LABEL = '#8094b4';
    const C_TODAY = '#00d4ff';
    const C_TEXT = '#e2e8f0';
    const C_PANEL = '#141d2e';

    let svgContent = '';

    // Grid lines
    for (let y = 0; y <= 4; y++) {
      const p = y / 4;
      const yy = yPx(p);
      svgContent += `<line x1="${padL}" y1="${yy}" x2="${svgW - padR}" y2="${yy}" stroke="${C_AXIS}" stroke-width="1"/>`;
      svgContent += `<text x="${padL - 6}" y="${yy + 4}" text-anchor="end" font-size="${fLabel}" fill="${C_LABEL}">${(p * 100).toFixed(0)}%</text>`;
    }

    // Year axis ticks (every 5 years; every 10 on compact to avoid crowding)
    for (let i = 0; i <= horizonYears; i += yearStep) {
      const xx = xPx(yearStart + i);
      svgContent += `<line x1="${xx}" y1="${padT}" x2="${xx}" y2="${padT + chartH}" stroke="${C_AXIS}" stroke-width="1" stroke-dasharray="3,3"/>`;
      svgContent += `<text x="${xx}" y="${padT + chartH + fLabel + 6}" text-anchor="middle" font-size="${fLabel}" fill="${C_LABEL}">${yearStart + i}</text>`;
    }

    // Today marker
    const todayX = xPx(CURRENT_YEAR);
    svgContent += `<line x1="${todayX}" y1="${padT}" x2="${todayX}" y2="${padT + chartH}" stroke="${C_TODAY}" stroke-width="2" stroke-dasharray="6,3"/>`;
    svgContent += `<text x="${todayX + 4}" y="${padT + fToday + 4}" font-size="${fToday}" fill="${C_TODAY}">Today</text>`;

    // CRQC markers and curves for each scenario — collect active curves for tooltip
    const legendItems: string[] = [];
    const activeCurves: Array<{
      label: string;
      pretty: string;
      color: string;
      crqcYear: number;
      data: Array<{ year: number; probDecryptable: number }>;
    }> = [];

    for (const scenario of CRQC_SCENARIOS) {
      const chk = document.getElementById(`e3-chk-${scenario.label}`) as HTMLInputElement | null;
      if (!chk?.checked) continue;

      const color = CURVE_COLORS[scenario.label];
      const curve = computeExposureCurve(algoName, scenario, horizonYears);

      activeCurves.push({
        label: scenario.label,
        pretty: scenario.label.charAt(0).toUpperCase() + scenario.label.slice(1),
        color,
        crqcYear: CURRENT_YEAR + scenario.yearsFromNow,
        data: curve,
      });

      const points = curve.map(pt => `${xPx(pt.year)},${yPx(pt.probDecryptable)}`).join(' ');
      svgContent += `<polyline points="${points}" fill="none" stroke="${color}" stroke-width="${wCurve}" opacity="0.9"/>`;

      // CRQC arrival year marker
      const crqcX = xPx(CURRENT_YEAR + scenario.yearsFromNow);
      if (crqcX >= padL && crqcX <= svgW - padR) {
        svgContent += `<line x1="${crqcX}" y1="${padT}" x2="${crqcX}" y2="${padT + chartH}" stroke="${color}" stroke-width="1.5" stroke-dasharray="4,3" opacity="0.5"/>`;
        svgContent += `<text x="${crqcX + 3}" y="${padT + chartH - 8}" font-size="${fCrqc}" fill="${color}" opacity="0.8">${CURRENT_YEAR + scenario.yearsFromNow}</text>`;
      }

      // Annotation at end of line
      const last = curve[curve.length - 1];
      const endY = yPx(last.probDecryptable);
      svgContent += `<circle cx="${xPx(last.year)}" cy="${endY}" r="${rEnd}" fill="${color}"/>`;

      legendItems.push(`<div class="legend-item"><div class="legend-dot" style="background:${color}"></div><span>${scenario.label.charAt(0).toUpperCase() + scenario.label.slice(1)} scenario (CRQC ~${CURRENT_YEAR + scenario.yearsFromNow})</span></div>`);
    }

    // Axis border
    svgContent += `<rect x="${padL}" y="${padT}" width="${chartW}" height="${chartH}" fill="none" stroke="${C_AXIS}" stroke-width="1"/>`;

    const algInfo = ALGORITHM_SECURITY.find(a => a.algorithm === algoName);
    // Fixed (bright) status hues to match the always-dark panel.
    const titleColor = algInfo?.broken ? '#ff6a8e' : algInfo?.longTermSafe ? '#00ff88' : '#ffaa00';
    const titleText = compact
      ? `${algoName} — decryptability over time`
      : `${algoName} — probability that harvested ciphertext becomes decryptable`;
    svgContent += `<text x="${padL + chartW / 2}" y="${svgH - 5}" text-anchor="middle" font-size="${fTitle}" fill="${titleColor}">${titleText}</text>`;

    // Crosshair (hidden by default) + dot group + transparent overlay for pointer events
    svgContent += `<line id="e3-crosshair" x1="0" y1="${padT}" x2="0" y2="${padT + chartH}" stroke="${C_TEXT}" stroke-width="1" stroke-dasharray="3,3" opacity="0" pointer-events="none"/>`;
    svgContent += `<g id="e3-crosshair-dots" opacity="0" pointer-events="none"></g>`;
    svgContent += `<rect id="e3-overlay" x="${padL}" y="${padT}" width="${chartW}" height="${chartH}" fill="transparent" style="cursor:crosshair"/>`;

    const algStatusText = algInfo?.broken ? 'broken (Shor-vulnerable)' : algInfo?.longTermSafe ? 'quantum-safe' : 'partially affected';
    chartEl.innerHTML = `<svg viewBox="0 0 ${svgW} ${svgH}" style="width:100%;display:block" role="img" aria-labelledby="e3-chart-title">
      <title id="e3-chart-title">Exposure probability curve for ${esc(algoName)} (${esc(algStatusText)}), showing probability of harvested ciphertext becoming decryptable from ${CURRENT_YEAR} to ${CURRENT_YEAR + horizonYears} across 4 CRQC scenarios</title>
      ${svgContent}</svg><div class="chart-tooltip" id="e3-tooltip" role="tooltip" aria-hidden="true"></div>`;

    legendEl.innerHTML = legendItems.join('');

    // ── Hover/touch crosshair wiring ─────────────────────────────────────────
    const svg = chartEl.querySelector('svg') as SVGSVGElement;
    const overlay = svg.querySelector('#e3-overlay') as SVGRectElement;
    const crosshair = svg.querySelector('#e3-crosshair') as SVGLineElement;
    const dotGroup = svg.querySelector('#e3-crosshair-dots') as SVGGElement;
    const tooltip = chartEl.querySelector('#e3-tooltip') as HTMLElement;

    function showAt(clientX: number, clientY: number): void {
      const rect = svg.getBoundingClientRect();
      if (rect.width === 0) return;
      const scaleX = svgW / rect.width;
      const svgX = (clientX - rect.left) * scaleX;
      const clampedX = Math.max(padL, Math.min(svgW - padR, svgX));
      const yearF = yearStart + ((clampedX - padL) / chartW) * horizonYears;
      const year = Math.max(yearStart, Math.min(yearStart + horizonYears, Math.round(yearF)));
      const xx = xPx(year);

      crosshair.setAttribute('x1', String(xx));
      crosshair.setAttribute('x2', String(xx));
      crosshair.setAttribute('opacity', '0.55');

      let dotsHTML = '';
      const rows: string[] = [];
      for (const c of activeCurves) {
        const pt = c.data[year - yearStart];
        if (!pt) continue;
        const cy = yPx(pt.probDecryptable);
        dotsHTML += `<circle cx="${xx}" cy="${cy}" r="4.5" fill="${c.color}" stroke="${C_PANEL}" stroke-width="1.5"/>`;
        const pct = (pt.probDecryptable * 100).toFixed(1);
        const crqcTag = year >= c.crqcYear ? ' <span style="color:var(--color-danger)">⚠</span>' : '';
        rows.push(`<div class="tt-row"><div class="tt-dot" style="background:${c.color}"></div><span class="tt-label">${c.pretty}</span><span class="tt-value">${pct}%${crqcTag}</span></div>`);
      }
      dotGroup.innerHTML = dotsHTML;
      dotGroup.setAttribute('opacity', activeCurves.length > 0 ? '1' : '0');

      const yearsFromNow = year - CURRENT_YEAR;
      tooltip.innerHTML = `<div class="tt-year">${year} <span style="color:var(--color-text-muted);font-weight:400">(${yearsFromNow >= 0 ? '+' : ''}${yearsFromNow}y)</span></div>${rows.join('') || '<div class="tt-row" style="color:var(--color-text-muted)">No scenarios selected</div>'}`;
      tooltip.classList.add('visible');
      tooltip.setAttribute('aria-hidden', 'false');

      // Position tooltip near pointer, clamp inside chart wrap
      const wrapRect = chartEl.getBoundingClientRect();
      const tw = tooltip.offsetWidth;
      const th = tooltip.offsetHeight;
      let tx = clientX - wrapRect.left + 14;
      let ty = clientY - wrapRect.top + 14;
      if (tx + tw > wrapRect.width - 6) tx = clientX - wrapRect.left - tw - 14;
      if (ty + th > wrapRect.height - 6) ty = wrapRect.height - th - 6;
      tooltip.style.left = `${Math.max(6, tx)}px`;
      tooltip.style.top = `${Math.max(6, ty)}px`;
    }

    function hide(): void {
      crosshair.setAttribute('opacity', '0');
      dotGroup.setAttribute('opacity', '0');
      tooltip.classList.remove('visible');
      tooltip.setAttribute('aria-hidden', 'true');
    }

    overlay.addEventListener('pointermove', (e) => showAt(e.clientX, e.clientY));
    overlay.addEventListener('pointerdown',  (e) => showAt(e.clientX, e.clientY));
    overlay.addEventListener('pointerleave', hide);
    overlay.addEventListener('pointercancel', hide);
  }

  algoSel.addEventListener('change', update);
  CRQC_SCENARIOS.forEach(s => {
    document.getElementById(`e3-chk-${s.label}`)?.addEventListener('change', update);
  });

  // Re-render only when the viewport crosses the compact breakpoint, so the
  // chart's font/padding sizing switches without re-rendering on every pixel.
  let lastCompact = isCompact();
  window.addEventListener('resize', () => {
    const c = isCompact();
    if (c !== lastCompact) { lastCompact = c; update(); }
  });

  document.getElementById('e3-png')?.addEventListener('click', async () => {
    const svg = chartEl.querySelector('svg');
    if (!svg) return;
    const algoSlug = algoSel.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    await exportSVGAsPNG(svg, `hndl-exposure-curve-${algoSlug}.png`);
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

type E4SortKey = 'start' | 'complete' | 'assets' | 'tb' | 'pct' | 'miss';

function initExhibit4(): void {
  const orgSel  = document.getElementById('e4-org')      as HTMLSelectElement;
  const scenSel = document.getElementById('e4-scenario') as HTMLSelectElement;

  let sortKey: E4SortKey | null = null;
  let sortDir: 'asc' | 'desc' = 'asc';

  function sortArrow(key: E4SortKey): string {
    if (sortKey !== key) return '<span class="sort-arrow inactive" aria-hidden="true">⇅</span>';
    return sortDir === 'asc'
      ? '<span class="sort-arrow" aria-hidden="true">↑</span>'
      : '<span class="sort-arrow" aria-hidden="true">↓</span>';
  }
  function ariaSort(key: E4SortKey): string {
    if (sortKey !== key) return 'none';
    return sortDir === 'asc' ? 'ascending' : 'descending';
  }

  function update(): void {
    const orgIdx = parseInt(orgSel.value);
    const profile = PRESET_ORGANIZATIONS[orgIdx];
    const scenario = CRQC_SCENARIOS.find(s => s.label === scenSel.value) ?? CRQC_SCENARIOS[1];

    const delays = [0, 1, 2, 5, 10];

    interface DelayRow {
      delay: number;
      startYear: number;
      completeYear: number;
      exposedAssets: number;
      exposedDataTB: number;
      pctExposed: number;
      missesWindow: boolean;
    }
    const totalTB = profile.assets.reduce((s, a) => s + a.dataSizeTB, 0);
    const crqcYear = CURRENT_YEAR + scenario.yearsFromNow;

    let dataRows: DelayRow[] = delays.map(d => {
      const result = whatIfMigrationDelay(profile, scenario, d);
      const completeYear = CURRENT_YEAR + d + profile.typicalMigrationYears;
      return {
        delay: d,
        startYear: CURRENT_YEAR + d,
        completeYear,
        exposedAssets: result.exposedAssets,
        exposedDataTB: result.exposedDataTB,
        pctExposed: totalTB > 0 ? (result.exposedDataTB / totalTB) * 100 : 0,
        missesWindow: completeYear > crqcYear,
      };
    });

    if (sortKey) {
      const keyFn: Record<E4SortKey, (r: DelayRow) => number> = {
        start:    r => r.startYear,
        complete: r => r.completeYear,
        assets:   r => r.exposedAssets,
        tb:       r => r.exposedDataTB,
        pct:      r => r.pctExposed,
        miss:     r => r.missesWindow ? 1 : 0,
      };
      const dir = sortDir === 'asc' ? 1 : -1;
      const fn = keyFn[sortKey];
      dataRows = [...dataRows].sort((a, b) => (fn(a) - fn(b)) * dir);
    }

    const rows = dataRows.map(r => {
      let exposedClass = 'delay-cell-safe';
      if (r.exposedDataTB > 0) {
        const pct = r.exposedDataTB / totalTB;
        if (pct >= 0.6) exposedClass = 'delay-cell-critical';
        else if (pct >= 0.3) exposedClass = 'delay-cell-danger';
        else exposedClass = 'delay-cell-amber';
      }
      return `<tr>
        <td style="text-align:left;font-family:var(--font-mono)">Start ${r.startYear}${r.delay === 0 ? ' (Now)' : ''}</td>
        <td style="font-family:var(--font-mono)">${r.completeYear}</td>
        <td class="${exposedClass}">${r.exposedAssets}</td>
        <td class="${exposedClass}">${r.exposedDataTB.toFixed(1)} TB</td>
        <td class="${exposedClass}">${r.pctExposed.toFixed(0)}%</td>
        <td style="color:${r.missesWindow ? 'var(--color-danger)' : 'var(--color-safe)'};">${r.missesWindow ? '⚠ MISS' : '✓ BEAT'} CRQC</td>
      </tr>`;
    });

    const contentEl = document.getElementById('e4-content') as HTMLElement;
    contentEl.innerHTML = `
      <div class="table-scroll" role="region" aria-label="Cost of delay table">
      <table class="delay-table sortable">
        <thead><tr>
          <th scope="col" data-sort="start"    aria-sort="${ariaSort('start')}"    tabindex="0">Migration Start ${sortArrow('start')}</th>
          <th scope="col" data-sort="complete" aria-sort="${ariaSort('complete')}" tabindex="0">Completes By ${sortArrow('complete')}</th>
          <th scope="col" data-sort="assets"   aria-sort="${ariaSort('assets')}"   tabindex="0">Exposed Assets ${sortArrow('assets')}</th>
          <th scope="col" data-sort="tb"       aria-sort="${ariaSort('tb')}"       tabindex="0">Exposed Data ${sortArrow('tb')}</th>
          <th scope="col" data-sort="pct"      aria-sort="${ariaSort('pct')}"      tabindex="0">% Exposed ${sortArrow('pct')}</th>
          <th scope="col" data-sort="miss"     aria-sort="${ariaSort('miss')}"     tabindex="0">vs CRQC (~${CURRENT_YEAR + scenario.yearsFromNow}) ${sortArrow('miss')}</th>
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

    contentEl.querySelectorAll<HTMLTableCellElement>('th[data-sort]').forEach((th) => {
      const handleSort = (): void => {
        const key = th.dataset.sort as E4SortKey;
        if (sortKey === key) {
          sortDir = sortDir === 'asc' ? 'desc' : 'asc';
        } else {
          sortKey = key;
          sortDir = 'asc';
        }
        update();
      };
      th.addEventListener('click', handleSort);
      th.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleSort();
        }
      });
    });
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
<header class="app-header" role="banner">
  <h1>crypto-lab-<span>harvest-timeline</span></h1>
  <div class="header-actions">
    <button class="theme-toggle" id="print-btn" type="button" aria-label="Print this report">🖶 Print</button>
    <button class="theme-toggle" id="theme-toggle" aria-label="Toggle color theme">☀ Light</button>
  </div>
</header>

<nav class="exhibit-nav" aria-label="Exhibits" id="exhibit-nav">
  <a href="#exhibit-1" data-target="exhibit-1"><span class="nav-num">1</span> Calculator</a>
  <a href="#exhibit-2" data-target="exhibit-2"><span class="nav-num">2</span> Org Profile</a>
  <a href="#exhibit-3" data-target="exhibit-3"><span class="nav-num">3</span> Exposure Curve</a>
  <a href="#exhibit-4" data-target="exhibit-4"><span class="nav-num">4</span> Cost of Delay</a>
  <a href="#exhibit-5" data-target="exhibit-5"><span class="nav-num">5</span> Personal</a>
</nav>

<main class="app-main" id="main-content" role="main">
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

  <details class="sources-panel">
    <summary>Sources &amp; Methodology</summary>
    <div class="sources-grid">
      <div>
        <h4>Foundational Citations</h4>
        <ul>
          <li><strong>Mosca, M. (2018).</strong> "Cybersecurity in an era with quantum computers: will we be ready?" <em>IEEE Security &amp; Privacy</em> 16(5), 38–41.</li>
          <li><strong>Mosca, M. &amp; Piani, M. (2025).</strong> <em>Quantum Threat Timeline Report 2025.</em> Global Risk Institute / evolutionQ.</li>
          <li><strong>Brassard, Høyer &amp; Tapp (1997).</strong> Quantum cryptanalysis of hash functions — collision resistance.</li>
          <li><strong>Gidney (2025).</strong> Sub-million-qubit RSA-2048 factoring estimate.</li>
        </ul>
      </div>
      <div>
        <h4>NIST PQC Standards (2024)</h4>
        <ul>
          <li><strong>FIPS 203</strong> — ML-KEM (Module-Lattice KEM).</li>
          <li><strong>FIPS 204</strong> — ML-DSA (Module-Lattice Signature).</li>
          <li><strong>FIPS 205</strong> — SLH-DSA (Hash-Based Signature).</li>
          <li><strong>SP 1800-38B</strong> — Migrating to Post-Quantum Cryptography.</li>
        </ul>
      </div>
      <div>
        <h4>Government Guidance</h4>
        <ul>
          <li><strong>NSA CNSA 2.0 (2022)</strong> — Commercial National Security Algorithm Suite 2.0.</li>
          <li><strong>IETF RFC 8391</strong> — XMSS hash-based signatures.</li>
          <li><strong>NIST SP 800-208</strong> — Stateful hash-based signature schemes.</li>
        </ul>
      </div>
      <div>
        <h4>Methodology Notes</h4>
        <ul>
          <li>The Mosca Inequality is a <em>planning</em> framework, not a compliance tool — satisfying it does not guarantee security.</li>
          <li>Probability curves interpolate between GRI 2025 anchors (10y / 15y / 20y / 30y) with a smoothstep S-curve.</li>
          <li>Quantum-safe algorithms are pinned to 0% exposure regardless of Mosca math.</li>
          <li>AES-128 is treated as effectively broken for long-lived data (64-bit post-Grover).</li>
          <li>Reference year is hardcoded to <strong>2026</strong>, anchored to the GRI 2025 report; scenario offsets do not silently drift.</li>
        </ul>
      </div>
    </div>
  </details>

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
  document.getElementById('print-btn')?.addEventListener('click', () => window.print());
  initExhibitNav();
  initExhibit1();
  initExhibit2();
  initExhibit3();
  initExhibit4();
  initExhibit5();
}

buildApp();
