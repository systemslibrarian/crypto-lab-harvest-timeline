import { expect, test } from '@playwright/test';

test('HNDL choices and profiles show confidentiality risk, not signature decryption', async ({ page }) => {
  await page.goto('.');
  const note = page.locator('#risk-boundary');
  await expect(note).toContainText('forge future signatures');
  await expect(note).toContainText('cannot decrypt stored data');
  await expect(note).toContainText('final report (27 October 2026)');
  await expect(note.locator('a')).toHaveAttribute('href', 'https://csrc.nist.gov/pubs/ir/8547/final');
  for (const picker of ['#e1-algo', '#e3-algo']) {
    const values = await page.locator(`${picker} option`).evaluateAll(options => options.map(o => (o as HTMLOptionElement).value));
    expect(values).toContain('ECDH + AES-256');
    for (const signature of ['ECDSA-P256', 'Ed25519', 'TLS-ECDSA', 'ML-DSA-65', 'SHA-256']) {
      expect(values, `${picker} must not offer ${signature} for decryption`).not.toContain(signature);
    }
  }
  await page.locator('#e1-algo').selectOption('ECDH + AES-256');
  await expect(page.locator('#e1-result')).toContainText('potential decryption');
  await page.locator('#e1-algo').selectOption('AES-128');
  await expect(page.locator('#e1-result')).toContainText('RISK: NONE');
  await expect(page.locator('#e1-result')).toContainText('NIST currently permits AES-128');
  await expect(page.locator('#e1-result')).not.toContainText('potential decryption');
  await page.locator('#e3-algo').selectOption('AES-128');
  await expect(page.locator('#e3-chart-title')).toContainText('not an AES decryption probability');
  await expect(page.locator('.chart-caption a[href="https://csrc.nist.gov/Projects/post-quantum-cryptography/faqs"]')).toBeVisible();
  await page.locator('#e2-org').selectOption({ index: 3 });
  await expect(page.locator('#e2-content table')).not.toContainText('ECDSA-P256 + AES-256');
  await expect(page.locator('#e2-content table')).not.toContainText('Ed25519 + AES-256');
});

/**
 * Exhibit 4's headline used to read "Every year of delay increases the exposure
 * window" over a table whose exposure columns were flat across all five delay
 * rows for 4 of 5 organization presets. The claim must now agree with the rows
 * rendered beneath it, for every preset and scenario.
 */
test('the cost-of-delay headline agrees with its own table', async ({ page }) => {
  await page.goto('.');

  const orgSel = page.locator('#e4-org');
  const scenSel = page.locator('#e4-scenario');
  const orgCount = await orgSel.locator('option').count();
  const scenCount = await scenSel.locator('option').count();

  for (let o = 0; o < orgCount; o++) {
    for (let s = 0; s < scenCount; s++) {
      await orgSel.selectOption({ index: o });
      await scenSel.selectOption({ index: s });

      const rows = page.locator('#e4-content .delay-table tbody tr');
      await expect(rows.first()).toBeVisible();

      // Column 4 is exposed TB, column 6 is the window past CRQC.
      const tb: number[] = [];
      const win: number[] = [];
      for (let r = 0; r < (await rows.count()); r++) {
        const cells = rows.nth(r).locator('td');
        tb.push(parseFloat(((await cells.nth(3).textContent()) ?? '0').replace(/[^\d.]/g, '')));
        win.push(parseFloat(((await cells.nth(5).textContent()) ?? '0').replace(/[^\d.]/g, '')));
      }

      const insight = (await page.locator('#e4-content .delay-insight').textContent()) ?? '';
      const where = `org ${o} scen ${s}`;

      // Assert the CLAIM against the table, not against a recomputation of the
      // branch condition. Mirroring the source's own if/else here is what let
      // the "no row is exposed" branch fire over a fully-exposed table: the
      // test agreed with the bug because it asked the same question.
      const exposureGrows = tb[tb.length - 1] > tb[0];
      const windowGrows = win[win.length - 1] > win[0];
      const anyExposure = tb.some((v) => v > 0);

      if (/no row is exposed/.test(insight)) {
        expect(tb.every((v) => v === 0), `${where}: claimed nothing exposed, table shows ${tb.join('/')} TB`).toBe(true);
        expect(win.every((v) => v === 0), `${where}: claimed no window opens, table shows ${win.join('/')} yr`).toBe(true);
      }
      if (/more data past the line/.test(insight)) {
        expect(exposureGrows, `${where}: claimed exposure rises, table is ${tb.join('/')} TB`).toBe(true);
      }
      if (/already exposed at zero delay/.test(insight)) {
        expect(anyExposure, `${where}: claimed already exposed, table shows no exposure`).toBe(true);
        expect(windowGrows, `${where}: claimed the window grows, table is ${win.join('/')} yr`).toBe(true);
      }
      if (/exposure is already at its maximum/.test(insight)) {
        expect(anyExposure, `${where}: claimed maximal exposure, table shows none`).toBe(true);
        expect(exposureGrows, `${where}: claimed exposure is flat, but it rises`).toBe(false);
      }

      // And every combination must say SOMETHING that matches the table.
      const claims = [
        /no row is exposed/,
        /more data past the line/,
        /already exposed at zero delay/,
        /exposure is already at its maximum/,
      ].filter((re) => re.test(insight));
      expect(claims.length, `${where}: headline made ${claims.length} recognizable claims`).toBe(1);
    }
  }
});

/**
 * Exhibit 5 used to recommend a "Signal Protocol V2" with a hybrid
 * X25519+ML-KEM design. No Signal publication describes such a protocol.
 * Signal's published post-quantum work is PQXDH for the initial key agreement
 * and the Triple Ratchet, which mixes the Sparse Post Quantum Ratchet (SPQR)
 * into the Double Ratchet. Each name below must stay tied to the dated source
 * it came from. Sources read 15 November 2026:
 *   - https://signal.org/docs/specifications/pqxdh/ — "The PQXDH Key Agreement
 *     Protocol", Revision 3, 2023-05-24, Last Updated: 2024-01-23.
 *   - https://signal.org/blog/pqxdh/ — "Quantum Resistance and the Signal
 *     Protocol", 19 Sep 2023, the PQXDH deployment announcement (X25519 with
 *     CRYSTALS-Kyber).
 *   - https://signal.org/blog/spqr/ — "Signal Protocol and Post-Quantum
 *     Ratchets", 02 Oct 2025, introducing SPQR and the Triple Ratchet.
 */
test('the messaging recommendation names protocols Signal has published, with their dates', async ({ page }) => {
  await page.goto('.');

  // A protocol that does not exist must not come back anywhere on the page.
  const whole = (await page.locator('body').textContent()) ?? '';
  expect(whole, 'no Signal publication describes a "Signal Protocol V2"').not.toContain('Signal Protocol V2');

  const exhibit = page.locator('#exhibit-5');
  const text = ((await exhibit.textContent()) ?? '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();

  // The real protocol names, in Signal's own spelling.
  expect(text).toContain('PQXDH');
  expect(text).toContain('Triple Ratchet');
  expect(text).toContain('Sparse Post Quantum Ratchet');

  // Every replacement claim carries the date of the source it rests on.
  expect(text, 'PQXDH spec revision and last-updated dates').toContain('Revision 3, 2023-05-24, last updated 2024-01-23');
  expect(text, 'PQXDH deployment announcement date').toContain('19 September 2023');
  expect(text, 'SPQR / Triple Ratchet announcement date').toContain('2 October 2025');

  // ...and links to that source, not to a protocol page that does not exist.
  for (const href of [
    'https://signal.org/docs/specifications/pqxdh/',
    'https://signal.org/blog/pqxdh/',
    'https://signal.org/blog/spqr/',
  ]) {
    await expect(exhibit.locator(`a[href="${href}"]`), `${href} must be cited`).not.toHaveCount(0);
  }
});
