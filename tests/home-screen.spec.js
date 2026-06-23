const { test, expect } = require('@playwright/test');
const { waitForApp, goToScreen } = require('./helpers');

test.describe('HomeScreenA', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitForApp(page);
    await goToScreen(page, 'home');
  });

  // ── Rendering ─────────────────────────────────────────────────────────────

  test('renders editorial headline', async ({ page }) => {
    await expect(page.getByText('What are')).toBeVisible();
    await expect(page.getByText('we presenting')).toBeVisible();
  });

  test('renders marquee strip with brand copy', async ({ page }) => {
    await expect(page.getByText(/Quidax · Internal/).first()).toBeVisible();
  });

  test('renders textarea for content input', async ({ page }) => {
    await expect(page.locator('textarea')).toBeVisible();
  });

  test('renders Attach file button', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Attach file/i })).toBeVisible();
  });

  test('renders all slide count pill options', async ({ page }) => {
    for (const label of ['5', '8', '10', '15', 'Auto']) {
      await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible();
    }
  });

  test('renders all template style pill options', async ({ page }) => {
    for (const label of ['Professional', 'Minimal', 'Bold', 'Fun']) {
      await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible();
    }
  });

  test('renders 5 prompt seed cards', async ({ page }) => {
    await page.getByRole('button', { name: /Not sure where to start\?/i }).click();

    const labels = [
      'Q3 business review',
      'Product launch announcement',
      'Compliance training deck',
      'Series B update',
      'Team all-hands recap',
    ];
    for (const label of labels) {
      await expect(page.getByRole('button', { name: new RegExp(label, 'i') })).toBeVisible();
    }
  });

  test('renders collapsed starter prompt section label', async ({ page }) => {
    await expect(page.getByText('Not sure where to start?')).toBeVisible();
    await expect(page.getByText('Pick a brief starter')).toBeVisible();
  });

  // ── Generate button state ──────────────────────────────────────────────────

  test('Generate deck button is disabled when textarea is empty', async ({ page }) => {
    const btn = page.getByRole('button', { name: /Generate deck/i });
    await expect(btn).toBeVisible();
    await expect(btn).toBeDisabled();
  });

  test('Generate deck button is enabled after typing sufficient text', async ({ page }) => {
    await page.locator('textarea').fill(
      'Revenue strategy for Quidax targeting new markets in East Africa with expanded merchant services'
    );
    await expect(page.getByRole('button', { name: /Generate deck/i })).toBeEnabled();
  });

  test('shows word count and estimated slide count after typing', async ({ page }) => {
    await page.locator('textarea').fill(
      'Revenue strategy for the Quidax platform targeting new markets in East Africa this quarter'
    );
    await expect(page.getByText(/words · ~\d+ slides/)).toBeVisible();
  });

  test('shows "or drag a file" hint when textarea is empty', async ({ page }) => {
    await expect(page.getByText('or drag a file')).toBeVisible();
  });

  // ── Prompt seed interaction ───────────────────────────────────────────────

  test('clicking a prompt seed fills the textarea with seed content', async ({ page }) => {
    await page.getByRole('button', { name: /Not sure where to start\?/i }).click();
    await page.getByRole('button', { name: /Q3 business review/i }).click();
    const value = await page.locator('textarea').inputValue();
    expect(value.length).toBeGreaterThan(10);
  });

  test('clicking a prompt seed enables the Generate deck button', async ({ page }) => {
    await page.getByRole('button', { name: /Not sure where to start\?/i }).click();
    await page.getByRole('button', { name: /Product launch announcement/i }).click();
    await expect(page.getByRole('button', { name: /Generate deck/i })).toBeEnabled();
  });

  test('manual Direction mode is submitted as a brief even for long text', async ({ page }) => {
    const longDirection = [
      'Build a hiring strategy deck for the Quidax data engineering program and keep it framed as a proposal for talent leadership.',
      'Cover the role profile, hiring funnel, candidate assessment, onboarding milestones, mentoring ownership, tooling readiness, data platform priorities, risks, and next steps.',
      'Use a practical operating cadence with weekly review moments, named decision points, open assumptions, and clear information gaps for the recruiting team.',
      'The deck should feel like a direction-setting narrative rather than pasted source content, with sections for context, problem, approach, implementation plan, and leadership decisions.',
      'Avoid pretending we already have final metrics, final headcount approvals, final budget, confirmed interview panels, or finalized timelines unless the source later provides them.',
      'Make the outcome useful for planning a discussion, assigning owners, and identifying what extra source material should be uploaded before producing a final version.',
    ].join(' ');

    await page.locator('textarea').fill(longDirection);
    await page.getByRole('button', { name: 'Direction', exact: true }).click();
    await page.getByRole('button', { name: /Generate deck/i }).click();

    await expect.poll(async () => page.evaluate(() => window.__autodeck_generation_debug?.().inputMode)).toBe('brief');
  });

  // ── Pill selection ────────────────────────────────────────────────────────

  test('clicking a different slide count pill does not crash', async ({ page }) => {
    await page.getByRole('button', { name: '10', exact: true }).click();
    await expect(page.locator('textarea')).toBeVisible();
  });

  test('clicking a different template style pill does not crash', async ({ page }) => {
    await page.getByRole('button', { name: 'Bold', exact: true }).click();
    await expect(page.locator('textarea')).toBeVisible();
  });

  // ── Drag-and-drop hint ────────────────────────────────────────────────────

  test('textarea card is visible and accepts text input', async ({ page }) => {
    await page.locator('textarea').fill('Hello world this is a test');
    await expect(page.locator('textarea')).toHaveValue(/Hello world/);
  });
});
