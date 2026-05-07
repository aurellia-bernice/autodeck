const { test, expect } = require('@playwright/test');

// Tests for the standalone action.html page (Firebase password reset handler).
// Real oobCodes from Firebase are not available in tests, so we cover:
//  - Missing/invalid URL params   → immediate error state (no Firebase call)
//  - Invalid oobCode param        → Firebase rejects it → error state
//  - Client-side form validation  → fires before Firebase confirmPasswordReset

test.describe('ResetPasswordScreen — URL param handling', () => {
  test('no URL params shows invalid link error immediately', async ({ page }) => {
    await page.goto('/action.html');
    // No mode param → jumps straight to error (no verifying spinner)
    await expect(page.getByText('Link expired')).toBeVisible({ timeout: 8000 });
    await expect(page.getByText('This link is invalid or has expired.')).toBeVisible();
  });

  test('wrong mode param shows invalid link error', async ({ page }) => {
    await page.goto('/action.html?mode=verifyEmail&oobCode=anything');
    await expect(page.getByText('Link expired')).toBeVisible({ timeout: 8000 });
    await expect(page.getByText('This link is invalid or has expired.')).toBeVisible();
  });

  test('mode=resetPassword with no oobCode shows invalid link error', async ({ page }) => {
    await page.goto('/action.html?mode=resetPassword');
    await expect(page.getByText('Link expired')).toBeVisible({ timeout: 8000 });
  });

  test('error state shows Back to sign in link', async ({ page }) => {
    await page.goto('/action.html');
    await expect(page.getByRole('link', { name: 'Back to sign in' })).toBeVisible({ timeout: 8000 });
  });

  test('invalid oobCode transitions through verifying to error', async ({ page }) => {
    await page.goto('/action.html?mode=resetPassword&oobCode=invalid-code-xyz');
    // First shows verifying spinner
    // Then Firebase rejects the code → error state
    await expect(page.getByText('Link expired')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('This reset link has expired or already been used.')).toBeVisible();
  });
});

test.describe('ResetPasswordScreen — page rendering', () => {
  test('shows AutoDeck AI wordmark', async ({ page }) => {
    await page.goto('/action.html');
    await expect(page.getByText('AutoDeck')).toBeVisible({ timeout: 8000 });
  });

  test('shows Reset your password heading', async ({ page }) => {
    await page.goto('/action.html');
    await expect(page.getByRole('heading', { name: 'Reset your password' })).toBeVisible({ timeout: 8000 });
  });

  test('shows Quidax footer branding', async ({ page }) => {
    await page.goto('/action.html');
    await expect(page.getByText('Quidax · Internal tool · Secure password reset')).toBeVisible({ timeout: 8000 });
  });
});

test.describe('ResetPasswordScreen — form validation', () => {
  // To reach the form we need a valid oobCode. Since we can't get a real one,
  // we inject a mock Firebase that accepts any code and returns a test email.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      // Intercept Firebase auth before the real SDK fires
      const originalInit = Object.getOwnPropertyDescriptor(window, 'firebaseAuth');
      Object.defineProperty(window, 'firebaseAuth', {
        configurable: true,
        get() { return this.__mockAuth; },
        set(v) { this.__mockAuth = v; },
      });
      // After page loads, replace verifyPasswordResetCode with a stub
      window.addEventListener('load', () => {
        if (window.firebaseAuth) {
          window.firebaseAuth.verifyPasswordResetCode = () =>
            Promise.resolve('test@quidax.com');
          window.firebaseAuth.confirmPasswordReset = () =>
            Promise.resolve();
        }
      });
    });
    await page.goto('/action.html?mode=resetPassword&oobCode=test-code');
    await expect(page.getByPlaceholder('Min. 8 characters')).toBeVisible({ timeout: 10000 });
  });

  test('shows email in header once verified', async ({ page }) => {
    await expect(page.getByText('test@quidax.com')).toBeVisible();
  });

  test('empty submit requires minimum password length', async ({ page }) => {
    await page.locator('button[type="submit"]').click();
    await expect(page.getByText('Password must be at least 8 characters.')).toBeVisible();
  });

  test('short password is rejected', async ({ page }) => {
    await page.getByPlaceholder('Min. 8 characters').fill('short');
    await page.locator('button[type="submit"]').click();
    await expect(page.getByText('Password must be at least 8 characters.')).toBeVisible();
  });

  test('mismatched passwords show error', async ({ page }) => {
    await page.getByPlaceholder('Min. 8 characters').fill('password123');
    await page.getByPlaceholder('Re-enter new password').fill('different456');
    await page.locator('button[type="submit"]').click();
    await expect(page.getByText('Passwords do not match.')).toBeVisible();
  });

  test('strength meter shows Too short for < 8 chars', async ({ page }) => {
    await page.getByPlaceholder('Min. 8 characters').fill('abc');
    await expect(page.getByText('Too short')).toBeVisible();
  });

  test('strength meter shows Strong for 12+ chars', async ({ page }) => {
    await page.getByPlaceholder('Min. 8 characters').fill('supersecurepass');
    await expect(page.getByText('Strong')).toBeVisible();
  });

  test('valid matching passwords show success state', async ({ page }) => {
    await page.getByPlaceholder('Min. 8 characters').fill('newpassword123');
    await page.getByPlaceholder('Re-enter new password').fill('newpassword123');
    await page.locator('button[type="submit"]').click();
    await expect(page.getByRole('heading', { name: 'Password changed' })).toBeVisible();
    await expect(page.getByText('You can now sign in with your new password.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sign in now' })).toBeVisible();
  });

  test('password visibility toggle works', async ({ page }) => {
    const input = page.getByPlaceholder('Min. 8 characters');
    await expect(input).toHaveAttribute('type', 'password');
    await input.locator('..').locator('button').click();
    await expect(input).toHaveAttribute('type', 'text');
  });
});
