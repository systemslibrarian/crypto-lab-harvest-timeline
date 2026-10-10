import { expect, test } from '@playwright/test';

for (const width of [1280, 390, 320]) {
  test(`historical survey and strict planning boundary remain honest at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('.');
    await page.locator('#e1-algo').selectOption('RSA-2048');
    await page.locator('#e1-scenario').selectOption('median');
    const x = page.locator('#e1-x');
    const y = page.locator('#e1-y');
    await y.evaluate(el => { (el as HTMLInputElement).value = '2'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    for (const [lifetime, phrase] of [[10, /planning boundary.*no spare time/i], [11, /exposed by 1 years/i], [9, /positive margin of 1 years/i]] as const) {
      await x.evaluate((el, value) => { (el as HTMLInputElement).value = String(value); el.dispatchEvent(new Event('input', { bubbles: true })); }, lifetime);
      const bar = page.locator('#e1-result [role="img"]');
      await expect(bar).toHaveAttribute('aria-label', phrase);
      if (lifetime === 10) {
        await expect(page.locator('#e1-result')).toContainText('strict exposure is not established');
        await expect(page.locator('#e1-result')).not.toContainText('EXPOSED by 0');
        await expect(page.locator('#e1-result')).not.toContainText('safe with 0');
        await expect(page.locator('#e1-result')).not.toContainText('margin to spare');
      }
    }
    const caption = page.locator('#exhibit-3 .chart-caption');
    await expect(caption).toContainText('2034, 2039 and 2044');
    await expect(caption).toContainText('historical 2024');
    await expect(caption).toContainText('not a calibrated forecast');
    await expect(caption.locator('a')).toHaveAttribute('href', 'https://globalriskinstitute.org/publication/quantum-threat-timeline-report-2025b/');
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  });
}
