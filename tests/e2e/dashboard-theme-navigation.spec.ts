import { expect, test } from '@playwright/test';

test('dashboard navigation preserves light mode when opening the catalog', async ({
  page,
}) => {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];

  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });

  await page.goto('/');

  await expect(
    page.getByRole('heading', { level: 1, name: /cloud estate/i })
  ).toBeVisible();

  await page.getByRole('button', { name: /switch to light theme/i }).click();

  await expect(
    page.getByRole('button', { name: /switch to dark theme/i })
  ).toBeVisible();

  await page.getByRole('link', { name: /open catalog/i }).click();

  await expect(page).toHaveURL(/\/catalog$/);
  await expect(
    page.getByRole('heading', { level: 1, name: /^catalog$/i })
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: /switch to dark theme/i })
  ).toBeVisible();

  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
