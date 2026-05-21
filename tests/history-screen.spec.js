const { test, expect } = require('@playwright/test');
const { waitForApp, goToScreen } = require('./helpers');

// HistoryScreen renders with 8 seed decks when there is no authenticated Firebase user.
// Seed deck stats: 8 decks, 93 total slides, 3 favourites (s1 Q2 Sales, s3 HR Onboarding, s5 Investor Update).

test.describe('HistoryScreen', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitForApp(page);
    await goToScreen(page, 'history');
  });

  // ── Rendering ─────────────────────────────────────────────────────────────

  test('renders the "Library" eyebrow label', async ({ page }) => {
    await expect(page.getByText('Library')).toBeVisible();
  });

  test('renders the "Everything you\'ve made" heading', async ({ page }) => {
    await expect(page.getByText("Everything")).toBeVisible();
    await expect(page.getByText("you've made")).toBeVisible();
  });

  // ── Stats strip ───────────────────────────────────────────────────────────

  test('renders Decks, Slides, and Favourites stat labels', async ({ page }) => {
    await expect(page.getByText('Decks', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Slides', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Favourites', { exact: true }).first()).toBeVisible();
  });

  test('shows 8 decks in the stats strip', async ({ page }) => {
    // Decks stat value is "08" (padded)
    await expect(page.getByText('08', { exact: true }).first()).toBeVisible();
  });

  test('shows 3 favourites in the stats strip', async ({ page }) => {
    // Favourites stat value is "03" (padded)
    await expect(page.getByText('03', { exact: true }).first()).toBeVisible();
  });

  // ── Featured / Most recent ────────────────────────────────────────────────

  test('renders "Most recent" section label', async ({ page }) => {
    await expect(page.getByText('Most recent')).toBeVisible();
  });

  test('featured deck is the first seed deck "Q2 Sales Strategy Overview"', async ({ page }) => {
    await expect(page.getByText('Q2 Sales Strategy Overview').first()).toBeVisible();
  });

  test('featured deck shows Open and Download buttons', async ({ page }) => {
    await expect(page.getByRole('button', { name: /^Open$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Download$/i })).toBeVisible();
  });

  test('featured deck meta strip shows Slides, Size, and Author', async ({ page }) => {
    await expect(page.getByText('Author')).toBeVisible();
    await expect(page.getByText('Size')).toBeVisible();
    // Slides label appears in meta strip (distinct from the stats strip)
    await expect(page.getByText('Slides', { exact: true }).first()).toBeVisible();
  });

  // ── Toolbar ───────────────────────────────────────────────────────────────

  test('renders a search input', async ({ page }) => {
    await expect(page.getByPlaceholder('Search the library…')).toBeVisible();
  });

  test('renders template filter buttons', async ({ page }) => {
    for (const label of ['All', 'Professional', 'Minimal', 'Bold', 'Fun']) {
      await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible();
    }
  });

  test('renders Shelf and List view toggle buttons', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Shelf', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'List', exact: true })).toBeVisible();
  });

  // ── Search ────────────────────────────────────────────────────────────────

  test('searching filters decks to matching titles', async ({ page }) => {
    await page.getByPlaceholder('Search the library…').fill('Investor');
    await expect(page.getByRole('heading', { name: 'Investor Update — Series B' })).toBeVisible();
    // Non-matching deck should not appear
    await expect(page.getByText('Q2 Sales Strategy Overview')).not.toBeVisible();
  });

  test('searching with no match shows empty state message', async ({ page }) => {
    await page.getByPlaceholder('Search the library…').fill('zzznonexistentdeck');
    await expect(page.getByText(/Nothing in the library matches/)).toBeVisible();
  });

  // ── Template filter ───────────────────────────────────────────────────────

  test('filtering by "Bold" template shows only Bold decks', async ({ page }) => {
    await page.getByRole('button', { name: 'Bold', exact: true }).click();
    // "Product Roadmap H2 2026" and "Brand Guidelines 2026" are Bold
    await expect(page.getByRole('heading', { name: 'Product Roadmap H2 2026' }).first()).toBeVisible();
    // "Q2 Sales Strategy Overview" is Professional — should be hidden
    await expect(page.getByText('Q2 Sales Strategy Overview')).not.toBeVisible();
  });

  test('clicking "All" filter after a template filter restores all decks', async ({ page }) => {
    await page.getByRole('button', { name: 'Bold', exact: true }).click();
    await page.getByRole('button', { name: 'All', exact: true }).click();
    await expect(page.getByText('Q2 Sales Strategy Overview').first()).toBeVisible();
  });

  // ── List view ─────────────────────────────────────────────────────────────

  test('switching to List view renders deck rows', async ({ page }) => {
    await page.getByRole('button', { name: 'List', exact: true }).click();
    // In list view every deck shows its title as text
    await expect(page.getByText('Q2 Sales Strategy Overview')).toBeVisible();
    await expect(page.getByText('Product Roadmap H2 2026')).toBeVisible();
  });

  test('List view shows template and slide count columns', async ({ page }) => {
    await page.getByRole('button', { name: 'List', exact: true }).click();
    await expect(page.getByText('Professional').first()).toBeVisible();
    await expect(page.getByText('10 slides').first()).toBeVisible();
  });

  // ── Favourite toggle ──────────────────────────────────────────────────────

  test('toggling favourite in list view updates the favourite count', async ({ page }) => {
    await page.getByRole('button', { name: 'List', exact: true }).click();
    // Click the first star/fav button in the list (first row = Q2 Sales, already favourite)
    const favBtn = page.locator('button').filter({ has: page.locator('svg path[d*="7 1l1.8"]') }).first();
    await favBtn.click();
    // Count drops from 3 to 2 — stat should now show "02"
    await expect(page.getByText('02', { exact: true }).first()).toBeVisible();
  });

  // ── Delete ────────────────────────────────────────────────────────────────

  test('deleting a deck in list view removes it from the list', async ({ page }) => {
    await page.getByRole('button', { name: 'List', exact: true }).click();
    // Delete button is the trash-icon button (second action button per row)
    // Use the delete SVG path to identify the correct button
    const deleteBtn = page.locator('button').filter({ has: page.locator('svg path[d*="M2 3h10"]') }).first();
    await deleteBtn.click();
    // Decks count drops from 8 to 7 — stat should show "07"
    await expect(page.getByText('07', { exact: true }).first()).toBeVisible();
  });
});
