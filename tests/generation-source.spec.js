const { test, expect } = require('@playwright/test');
const { waitForApp, setGenerationState } = require('./helpers');

const config = {
  inputText: 'Create a deck from Geoffrey Hinton lecture notes about digital intelligence.',
  parsedFileText: 'Geoffrey Hinton compares digital and biological intelligence, then explains the risks and uncertainty around AI systems.',
  slideCount: '5',
  templateStyle: 'Professional',
};

const firebaseSlides = [
  {
    title: 'Hinton frames the intelligence gap',
    kicker: 'Storyline',
    contentType: 'opening',
    layout: 'bigTitle',
    bullets: [
      'Digital systems can share learning faster than biological brains',
      'The lecture treats capability and control as linked questions',
    ],
  },
  {
    title: 'The risk question becomes practical',
    kicker: 'Tension',
    contentType: 'risk',
    layout: 'split',
    bullets: [
      'The concern is not only whether AI becomes smarter',
      'The useful question is how humans keep direction and oversight',
    ],
  },
];

test.describe('Generation source workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitForApp(page);
  });

  test('exposes the patched frontend build and removes stale context-draft copy', async ({ page }) => {
    await setGenerationState(page, {
      screen: 'preview',
      status: 'ready',
      config,
      slides: firebaseSlides,
    });

    await expect(page.locator('[data-testid="build-id"]')).toContainText('gen-auth-2026-06-12');
    await expect(page.getByText('Ready · Firebase generated')).toBeVisible();
    await expect(page.locator('body')).not.toContainText('Ready · Context draft');
    await expect(page.locator('body')).not.toContainText('AI generation is taking longer than expected');
    await expect(page.locator('body')).not.toContainText('Showing a draft from your content');
  });

  test('successful generation renders the Firebase slides as the preview source', async ({ page }) => {
    await setGenerationState(page, {
      screen: 'preview',
      status: 'ready',
      config,
      slides: firebaseSlides,
    });

    await expect(page.getByText('Ready · Firebase generated')).toBeVisible();
    await expect(page.getByText('Hinton frames the intelligence gap')).toBeVisible();
    await expect(page.getByText('The risk question becomes practical')).toBeVisible();
    await expect(page.getByRole('button', { name: /Open slideshow/i })).toBeVisible();
    await expect(page.getByText('Ready · Demo preview')).not.toBeVisible();
  });

  test('slow generation stays on processing instead of showing local draft slides', async ({ page }) => {
    await setGenerationState(page, {
      screen: 'processing',
      status: 'loading',
      error: 'AI generation is still running in Firebase. Keeping this screen open until generated slides are ready.',
      deckId: 'deck123456789',
      trace: {
        stage: 'calling-generateDeck',
        deckId: 'deck123456789',
        startedAt: Date.now() - 2000,
        deadlineAt: Date.now() + 133000,
      },
      config,
      slides: [],
    });

    await expect(page.getByText(/Still generating in Firebase/i)).toBeVisible();
    await expect(page.getByText(/Deck deck1234/i)).toBeVisible();
    await expect(page.getByText(/Calling generateDeck/i)).toBeVisible();
    await expect(page.getByText(/s elapsed/i)).toBeVisible();
    await expect(page.getByText(/s left/i)).toBeVisible();
    await expect(page.getByText(/AI generation is still running in Firebase/i)).toBeVisible();
    await expect(page.locator('body')).not.toContainText('Ready · Context draft');
    await expect(page.locator('body')).not.toContainText('Showing a draft from your content');
  });

  test('local debug getter exposes the active generation trace', async ({ page }) => {
    await setGenerationState(page, {
      screen: 'processing',
      status: 'loading',
      error: 'Waiting for Firebase.',
      deckId: 'deckdebug123',
      trace: {
        stage: 'calling-generateDeck',
        deckId: 'deckdebug123',
        startedAt: 1000,
        deadlineAt: 136000,
      },
      config,
      slides: [],
    });

    const debug = await page.evaluate(() => window.__autodeck_generation_debug?.());
    expect(debug).toMatchObject({
      buildId: 'gen-auth-2026-06-12',
      screen: 'processing',
      generationStatus: 'loading',
      generationError: 'Waiting for Firebase.',
      activeDeckId: 'deckdebug123',
      requestedSlides: '5',
      templateStyle: 'Professional',
      sourceUploadsEnabled: false,
      generatedSlideCount: 0,
    });
    expect(debug.generationTrace).toMatchObject({
      stage: 'calling-generateDeck',
      deckId: 'deckdebug123',
    });
  });


  test('failed generation shows a no-slides error state without local draft content', async ({ page }) => {
    await setGenerationState(page, {
      screen: 'preview',
      status: 'error',
      error: 'Generation failed in Firebase.',
      deckId: 'deckfailed123',
      trace: { stage: 'firestore-error', deckId: 'deckfailed123' },
      config,
      slides: [],
    });

    await expect(page.getByText('No local draft was used')).toBeVisible();
    await expect(page.getByText('Generated slides were not returned.')).toBeVisible();
    await expect(page.getByText('Generation failed in Firebase.')).toBeVisible();
    await expect(page.getByText('Deck deckfailed123')).toBeVisible();
    await expect(page.getByText('Stage firestore-error')).toBeVisible();
    await expect(page.getByRole('button', { name: /Open slideshow/i })).not.toBeVisible();
    await expect(page.locator('body')).not.toContainText('Executive Summary');
  });
});
