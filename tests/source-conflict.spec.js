const { test, expect } = require('@playwright/test');
const { waitForApp, goToScreen } = require('./helpers');

test.describe('Source conflict workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitForApp(page);
    await goToScreen(page, 'home');
  });

  test('blocks vague prompts before creating a draft', async ({ page }) => {
    await page.locator('textarea').fill('make a deck please');
    await page.getByRole('button', { name: /Generate deck/i }).click();

    await expect(page.getByRole('heading', { name: 'Need more source material' })).toBeVisible();
    await expect(page.getByText(/needs a concrete brief, usable source document, or pasted notes/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Upload source document/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Proceed with available info/i })).toBeVisible();
    await expect(page.locator('body')).not.toContainText('Still generating in Firebase');
  });

  test('blocks short title-style prompts before model generation', async ({ page }) => {
    await page.locator('textarea').fill('Data Engineering Jobs');
    await page.getByRole('button', { name: /Generate deck/i }).click();

    await expect(page.getByRole('heading', { name: 'Need more source material' })).toBeVisible();
    await expect(page.getByText(/Facts, metrics, decisions, examples, or source notes/i)).toBeVisible();
    await expect(page.locator('body')).not.toContainText('Generated slides were not returned');
  });

  test('classifies uploaded files with no parsed text as unusable source content', async ({ page }) => {
    await page.locator('#hsAFile').setInputFiles({
      name: 'image-only-scan.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 image only scan'),
    });
    await page.getByRole('button', { name: /Generate deck/i }).click();

    await expect(page.getByRole('heading', { name: 'Could not read usable source content' })).toBeVisible();
    await expect(page.getByText(/text-based PDF, DOCX, PPTX, or TXT/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Upload replacement document/i })).toBeVisible();
  });

  test('keeps the original brief when returning to edit', async ({ page }) => {
    const brief = 'make a deck please';
    await page.locator('textarea').fill(brief);
    await page.getByRole('button', { name: /Generate deck/i }).click();

    await expect(page.getByRole('heading', { name: 'Need more source material' })).toBeVisible();
    await page.getByRole('button', { name: /Edit brief/i }).click();

    await expect(page.locator('textarea')).toHaveValue(brief);
  });
});
