const { test, expect } = require('@playwright/test');
const { waitForApp, goToScreen } = require('./helpers');

test.describe('PreviewScreen', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitForApp(page);
    await goToScreen(page, 'preview');
  });

  // ── Rendering ─────────────────────────────────────────────────────────────

  test('renders the AutoDeck AI Preview label', async ({ page }) => {
    await expect(page.getByText('AutoDeck AI · Preview')).toBeVisible();
  });

  test('renders the "Ready" status eyebrow', async ({ page }) => {
    await expect(page.getByText(/Ready ·/)).toBeVisible();
  });

  test('renders cover card with the deck title', async ({ page }) => {
    // Cover always shows a title derived from inputText
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('renders "Generate again" button on the cover', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Generate again/i })).toBeVisible();
  });

  test('renders "Open slideshow" button on the cover', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Open slideshow/i })).toBeVisible();
  });

  test('renders theme picker buttons in the cover', async ({ page }) => {
    // 4 circular theme swatch buttons with title attributes
    const swatches = page.locator('button[title="Quidax"], button[title="Midnight"], button[title="Sunset"], button[title="Forest"]');
    await expect(swatches).toHaveCount(4);
  });

  test('clicking a theme picker button does not crash', async ({ page }) => {
    await page.locator('button[title="Midnight"]').click();
    await expect(page.getByRole('button', { name: /Open slideshow/i })).toBeVisible();
  });

  // ── Cover meta strip ──────────────────────────────────────────────────────

  test('cover meta strip shows Slides, Style, Created, and Read time', async ({ page }) => {
    await expect(page.getByText('Slides', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Style', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Created', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Read time', { exact: true }).first()).toBeVisible();
  });

  // ── Outline section ───────────────────────────────────────────────────────

  test('renders "The outline" section heading', async ({ page }) => {
    await expect(page.getByText('The outline')).toBeVisible();
  });

  test('shows slides count in outline heading', async ({ page }) => {
    await expect(page.getByText(/slides, ranked/i)).toBeVisible();
  });

  test('renders Expand all and Collapse all buttons', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Expand all/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Collapse all/i })).toBeVisible();
  });

  test('first slide row is visible with index 01', async ({ page }) => {
    await expect(page.getByText('01', { exact: true }).first()).toBeVisible();
  });

  // ── Expand / collapse ─────────────────────────────────────────────────────

  test('Collapse all hides all bullet points', async ({ page }) => {
    await page.getByRole('button', { name: /Collapse all/i }).click();
    // After collapsing, no bullet point prefix "·01" visible
    await expect(page.getByText(/·01/)).not.toBeVisible();
  });

  test('Expand all shows bullet points for all slides', async ({ page }) => {
    await page.getByRole('button', { name: /Expand all/i }).click();
    // Bullet point prefix format is ·01, ·02, etc.
    await expect(page.getByText(/·01/).first()).toBeVisible();
  });

  test('clicking a collapsed slide row expands it', async ({ page }) => {
    // Collapse all first, then click the first slide row to expand it
    await page.getByRole('button', { name: /Collapse all/i }).click();
    // Click on the slide row (the "01" index cell)
    await page.getByText('01', { exact: true }).first().click();
    await expect(page.getByText('Edit').first()).toBeVisible();
  });

  // ── Slide editing ─────────────────────────────────────────────────────────

  test('Edit button is visible in an expanded slide', async ({ page }) => {
    // First slide is expanded by default
    await expect(page.getByRole('button', { name: /^Edit$/i }).first()).toBeVisible();
  });

  test('clicking Edit puts the slide into edit mode with a title input', async ({ page }) => {
    await page.getByRole('button', { name: /^Edit$/i }).first().click();
    await expect(page.locator('input').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Save changes/i })).toBeVisible();
  });

  test('Cancel button exits edit mode without saving', async ({ page }) => {
    await page.getByRole('button', { name: /^Edit$/i }).first().click();
    await page.getByRole('button', { name: /^Cancel$/i }).click();
    await expect(page.getByRole('button', { name: /^Edit$/i }).first()).toBeVisible();
  });

  test('saving an edit persists the changed title', async ({ page }) => {
    await page.getByRole('button', { name: /^Edit$/i }).first().click();
    const titleInput = page.locator('input').first();
    await titleInput.clear();
    await titleInput.fill('Updated Slide Title');
    await page.getByRole('button', { name: /Save changes/i }).click();
    await expect(page.getByText('Updated Slide Title')).toBeVisible();
  });

  // ── Slide management ──────────────────────────────────────────────────────

  test('Delete button is visible in an expanded slide', async ({ page }) => {
    await expect(page.getByRole('button', { name: /^Delete$/i }).first()).toBeVisible();
  });

  test('deleting a slide removes it from the outline', async ({ page }) => {
    const countBefore = await page.getByText(/^\d{2}$/).count();
    await page.getByRole('button', { name: /^Delete$/i }).first().click();
    const countAfter = await page.getByText(/^\d{2}$/).count();
    expect(countAfter).toBeLessThan(countBefore);
  });

  test('Add a slide button adds a new slide row', async ({ page }) => {
    const countBefore = await page.getByText(/^\d{2}$/).count();
    await page.getByRole('button', { name: /Add a slide/i }).click();
    const countAfter = await page.getByText(/^\d{2}$/).count();
    expect(countAfter).toBeGreaterThan(countBefore);
  });

  // ── Error state ───────────────────────────────────────────────────────────

  test('error message banner is not visible in normal state', async ({ page }) => {
    // Default navigation via tweaks sets generationStatus to 'idle', not 'error'
    await expect(page.getByText(/No local draft was used/)).not.toBeVisible();
    await expect(page.getByText(/Showing a draft from your content/)).not.toBeVisible();
  });
});
