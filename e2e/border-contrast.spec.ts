import { expect, test, type Page } from '@playwright/test';

function luminance(rgb: number[]): number {
  const linear = rgb.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrast(a: number[], b: number[]): number {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

async function controlContrast(page: Page): Promise<number> {
  const colors = await page.locator('#e1-algo').evaluate((element) => {
    const style = getComputedStyle(element);
    const parse = (value: string) => value.match(/[\d.]+/g)!.slice(0, 3).map(Number);
    return { border: parse(style.borderTopColor), background: parse(style.backgroundColor) };
  });
  return contrast(colors.border, colors.background);
}

test('load-bearing select boundary clears 3:1 in dark and light themes', async ({ page }) => {
  await page.goto('.');
  expect(await controlContrast(page)).toBeGreaterThanOrEqual(3);

  await page.locator('#cl-theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(await controlContrast(page)).toBeGreaterThanOrEqual(3);
});
