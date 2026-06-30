const { test, expect } = require('@playwright/test');
const { waitForApp, goToScreen } = require('./helpers');

// ─── Auth mock helpers ─────────────────────────────────────────────────────
//
// AdminScreen is only rendered when userRole === 'admin'. We intercept
// window.firebaseAuth (set by firebase-config.js) before the page runs,
// wrapping its onAuthStateChanged to immediately return a fake admin user.
// This lets the app's own role-gate pass and renders the real AdminScreen UI.

async function injectAdminAuth(page) {
  await page.addInitScript(() => {
    let _wrapped = null;
    Object.defineProperty(window, 'firebaseAuth', {
      configurable: true,
      get: () => _wrapped,
      set: (realAuth) => {
        const adminUser = { uid: 'admin-test-uid', email: 'admin@quidax.com', displayName: 'Test Admin' };
        _wrapped = {
          onAuthStateChanged: (cb) => {
            // Fire the callback asynchronously so the component has mounted
            Promise.resolve().then(() =>
              cb(adminUser)
            );
            return () => {};
          },
          signOut: () => Promise.resolve(),
          // Forward any other methods that may be called
          currentUser: adminUser,
        };
      },
    });
  });
}

async function waitForAdminScreen(page) {
  await page.waitForLoadState('networkidle');
  await expect(page.getByText('Brand admin')).toBeVisible({ timeout: 10000 });
}

// ─── Tests with admin auth mock ───────────────────────────────────────────

test.describe('AdminScreen — admin role', () => {
  test.beforeEach(async ({ page }) => {
    await injectAdminAuth(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitForAdminScreen(page);
  });

  // ── Rendering ───────────────────────────────────────────────────────────

  test('renders the "Brand admin" heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Brand admin' })).toBeVisible();
  });

  test('renders the "Design team only" badge', async ({ page }) => {
    await expect(page.getByText('Design team only')).toBeVisible();
  });

  test('renders the admin description paragraph', async ({ page }) => {
    await expect(page.getByText(/Manage Quidax brand configuration/)).toBeVisible();
  });

  // ── Tab navigation ───────────────────────────────────────────────────────

  test('renders all five admin tabs', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Brand colours' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Typography' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Assets' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Templates' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Voice' })).toBeVisible();
  });

  test('Brand colours tab is active by default', async ({ page }) => {
    await expect(page.getByText('Colour palette')).toBeVisible();
  });

  test('clicking Typography tab shows font content', async ({ page }) => {
    await page.getByRole('button', { name: 'Typography' }).click();
    await expect(page.getByText('Display font')).toBeVisible();
  });

  test('clicking Templates tab shows template upload UI', async ({ page }) => {
    await page.getByRole('button', { name: 'Templates' }).click();
    await expect(page.getByText(/Upload template|PPTX|template/i).first()).toBeVisible();
  });

  test('clicking Assets tab shows brand asset library controls', async ({ page }) => {
    await page.getByRole('button', { name: 'Assets' }).click();
    await expect(page.getByText('Brand assets', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Upload from computer' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add external link' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save assets' })).toBeVisible();
  });

  test('clicking Voice tab shows voice guide section', async ({ page }) => {
    await page.getByRole('button', { name: 'Voice' }).click();
    await expect(page.getByText(/voice|Voice|tone/i).first()).toBeVisible();
  });

  // ── Brand colours tab ─────────────────────────────────────────────────────

  test('colour palette shows the default 6 colour rows', async ({ page }) => {
    await expect(page.locator('input[type="color"]')).toHaveCount(6);
    await expect(page.locator('input:not([type])').first()).toHaveValue('Primary purple');
    await expect(page.locator('input:not([type])').nth(3)).toHaveValue('Lime accent');
  });

  test('clicking "Add colour" button adds a new colour row', async ({ page }) => {
    const countBefore = await page.locator('input[type="color"]').count();
    await page.getByRole('button', { name: /Add colour/i }).click();
    const countAfter = await page.locator('input[type="color"]').count();
    expect(countAfter).toBeGreaterThan(countBefore);
  });

  test('clicking a delete button on a colour row removes it', async ({ page }) => {
    const countBefore = await page.locator('input[type="color"]').count();
    // Delete buttons have a trash-icon SVG; click the first one
    const deleteBtn = page.locator('button[title="Delete colour"]').first();
    await deleteBtn.click();
    const countAfter = await page.locator('input[type="color"]').count();
    expect(countAfter).toBeLessThan(countBefore);
  });

  test('clicking "Save palette" shows a "Saved" confirmation', async ({ page }) => {
    await page.getByRole('button', { name: /Save palette/i }).click();
    await expect(page.getByText(/✓ Saved/)).toBeVisible();
  });

  // ── Typography tab ────────────────────────────────────────────────────────

  test('Typography tab shows "Branded decks" font preview', async ({ page }) => {
    await page.getByRole('button', { name: 'Typography' }).click();
    await expect(page.getByText('Branded decks,')).toBeVisible();
  });

  test('Typography tab shows font family name for Display font', async ({ page }) => {
    await page.getByRole('button', { name: 'Typography' }).click();
    // Default display font is Space Grotesk
    await expect(page.getByText(/Display font · Space Grotesk/)).toBeVisible();
  });

  test('Assets tab adds a Google Drive brand asset link', async ({ page }) => {
    await page.getByRole('button', { name: 'Assets' }).click();
    await page.getByPlaceholder('https://drive.google.com/... or https://...').fill('https://drive.google.com/file/d/abc123/view?usp=sharing');
    await page.getByPlaceholder('Asset name').fill('Quidax logo');
    await page.getByPlaceholder(/Usage hint/).first().fill('Primary logo for deck exports');
    await page.getByRole('button', { name: 'Add external link' }).click();

    await expect(page.getByLabel('Asset name')).toHaveValue('Quidax logo');
    await expect(page.getByLabel('Asset description')).toHaveValue('Primary logo for deck exports');
    await expect(page.getByText(/google/i)).toBeVisible();
  });

  test('Assets tab upload creates an editable asset description row', async ({ page }) => {
    await page.getByRole('button', { name: 'Assets' }).click();
    await page.evaluate(() => {
      window.firebaseStorage = {
        ref: (path) => ({
          put: (file) => {
            window.__lastBrandAssetUpload = { path, name: file.name, type: file.type };
            return Promise.resolve({
              ref: {
                getDownloadURL: () => Promise.resolve(`https://storage.example/${encodeURIComponent(file.name)}`),
              },
            });
          },
        }),
      };
    });

    const chooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Upload from computer' }).click();
    const chooser = await chooserPromise;
    await chooser.setFiles({
      name: 'hero-illustration.png',
      mimeType: 'image/png',
      buffer: Buffer.from('fake-image'),
    });

    await expect(page.getByLabel('Asset name')).toHaveValue('hero-illustration');
    await expect(page.getByLabel('Asset type')).toHaveValue('image');
    await page.getByLabel('Asset description').fill('Hero illustration for onboarding decks');
    await expect(page.getByLabel('Asset description')).toHaveValue('Hero illustration for onboarding decks');
  });
});

// ─── Tests for non-admin fallback ─────────────────────────────────────────

test.describe('AdminScreen — non-admin role', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitForApp(page);
    await goToScreen(page, 'admin');
  });

  test('shows access-restricted message for non-admin users', async ({ page }) => {
    await expect(page.getByText(/Sign in with an admin account/i)).toBeVisible();
  });

  test('does not render the Brand admin heading for non-admins', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Brand admin' })).not.toBeVisible();
  });
});
