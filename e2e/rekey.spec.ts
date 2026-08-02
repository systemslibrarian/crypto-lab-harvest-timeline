import { expect, test, type Page } from '@playwright/test';

/**
 * Functional gate for Exhibit 6. The exhibit's claim is a comparison, so both
 * halves are pinned here: migrate first and the archive survives a real
 * factoring attack; skip the migration and the same attack reads everything.
 * The already-captured sessions must fall in both cases — that is the point.
 */

const STATUS = '#e6-status';
const rows = (page: Page) => page.locator('#e6-content .e6-table tbody tr');

async function ready(page: Page): Promise<void> {
  await page.goto('.');
  await expect(page.locator(STATUS)).toContainText('records protected under one');
}

async function attack(page: Page): Promise<void> {
  await page.click('#e6-attack');
  await expect(page.locator(STATUS)).toContainText('CRQC complete');
}

test('the scenario stores ciphertext, not plaintext', async ({ page }) => {
  await ready(page);
  await expect(rows(page)).toHaveCount(5);
  const table = await page.locator('#e6-content').innerText();
  expect(table).toContain('RSA-KEM');
  expect(table).not.toContain('Patient EHR database — Medical records');
  await expect(page.locator('#e6-content .e6-table caption')).toContainText('e = 65537');
});

test('without migrating, the CRQC reads every record', async ({ page }) => {
  await ready(page);
  await attack(page);

  await expect(page.locator(STATUS)).toContainText('5 of 5 record(s) read');
  await expect(page.locator('.e6-read')).toHaveCount(5);
  await expect(page.locator('.e6-held')).toHaveCount(0);
  const verdict = page.locator('.e6-verdict');
  await expect(verdict).toHaveClass(/e6-bad/);
  await expect(verdict).toContainText('Records you still hold: 3 of 3 read');
  await expect(verdict).toContainText('Sessions already captured off the wire: 2 of 2 read');
  await expect(verdict).toContainText("Pollard's-rho iterations");
});

test('migrating first saves what you hold and nothing that already left', async ({ page }) => {
  await ready(page);

  const beforeBytes = await page.locator('#e6-content .e6-bytes').allInnerTexts();

  await page.click('#e6-migrate');
  await expect(page.locator(STATUS)).toContainText('re-keyed to AES-256-GCM');
  await expect(page.locator('#e6-migrate')).toBeDisabled();

  const afterBytes = await page.locator('#e6-content .e6-bytes').allInnerTexts();
  // Re-keying rewrote the three archive records and left the two captured
  // copies byte-for-byte as they were.
  expect(afterBytes.slice(0, 3)).not.toEqual(beforeBytes.slice(0, 3));
  expect(afterBytes.slice(3)).toEqual(beforeBytes.slice(3));

  await attack(page);

  await expect(page.locator(STATUS)).toContainText('2 of 5 record(s) read');
  await expect(page.locator('.e6-held')).toHaveCount(3);
  await expect(page.locator('.e6-read')).toHaveCount(2);
  await expect(rows(page).nth(0)).toContainText('No RSA wrapper left to break');
  await expect(rows(page).nth(4)).toContainText('unwrapped the RSA-KEM secret');

  const verdict = page.locator('.e6-verdict');
  await expect(verdict).toHaveClass(/e6-good/);
  await expect(verdict).toContainText('Records you still hold: 0 of 3 read');
  await expect(verdict).toContainText('Sessions already captured off the wire: 2 of 2 read');
  await expect(verdict).toContainText('nothing outside it');
});

test('switching organization rebuilds the scenario with fresh key material', async ({ page }) => {
  await ready(page);
  const firstModulus = await page.locator('#e6-content .e6-table caption').innerText();
  await page.selectOption('#e6-org', { index: 1 });
  await expect(page.locator(STATUS)).toContainText('records protected under one');
  const secondModulus = await page.locator('#e6-content .e6-table caption').innerText();
  expect(secondModulus).not.toBe(firstModulus);
  await expect(page.locator('#e6-migrate')).toBeEnabled();
});
