import { expect, test } from '@playwright/test';

test('the mail example identifies both negotiated hops and message encryption', async ({ page }) => {
  await page.goto('./#exhibit-5');
  const example = page.getByRole('region', { name: 'Worked example: follow an email through two relays' });
  await expect(example).toBeVisible();
  for (const point of ['hybrid TLS', 'classical TLS', 'plaintext fallback', 'deferred delivery', 'End-to-end message encryption']) {
    await expect(example).toContainText(point);
  }
  await expect(example.getByRole('link', { name: 'MTA-STS policy enforcement' })).toHaveAttribute('href', /rfc8461\.html#section-5$/);
});
