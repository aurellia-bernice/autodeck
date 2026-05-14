const { test, expect } = require('@playwright/test');
const { waitForApp, goToScreen } = require('./helpers');

test.describe('ProcessingScreen', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForApp(page);
    // Navigating to 'processing' auto-injects demo config (inputText, slideCount=10, templateStyle=Professional)
    await goToScreen(page, 'processing');
  });

  // ── Rendering ─────────────────────────────────────────────────────────────

  test('renders "your deck" italic text in the headline', async ({ page }) => {
    await expect(page.getByText('your deck')).toBeVisible();
  });

  test('renders a live status eyebrow with phase verb', async ({ page }) => {
    // Eyebrow shows "Live · <Verb>" — match the Live prefix
    await expect(page.getByText(/Live ·/)).toBeVisible();
  });

  test('renders the progress percentage counter', async ({ page }) => {
    // Progress starts near 0 and ticks up; just verify the element is present
    await expect(page.getByText(/%/)).toBeVisible();
  });

  test('renders the slide thumbnail grid', async ({ page }) => {
    // "Building N of M slides" text is always shown
    await expect(page.getByText(/Building/)).toBeVisible();
    await expect(page.getByText(/of 10 slides/)).toBeVisible();
  });

  // ── Steps panel ───────────────────────────────────────────────────────────

  test('renders "Steps" label in the phases panel', async ({ page }) => {
    await expect(page.getByText('Steps')).toBeVisible();
  });

  test('renders all four phase labels', async ({ page }) => {
    await expect(page.getByText('Parsing your content')).toBeVisible();
    await expect(page.getByText('Structuring slides')).toBeVisible();
    await expect(page.getByText('Applying brand formatting')).toBeVisible();
    await expect(page.getByText('Finalising your deck')).toBeVisible();
  });

  test('renders a progress bar element', async ({ page }) => {
    // Progress bar container is always rendered; check it exists
    const progressBar = page.locator('div').filter({ hasText: /Parsing your content/ }).locator('div[style*="height: 4px"]').first();
    await expect(progressBar).toBeVisible();
  });

  // ── Live trace panel ──────────────────────────────────────────────────────

  test('renders "Live trace" label in the log panel', async ({ page }) => {
    await expect(page.getByText('Live trace')).toBeVisible();
  });

  test('renders the terminal-style blinking cursor initially', async ({ page }) => {
    // The cursor "_" appears while progress < 99
    await expect(page.getByText('_')).toBeVisible();
  });

  // ── Footer config strip ───────────────────────────────────────────────────

  test('footer strip shows the template style', async ({ page }) => {
    await expect(page.getByText(/Professional/)).toBeVisible();
  });

  test('footer strip shows the slide count', async ({ page }) => {
    await expect(page.getByText(/10 slides/)).toBeVisible();
  });

  test('footer strip shows the generation status message', async ({ page }) => {
    // When generationStatus is 'idle' (default via tweaks), shows "Generated slides ready"
    // or "Waiting for generated slides" if still loading — either is acceptable
    await expect(page.getByText(/slides ready|Waiting for generated slides/i)).toBeVisible();
  });
});
