const { expect } = require('@playwright/test');

// Opens the tweaks panel and navigates to a named screen, then closes the panel.
// Works without real Firebase auth — the screen renders regardless of auth state.
async function goToScreen(page, screenValue) {
  await page.evaluate(() =>
    window.postMessage({ type: '__activate_edit_mode' }, '*')
  );
  await expect(page.locator('.twk-panel')).toBeVisible();
  await page.locator('select.twk-field').selectOption(screenValue);
  await page.evaluate(() =>
    window.postMessage({ type: '__deactivate_edit_mode' }, '*')
  );
  await expect(page.locator('.twk-panel')).not.toBeVisible();
}

// Waits for the React app to finish its initial render (Firebase auth listener fires).
async function waitForApp(page) {
  // 'load' fires once all resources are fetched. 'networkidle' is avoided because
  // Firebase Auth holds a persistent connection that prevents idle from ever being reached,
  // which caused every test to timeout in CI.
  await page.waitForLoadState('load');
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible({ timeout: 10000 });
}

module.exports = { goToScreen, waitForApp };
