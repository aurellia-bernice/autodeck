const { test, expect } = require('@playwright/test');
const { goToScreen, waitForApp } = require('./helpers');

test.describe('AccountSettingsScreen', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForApp(page);
    await goToScreen(page, 'settings');
    await expect(page.getByRole('heading', { name: 'Account settings' })).toBeVisible({ timeout: 10000 });
  });

  // ── Rendering ─────────────────────────────────────────────────────────────

  test('renders all main sections', async ({ page }) => {
    await expect(page.getByText('Display name')).toBeVisible();
    await expect(page.getByText('Work email')).toBeVisible();
    await expect(page.getByText('Account', { exact: true })).toBeVisible();
    await expect(page.getByText('Security', { exact: true })).toBeVisible();
  });

  test('shows Change password action row', async ({ page }) => {
    await expect(page.getByText('Change password')).toBeVisible();
    await expect(page.getByText('Update your Quidax account password')).toBeVisible();
  });

  test('shows Sign out button', async ({ page }) => {
    // The settings page sign-out is a full-width button with visible text (last match)
    await expect(page.getByRole('button', { name: 'Sign out' }).last()).toBeVisible();
  });

  test('email field is marked read-only', async ({ page }) => {
    await expect(page.getByText('Read-only')).toBeVisible();
  });

  // ── Display name editing ──────────────────────────────────────────────────

  test('Edit button reveals inline name input', async ({ page }) => {
    await page.getByRole('button', { name: 'Edit' }).click();
    await expect(page.getByPlaceholder('Your display name')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
  });

  test('Cancel button restores display state', async ({ page }) => {
    await page.getByRole('button', { name: 'Edit' }).click();
    await expect(page.getByPlaceholder('Your display name')).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByPlaceholder('Your display name')).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible();
  });

  test('empty name input shows validation error', async ({ page }) => {
    await page.getByRole('button', { name: 'Edit' }).click();
    await page.getByPlaceholder('Your display name').fill('');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Name cannot be empty.')).toBeVisible();
  });

  test('Enter key submits the name form', async ({ page }) => {
    await page.getByRole('button', { name: 'Edit' }).click();
    const input = page.getByPlaceholder('Your display name');
    await input.fill('');
    await input.press('Enter');
    await expect(page.getByText('Name cannot be empty.')).toBeVisible();
  });

  test('Escape key cancels editing', async ({ page }) => {
    await page.getByRole('button', { name: 'Edit' }).click();
    await page.getByPlaceholder('Your display name').press('Escape');
    await expect(page.getByPlaceholder('Your display name')).not.toBeVisible();
  });

  // ── Navigation ────────────────────────────────────────────────────────────

  test('Change password row navigates to change password screen', async ({ page }) => {
    await page.getByText('Change password').click();
    await expect(page.getByRole('heading', { name: 'Change password' })).toBeVisible();
  });

  test('back from change password returns to settings', async ({ page }) => {
    await page.getByText('Change password').click();
    await expect(page.getByRole('heading', { name: 'Change password' })).toBeVisible();
    await page.getByRole('button', { name: 'Back to dashboard' }).click();
    await expect(page.getByRole('heading', { name: 'Account settings' })).toBeVisible();
  });
});
