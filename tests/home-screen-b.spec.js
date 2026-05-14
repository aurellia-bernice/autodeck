const { test, expect } = require('@playwright/test');
const { waitForApp } = require('./helpers');

// HomeScreenB is a design variant (two-column studio layout) that is loaded into
// the page but not wired to the main navigation. Tests inject it directly into a
// fixed overlay so it can be exercised in isolation.

test.describe('HomeScreenB', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitForApp(page);
    await page.evaluate(() => {
      const div = document.createElement('div');
      div.id = 'hsb-test';
      div.style.cssText = 'position:fixed;inset:0;z-index:9999;overflow:auto;';
      document.body.appendChild(div);
      ReactDOM.createRoot(div).render(
        React.createElement(window.HomeScreenB, { onGenerate: () => {} })
      );
    });
    await expect(page.locator('#hsb-test').getByText('New deck')).toBeVisible({ timeout: 5000 });
  });

  test.afterEach(async ({ page }) => {
    await page.evaluate(() => document.getElementById('hsb-test')?.remove());
  });

  const root = (page) => page.locator('#hsb-test');

  // ── Topbar ────────────────────────────────────────────────────────────────

  test('renders New deck header', async ({ page }) => {
    await expect(root(page).getByText('New deck')).toBeVisible();
  });

  test('renders DRAFT · UNSAVED status label', async ({ page }) => {
    await expect(root(page).getByText('DRAFT · UNSAVED')).toBeVisible();
  });

  // ── Left panel — editor ───────────────────────────────────────────────────

  test('renders Source content label', async ({ page }) => {
    await expect(root(page).getByText('Source content')).toBeVisible();
  });

  test('renders textarea for content input', async ({ page }) => {
    await expect(root(page).locator('textarea')).toBeVisible();
  });

  test('renders Attach file button', async ({ page }) => {
    await expect(root(page).getByRole('button', { name: /Attach file/i })).toBeVisible();
  });

  test('renders char and word count display', async ({ page }) => {
    await expect(root(page).getByText(/chars · \d+ words/)).toBeVisible();
  });

  test('renders Quick start section', async ({ page }) => {
    await expect(root(page).getByText('Quick start')).toBeVisible();
  });

  test('renders all six quick-start chips', async ({ page }) => {
    const chips = [
      'Quarterly business review',
      'Product launch',
      'Compliance training',
      'Investor update',
      'All-hands recap',
      'Sales pitch',
    ];
    for (const label of chips) {
      await expect(root(page).getByRole('button', { name: label, exact: true })).toBeVisible();
    }
  });

  // ── Right panel — config ──────────────────────────────────────────────────

  test('renders Estimate panel with Slides, Read, Words labels', async ({ page }) => {
    await expect(root(page).getByText('Slides')).toBeVisible();
    await expect(root(page).getByText('Read')).toBeVisible();
    await expect(root(page).getByText('Words')).toBeVisible();
  });

  test('renders slide count pill options', async ({ page }) => {
    for (const label of ['5', '8', '10', '15', 'Auto']) {
      await expect(root(page).getByRole('button', { name: label, exact: true })).toBeVisible();
    }
  });

  test('renders template style label', async ({ page }) => {
    await expect(root(page).getByText('Template style')).toBeVisible();
  });

  test('renders all four template style buttons', async ({ page }) => {
    for (const label of ['Professional', 'Minimal', 'Bold', 'Fun']) {
      await expect(root(page).getByRole('button', { name: new RegExp(label, 'i') }).first()).toBeVisible();
    }
  });

  test('renders Audience selector', async ({ page }) => {
    await expect(root(page).getByText('Audience')).toBeVisible();
    await expect(root(page).locator('select')).toBeVisible();
  });

  test('audience selector contains expected options', async ({ page }) => {
    const options = await root(page).locator('select option').allTextContents();
    expect(options).toContain('Internal team');
    expect(options).toContain('Leadership');
    expect(options).toContain('Investors');
  });

  // ── Generate button state ─────────────────────────────────────────────────

  test('Generate deck button is disabled when textarea is empty', async ({ page }) => {
    const btn = root(page).getByRole('button', { name: /Generate deck/i });
    await expect(btn).toBeVisible();
    await expect(btn).toBeDisabled();
  });

  test('Generate deck button is enabled after typing sufficient text', async ({ page }) => {
    await root(page).locator('textarea').fill(
      'Revenue strategy for Quidax targeting new markets in East Africa this quarter'
    );
    await expect(root(page).getByRole('button', { name: /Generate deck/i })).toBeEnabled();
  });

  // ── Interactivity ─────────────────────────────────────────────────────────

  test('clicking a quick-start chip prefills the textarea', async ({ page }) => {
    await root(page).getByRole('button', { name: 'Quarterly business review', exact: true }).click();
    const value = await root(page).locator('textarea').inputValue();
    expect(value).toContain('Quarterly business review');
  });

  test('char count updates as text is typed', async ({ page }) => {
    await root(page).locator('textarea').fill('Hello world');
    await expect(root(page).getByText(/11 chars/)).toBeVisible();
  });

  test('selecting a slide count pill does not crash', async ({ page }) => {
    await root(page).getByRole('button', { name: '10', exact: true }).click();
    await expect(root(page).locator('textarea')).toBeVisible();
  });

  test('selecting a template style button does not crash', async ({ page }) => {
    await root(page).getByRole('button', { name: /Bold/i }).first().click();
    await expect(root(page).locator('textarea')).toBeVisible();
  });

  test('changing audience dropdown does not crash', async ({ page }) => {
    await root(page).locator('select').selectOption('Leadership');
    await expect(root(page).getByRole('button', { name: /Generate deck/i })).toBeVisible();
  });
});
