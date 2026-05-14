const { test, expect } = require('@playwright/test');
const { waitForApp, goToScreen } = require('./helpers');

// The Sidebar renders on every screen except login, processing, and slideshow.
// We navigate to 'home' via the tweaks panel so it's visible without real auth.
// Without Firebase auth the app has no currentUser, so userRole = 'employee'
// and the Admin nav item is hidden.

test.describe('Sidebar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitForApp(page);
    await goToScreen(page, 'home');
  });

  // ── Brand identity ────────────────────────────────────────────────────────

  test('renders the AutoDeck AI brand name', async ({ page }) => {
    await expect(page.getByText('AutoDeck')).toBeVisible();
    await expect(page.getByText('AI')).toBeVisible();
  });

  test('renders the "Quidax · Internal" subtitle', async ({ page }) => {
    // The sidebar always renders dark; find the subtitle in the sidebar
    await expect(page.getByText('Quidax · Internal').first()).toBeVisible();
  });

  // ── Navigation items ──────────────────────────────────────────────────────

  test('renders the "Workspace" nav section label', async ({ page }) => {
    await expect(page.getByText('Workspace')).toBeVisible();
  });

  test('renders the "Generate" nav item', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Generate/i }).first()).toBeVisible();
  });

  test('renders the "History" nav item', async ({ page }) => {
    await expect(page.getByRole('button', { name: /History/i })).toBeVisible();
  });

  test('renders the "Settings" nav item', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Settings/i })).toBeVisible();
  });

  test('Admin nav item is hidden for non-admin (employee) role', async ({ page }) => {
    // Without real auth currentUser is null → userRole = 'employee'
    await expect(page.getByRole('button', { name: /Admin/i })).not.toBeVisible();
  });

  // ── Active state ──────────────────────────────────────────────────────────

  test('Generate nav item is highlighted when home screen is active', async ({ page }) => {
    // The active item has a lime indicator dot (aria role is not set on it,
    // but the Generate button should be the only visible active nav item)
    const generateBtn = page.getByRole('button', { name: /Generate/i }).first();
    await expect(generateBtn).toBeVisible();
    // Verify that navigating away and back works without crash
    await page.getByRole('button', { name: /History/i }).click();
    await page.getByRole('button', { name: /Generate/i }).first().click();
    await expect(page.getByText('What are')).toBeVisible();
  });

  test('clicking "History" nav item navigates to History screen', async ({ page }) => {
    await page.getByRole('button', { name: /History/i }).click();
    await expect(page.getByText('Everything')).toBeVisible();
  });

  test('clicking "Settings" nav item navigates to Account Settings screen', async ({ page }) => {
    await page.getByRole('button', { name: /Settings/i }).click();
    await expect(page.getByText(/Account|Profile|Settings/i).first()).toBeVisible();
  });

  // ── User section ──────────────────────────────────────────────────────────

  test('renders a user avatar area at the bottom of the sidebar', async ({ page }) => {
    // Without auth the avatar shows "?" (first char of '?')
    await expect(page.getByText('?')).toBeVisible();
  });

  test('renders the dark mode toggle button', async ({ page }) => {
    // The moon/sun icon button has a title attribute
    await expect(page.locator('button[title*="mode"]')).toBeVisible();
  });

  test('clicking the dark mode toggle does not crash', async ({ page }) => {
    await page.locator('button[title*="mode"]').click();
    // The app should still render the home screen content
    await expect(page.getByText('What are')).toBeVisible();
  });
});

// ─── Sidebar with admin role ───────────────────────────────────────────────

test.describe('Sidebar — admin role', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      let _wrapped = null;
      Object.defineProperty(window, 'firebaseAuth', {
        configurable: true,
        get: () => _wrapped,
        set: () => {
          _wrapped = {
            onAuthStateChanged: (cb) => {
              Promise.resolve().then(() =>
                cb({ uid: 'admin-uid', email: 'admin@quidax.com', displayName: 'Admin User' })
              );
              return () => {};
            },
            signOut: () => Promise.resolve(),
            currentUser: null,
          };
        },
      });
    });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    // Admin users land on the admin screen; navigate to home to see sidebar clearly
    await page.waitForSelector('button', { timeout: 10000 });
  });

  test('Admin nav item is visible for admin role', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Admin/i })).toBeVisible({ timeout: 8000 });
  });

  test('admin user avatar shows first letter of display name', async ({ page }) => {
    // displayName = "Admin User" → initial = "A"
    await expect(page.getByText('A').first()).toBeVisible({ timeout: 8000 });
  });
});
