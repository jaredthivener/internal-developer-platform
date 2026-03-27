import { expect, test } from '@playwright/test';

function trackRuntimeErrors(page: import('@playwright/test').Page) {
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

  return { pageErrors, consoleErrors };
}

test('storage workflow supports offline provisioning through the catalog path', async ({
  page,
}) => {
  const { pageErrors, consoleErrors } = trackRuntimeErrors(page);

  await page.goto('/catalog/azure-storage');

  await expect(
    page.getByRole('heading', {
      level: 1,
      name: /azure storage account/i,
    })
  ).toBeVisible();

  await expect(page.getByLabel(/resource group/i)).toContainText(
    'idp-crossplane-smoke'
  );

  await page.getByLabel(/storage account name/i).fill('e2estoragealpha01');
  await page.getByRole('button', { name: /create storage account/i }).click();

  await expect(
    page.getByText(/successfully submitted storage account: e2estoragealpha01/i)
  ).toBeVisible();

  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});

test('resources page opens the managed resource details path', async ({
  page,
}) => {
  const { pageErrors, consoleErrors } = trackRuntimeErrors(page);

  await page.goto('/resources');

  await expect(
    page.getByRole('heading', { level: 1, name: /resources/i })
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 2, name: /devstorealpha01/i })
  ).toBeVisible();

  await page
    .getByRole('link', { name: /view details for devstorealpha01/i })
    .click();

  await expect(page).toHaveURL(/\/resources\/devstorealpha01$/);
  await expect(
    page.getByRole('heading', { level: 1, name: /resource details/i })
  ).toBeVisible();
  await expect(page.getByText(/^Azure Storage Account$/i)).toBeVisible();
  await expect(
    page.getByRole('button', { name: /refresh status/i })
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: /delete resource/i })
  ).toBeVisible();

  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
