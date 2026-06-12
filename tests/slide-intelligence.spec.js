const { test, expect } = require('@playwright/test');
const { waitForApp, setGenerationState } = require('./helpers');

const journeySlide = {
  title: 'Customer Journey',
  content: 'Users discover Quidax through social media, sign up, complete KYC, fund wallet, and begin trading.',
  bullets: [
    'Users discover Quidax through social media, sign up, complete KYC, fund wallet, and begin trading.',
  ],
};

test.describe('Slide Intelligence layer', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitForApp(page);
  });

  test('classifies a customer journey as a structured process flow', async ({ page }) => {
    const intelligence = await page.evaluate((slide) => (
      window.AutoDeckSlideIntelligence.enhanceSlide(slide, 1, 5)
    ), journeySlide);

    expect(intelligence).toMatchObject({
      title: 'Customer Journey',
      slideType: 'process_flow',
      layout: 'horizontal_step_flow',
      visualization: 'flowchart',
      needsIcons: true,
      needsChart: false,
      needsImage: false,
      renderLayout: 'process_flow',
    });
    expect(intelligence.components.map((component) => component.label)).toEqual([
      'Discover',
      'Sign Up',
      'Complete KYC',
      'Fund Wallet',
      'Begin Trading',
    ]);
  });

  test('renders the generated process flow template in slideshow mode', async ({ page }) => {
    await setGenerationState(page, {
      screen: 'slideshow',
      status: 'ready',
      config: {
        inputText: 'Create a customer journey deck for Quidax.',
        slideCount: '3',
        templateStyle: 'Professional',
      },
      slides: [journeySlide],
    });

    await expect(page.locator('#main-slide')).toBeVisible();
    await expect(page.getByText('Flow', { exact: true })).toBeVisible();
    await expect(page.getByText('Discover')).toBeVisible();
    await expect(page.getByText('Sign Up')).toBeVisible();
    await expect(page.getByText('Complete KYC')).toBeVisible();
  });

  test('legacy text layouts do not override visual intelligence', async ({ page }) => {
    await setGenerationState(page, {
      screen: 'slideshow',
      status: 'ready',
      config: {
        inputText: 'Create a customer journey deck for Quidax.',
        slideCount: '3',
        templateStyle: 'Professional',
      },
      slides: [{
        ...journeySlide,
        layout: 'standard',
        renderLayout: 'standard',
      }],
    });

    await expect(page.locator('#main-slide')).toBeVisible();
    await expect(page.getByText('Flow', { exact: true })).toBeVisible();
    await expect(page.getByText('Discover')).toBeVisible();
    await expect(page.getByText('Layout')).toBeVisible();
  });
});
