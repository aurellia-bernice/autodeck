const { test, expect } = require('@playwright/test');
const { goToScreen, waitForApp } = require('./helpers');

// Navigate to ChangePasswordScreen via the Tweaks panel.
// Firebase auth is NOT required — the screen renders and validates client-side
// before any Firebase call is made.

test.describe('ChangePasswordScreen', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForApp(page);
    await goToScreen(page, 'changePassword');
    await expect(page.getByRole('heading', { name: 'Change password' })).toBeVisible();
  });

  // ── Rendering ────────────────────────────────────────────────────────────

  test('renders all three password fields', async ({ page }) => {
    await expect(page.getByPlaceholder('Your current password')).toBeVisible();
    await expect(page.getByPlaceholder('Min. 8 characters')).toBeVisible();
    await expect(page.getByPlaceholder('Re-enter new password')).toBeVisible();
  });

  test('renders Cancel and Update password buttons', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Update password' })).toBeVisible();
  });

  test('back button is visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Back to dashboard' })).toBeVisible();
  });

  // ── Client-side validation ────────────────────────────────────────────────

  test('empty submit requires current password', async ({ page }) => {
    await page.getByRole('button', { name: 'Update password' }).click();
    await expect(page.getByText('Enter your current password.')).toBeVisible();
  });

  test('new password under 8 characters is rejected', async ({ page }) => {
    await page.getByPlaceholder('Your current password').fill('anything');
    await page.getByPlaceholder('Min. 8 characters').fill('short');
    await page.getByRole('button', { name: 'Update password' }).click();
    await expect(page.getByText('New password must be at least 8 characters.')).toBeVisible();
  });

  test('mismatched new passwords show error', async ({ page }) => {
    await page.getByPlaceholder('Your current password').fill('currentpass');
    await page.getByPlaceholder('Min. 8 characters').fill('newpassword1');
    await page.getByPlaceholder('Re-enter new password').fill('newpassword2');
    await page.getByRole('button', { name: 'Update password' }).click();
    await expect(page.getByText('Passwords do not match.')).toBeVisible();
  });

  // ── Password strength meter ───────────────────────────────────────────────

  test('strength meter is hidden when new password is empty', async ({ page }) => {
    // The strength bar segments are only rendered when newPw.length > 0
    // There are 4 flex segments — check none are showing with strength colors
    await expect(page.getByText('Too short')).not.toBeVisible();
    await expect(page.getByText('Weak')).not.toBeVisible();
    await expect(page.getByText('Strong')).not.toBeVisible();
  });

  test('strength meter shows Too short for < 8 characters', async ({ page }) => {
    await page.getByPlaceholder('Min. 8 characters').fill('abc');
    await expect(page.getByText('Too short')).toBeVisible();
  });

  test('strength meter shows Weak for 8–9 character password', async ({ page }) => {
    await page.getByPlaceholder('Min. 8 characters').fill('pass1234');
    await expect(page.getByText('Weak')).toBeVisible();
  });

  test('strength meter shows Moderate for 10–11 character password', async ({ page }) => {
    await page.getByPlaceholder('Min. 8 characters').fill('password123');
    await expect(page.getByText('Moderate')).toBeVisible();
  });

  test('strength meter shows Strong for 12+ character password', async ({ page }) => {
    await page.getByPlaceholder('Min. 8 characters').fill('supersecurepassword');
    await expect(page.getByText('Strong')).toBeVisible();
  });

  // ── Navigation ────────────────────────────────────────────────────────────

  test('Cancel button navigates back to home', async ({ page }) => {
    await page.getByRole('button', { name: 'Cancel' }).click();
    // Home screen renders the generate heading
    await expect(page.getByText('What are')).toBeVisible({ timeout: 5000 });
  });

  test('back link navigates back to home', async ({ page }) => {
    await page.getByRole('button', { name: 'Back to dashboard' }).click();
    await expect(page.getByText('What are')).toBeVisible({ timeout: 5000 });
  });

  // ── Password visibility toggles ───────────────────────────────────────────

  test('current password toggle changes input type', async ({ page }) => {
    const input = page.getByPlaceholder('Your current password');
    await expect(input).toHaveAttribute('type', 'password');
    await input.locator('..').locator('button').click();
    await expect(input).toHaveAttribute('type', 'text');
  });

  test('new password toggle also reveals confirm field', async ({ page }) => {
    const newInput = page.getByPlaceholder('Min. 8 characters');
    const confirmInput = page.getByPlaceholder('Re-enter new password');
    await expect(newInput).toHaveAttribute('type', 'password');
    await expect(confirmInput).toHaveAttribute('type', 'password');
    await newInput.locator('..').locator('button').click();
    await expect(newInput).toHaveAttribute('type', 'text');
    await expect(confirmInput).toHaveAttribute('type', 'text');
  });
});
