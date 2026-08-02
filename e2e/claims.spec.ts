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
      const exposureGrows = tb[tb.length - 1] > tb[0];
      const windowGrows = win[win.length - 1] > win[0];

      if (exposureGrows) {
        expect(insight, `org ${o} scen ${s}`).toContain('more data past the line');
      } else if (windowGrows) {
        // It must NOT claim the flat columns are climbing.
        expect(insight, `org ${o} scen ${s}`).toContain('already exposed at zero delay');
        expect(insight, `org ${o} scen ${s}`).not.toContain('more data past the line');
      } else {
        expect(insight, `org ${o} scen ${s}`).toContain('no row is exposed');
      }
    }
  }
});
