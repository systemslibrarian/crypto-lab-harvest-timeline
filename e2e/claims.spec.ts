import { expect, test } from '@playwright/test';

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
