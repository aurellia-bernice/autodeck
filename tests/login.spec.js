const { test, expect } = require('@playwright/test');
const { waitForApp } = require('./helpers');

test.describe('LoginScreen', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitForApp(page);
  });

  // ── Rendering ────────────────────────────────────────────────────────────

  test('renders sign-in form with all expected elements', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    await expect(page.getByPlaceholder('you@quidax.com')).toBeVisible();
    await expect(page.getByPlaceholder('Enter your password')).toBeVisible();
    await expect(page.getByText('Forgot password?')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
  });

  test('shows brand narrative panel on the left', async ({ page }) => {
    await expect(page.getByText('Branded decks,')).toBeVisible();
    await expect(page.getByText('without the busywork.')).toBeVisible();
    await expect(page.getByText('Internal tool')).toBeVisible();
  });

  // ── Tab switching ─────────────────────────────────────────────────────────

  test('switching to Create account tab shows signup fields', async ({ page }) => {
    await page.getByRole('button', { name: 'Create account' }).first().click();
    await expect(page.getByRole('heading', { name: 'Join AutoDeck AI' })).toBeVisible();
    await expect(page.getByPlaceholder('Your full name')).toBeVisible();
    await expect(page.getByPlaceholder('Min. 8 characters')).toBeVisible();
    await expect(page.getByPlaceholder('Re-enter your password')).toBeVisible();
  });

  test('switching back to Sign in hides signup-only fields', async ({ page }) => {
    await page.getByRole('button', { name: 'Create account' }).first().click();
    await page.getByRole('button', { name: 'Sign in' }).first().click();
    await expect(page.getByPlaceholder('Your full name')).not.toBeVisible();
    await expect(page.getByPlaceholder('Re-enter your password')).not.toBeVisible();
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  });

  // ── Sign-in validation ────────────────────────────────────────────────────

  test('sign-in: empty form shows required error', async ({ page }) => {
    await page.locator('button[type="submit"]').click();
    await expect(page.getByText('Enter your email and password.')).toBeVisible();
  });

  test('sign-in: non-quidax.com email is rejected', async ({ page }) => {
    await page.getByPlaceholder('you@quidax.com').fill('user@gmail.com');
    await page.getByPlaceholder('Enter your password').fill('somepassword');
    await page.locator('button[type="submit"]').click();
    await expect(page.getByText('Only @quidax.com emails are allowed.')).toBeVisible();
  });

  test('sign-in: email without password shows required error', async ({ page }) => {
    await page.getByPlaceholder('you@quidax.com').fill('test@quidax.com');
    await page.locator('button[type="submit"]').click();
    await expect(page.getByText('Enter your email and password.')).toBeVisible();
  });

  test('sign-in: invalid Firebase credentials show a credential error', async ({ page }) => {
    await page.evaluate(() => {
      window.firebaseAuth.signInWithEmailAndPassword = () =>
        Promise.reject({ code: 'auth/invalid-credential', message: 'Invalid credentials' });
    });

    await page.getByPlaceholder('you@quidax.com').fill('test@quidax.com');
    await page.getByPlaceholder('Enter your password').fill('password123');
    await page.locator('button[type="submit"]').click();

    await expect(page.getByText('Incorrect email or password.')).toBeVisible();
  });

  test('sign-in: disabled Firebase account shows an actionable error', async ({ page }) => {
    await page.evaluate(() => {
      window.firebaseAuth.signInWithEmailAndPassword = () =>
        Promise.reject({ code: 'auth/user-disabled', message: 'User disabled' });
    });

    await page.getByPlaceholder('you@quidax.com').fill('admin@quidax.com');
    await page.getByPlaceholder('Enter your password').fill('password123');
    await page.locator('button[type="submit"]').click();

    await expect(page.getByText('This account is disabled in Firebase Auth. Ask an admin to re-enable it.')).toBeVisible();
  });

  test('sign-in: unknown Firebase auth errors include the Firebase code', async ({ page }) => {
    await page.evaluate(() => {
      window.firebaseAuth.signInWithEmailAndPassword = () =>
        Promise.reject({ code: 'auth/custom-blocked', message: 'Custom block' });
    });

    await page.getByPlaceholder('you@quidax.com').fill('admin@quidax.com');
    await page.getByPlaceholder('Enter your password').fill('password123');
    await page.locator('button[type="submit"]').click();

    await expect(page.getByText('Sign in failed (auth/custom-blocked). Check Firebase Auth for this account.')).toBeVisible();
  });

  // ── Sign-up validation ────────────────────────────────────────────────────

  test('sign-up: missing name shows error', async ({ page }) => {
    await page.getByRole('button', { name: 'Create account' }).first().click();
    await page.getByPlaceholder('you@quidax.com').fill('test@quidax.com');
    await page.locator('button[type="submit"]').click();
    await expect(page.getByText('Enter your name.')).toBeVisible();
  });

  test('sign-up: non-quidax.com email is rejected', async ({ page }) => {
    await page.getByRole('button', { name: 'Create account' }).first().click();
    await page.getByPlaceholder('Your full name').fill('Test User');
    await page.getByPlaceholder('you@quidax.com').fill('test@gmail.com');
    await page.locator('button[type="submit"]').click();
    await expect(page.getByText('Only @quidax.com emails are allowed.')).toBeVisible();
  });

  test('sign-up: password under 8 characters is rejected', async ({ page }) => {
    await page.getByRole('button', { name: 'Create account' }).first().click();
    await page.getByPlaceholder('Your full name').fill('Test User');
    await page.getByPlaceholder('you@quidax.com').fill('test@quidax.com');
    await page.getByPlaceholder('Min. 8 characters').fill('short');
    await page.locator('button[type="submit"]').click();
    await expect(page.getByText('Password must be 8+ characters.')).toBeVisible();
  });

  test('sign-up: mismatched passwords show error', async ({ page }) => {
    await page.getByRole('button', { name: 'Create account' }).first().click();
    await page.getByPlaceholder('Your full name').fill('Test User');
    await page.getByPlaceholder('you@quidax.com').fill('test@quidax.com');
    await page.getByPlaceholder('Min. 8 characters').fill('password123');
    await page.getByPlaceholder('Re-enter your password').fill('different456');
    await page.locator('button[type="submit"]').click();
    await expect(page.getByText('Passwords do not match.')).toBeVisible();
  });

  test('sign-up: tab switch clears previous errors', async ({ page }) => {
    await page.locator('button[type="submit"]').click();
    await expect(page.getByText('Enter your email and password.')).toBeVisible();
    await page.getByRole('button', { name: 'Create account' }).first().click();
    await expect(page.getByText('Enter your email and password.')).not.toBeVisible();
  });

  // ── Forgot password ───────────────────────────────────────────────────────

  test('forgot password: requires quidax email first', async ({ page }) => {
    await page.getByText('Forgot password?').click();
    await expect(page.getByText('Enter your @quidax.com email above first.')).toBeVisible();
  });

  test('forgot password: requires quidax domain specifically', async ({ page }) => {
    await page.getByPlaceholder('you@quidax.com').fill('user@gmail.com');
    await page.getByText('Forgot password?').click();
    await expect(page.getByText('Enter your @quidax.com email above first.')).toBeVisible();
  });

  // ── Google sign-in errors ────────────────────────────────────────────────

  test('google sign-in: existing password account gets actionable error', async ({ page }) => {
    await page.evaluate(() => {
      window.firebaseAuth.signInWithPopup = () =>
        Promise.reject({ code: 'auth/account-exists-with-different-credential', email: 'test@quidax.com' });
    });

    await page.getByRole('button', { name: 'Continue with Google' }).click();

    await expect(page.getByText('A password account already exists for test@quidax.com. Sign in with your password, or reset it if needed.')).toBeVisible();
  });

  test('google sign-in: password sign-in links pending Google credential', async ({ page }) => {
    await page.evaluate(() => {
      const credential = { providerId: 'google.com' };
      window.__linkedGoogleCredential = false;
      firebase.auth.GoogleAuthProvider.credentialFromError = () => credential;
      window.firebaseAuth.signInWithPopup = () =>
        Promise.reject({ code: 'auth/account-exists-with-different-credential', email: 'test@quidax.com' });
      window.firebaseAuth.signInWithEmailAndPassword = () => Promise.resolve({
        user: {
          email: 'test@quidax.com',
          uid: 'linked-user',
          displayName: 'Linked User',
          linkWithCredential: (receivedCredential) => {
            window.__linkedGoogleCredential = receivedCredential === credential;
            return Promise.resolve();
          },
        },
      });
    });

    await page.getByRole('button', { name: 'Continue with Google' }).click();
    await expect(page.getByText('A password account already exists for this email. Enter your password and sign in once to connect Google.')).toBeVisible();
    await expect(page.getByPlaceholder('you@quidax.com')).toHaveValue('test@quidax.com');

    await page.getByPlaceholder('Enter your password').fill('password123');
    await page.locator('button[type="submit"]').click();

    await expect.poll(() => page.evaluate(() => window.__linkedGoogleCredential)).toBe(true);
  });

  test('google sign-in: popup blocked falls back to redirect', async ({ page }) => {
    await page.evaluate(() => {
      window.__googleRedirectStarted = false;
      window.firebaseAuth.signInWithPopup = () => Promise.reject({ code: 'auth/popup-blocked' });
      window.firebaseAuth.signInWithRedirect = () => {
        window.__googleRedirectStarted = true;
        return new Promise(() => {});
      };
    });

    await page.getByRole('button', { name: 'Continue with Google' }).click();

    await expect.poll(() => page.evaluate(() => window.__googleRedirectStarted)).toBe(true);
  });

  test('google sign-in: 127 local host points users to localhost', async ({ page }) => {
    await page.goto('http://127.0.0.1:8081/', { waitUntil: 'domcontentloaded' });
    await waitForApp(page);
    await page.evaluate(() => {
      window.firebaseAuth.signInWithPopup = () => Promise.reject({ code: 'auth/unauthorized-domain' });
    });

    await page.getByRole('button', { name: 'Continue with Google' }).click();

    await expect(page.getByText('Local Google sign-in uses localhost. Open http://localhost:8081/ instead of 127.0.0.1, or add 127.0.0.1 in Firebase Auth settings.')).toBeVisible();
  });

  // ── Password visibility toggle ────────────────────────────────────────────

  test('password toggle changes input type', async ({ page }) => {
    const pwInput = page.getByPlaceholder('Enter your password');
    await expect(pwInput).toHaveAttribute('type', 'password');
    // The toggle is the only button directly next to the password input
    await pwInput.locator('..').locator('button').click();
    await expect(pwInput).toHaveAttribute('type', 'text');
    await pwInput.locator('..').locator('button').click();
    await expect(pwInput).toHaveAttribute('type', 'password');
  });
});
