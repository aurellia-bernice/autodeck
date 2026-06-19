const { test, expect } = require('@playwright/test');
const { waitForApp, setGenerationState } = require('./helpers');

const agentSlides = [
  {
    title: 'Opening Story',
    kicker: 'Opening',
    layout: 'standard',
    renderLayout: 'standard',
    bullets: ['Lead with the graduation moment', 'Set up the class journey'],
  },
  {
    title: 'About to Leave: A Graduation Story',
    kicker: 'Graduation',
    layout: 'standard',
    renderLayout: 'standard',
    bullets: ['A poem at the threshold of what comes next', 'The class carries shared memories forward'],
  },
  {
    title: 'Final Farewell',
    kicker: 'Close',
    layout: 'summary',
    renderLayout: 'summary',
    bullets: ['Leave with gratitude', 'Carry the school spirit forward'],
  },
];

const visualAgentSlides = [
  {
    title: 'We Need More Context to Build This Deck',
    kicker: 'Problem / Solution',
    layout: 'problem_solution',
    renderLayout: 'problem_solution',
    bullets: [
      'No source material supplied; theme alone cannot drive content',
      'Paste a brief, notes, data, or a document so content can be grounded',
    ],
    components: [
      {
        type: 'problem',
        label: 'No Source Material Supplied',
        icon: 'alert-triangle',
        items: ['Theme alone cannot drive content'],
      },
      {
        type: 'solution',
        label: 'Paste Your Brief',
        icon: 'check-circle',
        items: ['Use notes, data, or a document so content can be grounded'],
      },
    ],
  },
  agentSlides[1],
  agentSlides[2],
];

async function loadAgentDeck(page, slides = agentSlides) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await waitForApp(page);
  await setGenerationState(page, {
    screen: 'slideshow',
    status: 'ready',
    config: {
      inputText: 'Graduation poem deck for a class leaving.',
      slideCount: '3',
      templateStyle: 'Professional',
    },
    slides,
  });
  await expect(page.locator('#main-slide')).toBeVisible({ timeout: 8000 });

  await page.evaluate(() => {
    const app = firebase.app();
    app.functions = () => ({
      httpsCallable: () => async () => {
        throw new Error('offline test fallback');
      },
    });
  });
}

async function openAgent(page) {
  await page.getByRole('button', { name: /^Agent$/i }).click();
  await expect(page.getByText(/What should I change/i)).toBeVisible({ timeout: 5000 });
  return page.locator('textarea').last();
}

test.describe('Slide Agent editor', () => {
  test('updates the requested slide and changes its layout', async ({ page }) => {
    await loadAgentDeck(page);
    const input = await openAgent(page);

    await input.fill('make slide 2 split layout and add bullet about alumni memories');
    await input.press('Enter');

    await expect(page.getByText(/slide 2 updated and switched to Split layout/i)).toBeVisible({ timeout: 8000 });
    await expect(page.getByText('Agent · Slide 2')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByText('02 / 03').first()).toBeVisible();
    await expect(page.getByText('Split', { exact: true }).first()).toBeVisible();
    await expect(page.locator('#main-slide').getByText(/Alumni memories/i)).toBeVisible();
  });

  test('renames the current slide from an agent instruction', async ({ page }) => {
    await loadAgentDeck(page);
    const input = await openAgent(page);

    await input.fill('rename the title to "Graduation Begins Here"');
    await input.press('Enter');

    await expect(page.getByText(/slide 1 is updated/i)).toBeVisible({ timeout: 8000 });
    await page.keyboard.press('Escape');
    await expect(page.locator('#main-slide').getByRole('heading', { name: 'Graduation Begins Here' })).toBeVisible();
  });

  test('updates the visible content source for visual component layouts', async ({ page }) => {
    await loadAgentDeck(page, visualAgentSlides);
    const input = await openAgent(page);

    await input.fill('add more info');
    await input.press('Enter');

    await expect(page.getByText(/slide 1 is updated/i)).toBeVisible({ timeout: 8000 });
    await page.keyboard.press('Escape');
    await expect(page.getByText('Problem/Solution', { exact: true }).first()).toBeVisible();
    await expect(page.locator('#main-slide').getByText(/What this means/i)).toBeVisible();
    await expect(page.locator('#main-slide').getByText(/theme alone cannot drive content/i)).toBeVisible();
  });

  test('keeps prior chat history when the general Agent button is reopened', async ({ page }) => {
    await loadAgentDeck(page);
    const input = await openAgent(page);

    await input.fill('rename the title to "Graduation Begins Here"');
    await input.press('Enter');
    await expect(page.getByText(/slide 1 is updated/i)).toBeVisible({ timeout: 8000 });
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: /^Agent$/i }).click();
    await expect(page.getByText('rename the title to "Graduation Begins Here"')).toBeVisible();
    await expect(page.getByText(/slide 1 is updated/i)).toBeVisible();
  });

  test('starts a new chat from inside the Agent panel', async ({ page }) => {
    await loadAgentDeck(page);
    const input = await openAgent(page);

    await input.fill('rename the title to "Graduation Begins Here"');
    await input.press('Enter');
    await expect(page.getByText(/slide 1 is updated/i)).toBeVisible({ timeout: 8000 });

    await expect(page.getByRole('button', { name: /New chat/i })).toHaveCount(1);
    await page.getByRole('button', { name: /New chat/i }).click();

    await expect(page.getByText(/New chat started/i)).toBeVisible();
    await expect(page.getByText('rename the title to "Graduation Begins Here"')).not.toBeVisible();
    await expect(page.getByText(/slide 1 is updated/i)).not.toBeVisible();
  });

  test('restores previous chat history from the History button', async ({ page }) => {
    await loadAgentDeck(page);
    const input = await openAgent(page);

    await input.fill('rename the title to "Graduation Begins Here"');
    await input.press('Enter');
    await expect(page.getByText(/slide 1 is updated/i)).toBeVisible({ timeout: 8000 });

    await page.getByRole('button', { name: /New chat/i }).click();
    await expect(page.getByText('rename the title to "Graduation Begins Here"')).not.toBeVisible();

    await page.getByRole('button', { name: /History/i }).click();
    await expect(page.getByText(/Previous chats/i)).toBeVisible();
    await page.getByRole('button', { name: /rename the title to "Graduation Begins Here"/i }).click();
    await expect(page.getByText('rename the title to "Graduation Begins Here"')).toBeVisible();
    await expect(page.getByText(/slide 1 is updated/i)).toBeVisible();
  });

  test('shows multiple previous chats in History', async ({ page }) => {
    await loadAgentDeck(page);
    const input = await openAgent(page);

    await input.fill('rename the title to "Graduation Begins Here"');
    await input.press('Enter');
    await expect(page.getByText(/slide 1 is updated/i)).toBeVisible({ timeout: 8000 });
    await page.getByRole('button', { name: /New chat/i }).click();

    await input.fill('add bullet about alumni memories');
    await input.press('Enter');
    await expect(page.getByText(/slide 1 is updated/i)).toBeVisible({ timeout: 8000 });
    await page.getByRole('button', { name: /New chat/i }).click();

    await page.getByRole('button', { name: /History/i }).click();
    await expect(page.getByText(/Previous chats/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /rename the title to "Graduation Begins Here"/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /add bullet about alumni memories/i })).toBeVisible();
  });

  test('applies a requested layout even if the agent reply omits the layout patch', async ({ page }) => {
    await loadAgentDeck(page);
    await page.evaluate(() => {
      const app = firebase.app();
      app.functions = () => ({
        httpsCallable: () => async () => ({
          data: {
            assistantReply: 'Layout changes require manual adjustment in your presentation tool.',
          },
        }),
      });
    });
    const input = await openAgent(page);

    await input.fill('can this layout of slide 1 be split view');
    await input.press('Enter');

    await expect(page.getByText(/slide 1 is now using the Split layout/i)).toBeVisible({ timeout: 8000 });
    await page.keyboard.press('Escape');
    await expect(page.getByText('Split', { exact: true }).first()).toBeVisible();
  });

  test('asks for a clearer instruction instead of inventing slide content', async ({ page }) => {
    await loadAgentDeck(page);
    const input = await openAgent(page);

    await input.fill('help me improve this');
    await input.press('Enter');

    await expect(page.getByText(/need a clearer change/i)).toBeVisible({ timeout: 8000 });
    await page.keyboard.press('Escape');
    await expect(page.locator('#main-slide').getByText(/Clarify this point/i)).not.toBeVisible();
  });
});
