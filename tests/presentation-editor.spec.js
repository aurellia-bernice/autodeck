const { test, expect } = require('@playwright/test');
const { waitForApp, setGenerationState } = require('./helpers');

const legacySlides = [
  {
    title: 'Editable Legacy Slide',
    layout: 'standard',
    renderLayout: 'standard',
    bullets: ['First point', 'Second point'],
    imagePrompt: 'team workshop presentation',
  },
];

const objectSlides = [
  {
    title: 'Editable Object Slide',
    editorVersion: 2,
    objects: [
      { id: 'bg', type: 'shape', role: 'background', x: 0, y: 0, w: 100, h: 56.25, z: 0, locked: true, style: { fill: '#1A0530' } },
      { id: 'title', type: 'text', role: 'title', x: 7, y: 8, w: 70, h: 8, z: 10, content: 'Editable Object Slide', style: { fontSize: 30, bold: true, color: '#F6F1FB' } },
      { id: 'body', type: 'text', role: 'body', x: 8, y: 24, w: 72, h: 12, z: 11, content: 'First point\nSecond point', style: { fontSize: 16, bold: false, italic: false, align: 'left', color: '#F6F1FB' } },
    ],
  },
];

async function loadEditor(page, slides = legacySlides) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await waitForApp(page);
  await setGenerationState(page, {
    screen: 'slideshow',
    status: 'ready',
    config: {
      inputText: 'Editable presentation deck',
      slideCount: String(slides.length),
      templateStyle: 'Professional',
    },
    slides,
  });
  await expect(page.locator('#main-slide')).toBeVisible({ timeout: 8000 });
}

async function selectBodyObject(page) {
  const body = page.locator('[data-object-role="body"]').first();
  await expect(body).toBeVisible();
  await body.click();
  return body;
}

test.describe('Presentation object editor', () => {
  test('compiles generated legacy slides into editable slide objects', async ({ page }) => {
    await loadEditor(page);

    await expect(page.locator('#main-slide').getByRole('heading', { name: 'Editable Legacy Slide' })).toBeVisible();
    await expect(page.locator('#main-slide [data-object-type="text"]').first()).toBeVisible();
    const objectCount = await page.locator('#main-slide [data-object-type]').count();
    expect(objectCount).toBeGreaterThanOrEqual(5);

    const compiled = await page.evaluate(() => {
      return window.AutoDeckSlideObjects.ensureSlideObjects({
        title: 'Legacy',
        bullets: ['One', 'Two'],
        renderLayout: 'table_matrix',
      }, 0, 1).objects.map((obj) => obj.type);
    });
    expect(compiled).toEqual(expect.arrayContaining(['text', 'table', 'shape']));
  });

  test('edits text object content and applies font formatting controls', async ({ page }) => {
    await loadEditor(page, objectSlides);

    const title = page.locator('#main-slide').getByRole('heading', { name: 'Editable Object Slide' });
    await title.dblclick();
    await title.evaluate((el) => {
      el.textContent = 'Edited Title';
      el.blur();
    });
    await expect(page.locator('#main-slide').getByRole('heading', { name: 'Edited Title' })).toBeVisible();

    const body = await selectBodyObject(page);
    await expect(page.getByRole('complementary', { name: /Customize slide/i })).toBeVisible();
    await page.locator('input[type="number"]').fill('22');
    await page.getByRole('button', { name: 'B', exact: true }).click();
    await page.getByRole('button', { name: 'I', exact: true }).click();
    await page.getByRole('button', { name: '↔', exact: true }).click();

    const style = await body.evaluate((el) => {
      const computed = getComputedStyle(el);
      return {
        fontSize: computed.fontSize,
        fontStyle: computed.fontStyle,
        fontWeight: computed.fontWeight,
        textAlign: computed.textAlign,
      };
    });
    expect(style.fontSize).toBe('22px');
    expect(style.fontStyle).toBe('italic');
    expect(Number(style.fontWeight)).toBeGreaterThanOrEqual(600);
    expect(style.textAlign).toBe('center');
  });

  test('inserts and edits a manual table', async ({ page }) => {
    await loadEditor(page, objectSlides);

    await page.getByRole('button', { name: /Add/i }).click();
    await page.getByRole('button', { name: '⊞ Table Editable rows', exact: true }).click();
    await expect(page.locator('#main-slide').getByText('Column 1')).toBeVisible();

    const cell = page.locator('#main-slide').getByText('Row 1').first();
    await cell.click();
    await cell.evaluate((el) => {
      el.textContent = 'Edited row';
      el.blur();
    });
    await expect(page.locator('#main-slide').getByText('Edited row')).toBeVisible();
  });

  test('inserts an image placeholder and replaces it from mocked Unsplash results', async ({ page }) => {
    await loadEditor(page, objectSlides);
    await page.evaluate(() => {
      const app = firebase.app();
      app.functions = () => ({
        httpsCallable: () => async () => ({
          data: {
            images: [
              {
                id: 'mock-unsplash',
                src: 'https://images.unsplash.com/photo-mock-editor',
                thumb: 'https://images.unsplash.com/photo-mock-thumb',
                alt: 'Mock Unsplash photo',
                credit: 'Unsplash Creator',
                creditUrl: 'https://unsplash.com/@mock',
              },
            ],
          },
        }),
      });
    });

    await page.getByRole('button', { name: /Add/i }).click();
    await page.getByRole('button', { name: '▭ Image Search or upload', exact: true }).click();
    await expect(page.locator('#main-slide').getByText('Add image')).toBeVisible();
    await page.getByRole('button', { name: 'Search Unsplash' }).last().click();
    await page.getByRole('button', { name: /Use image Mock Unsplash photo/ }).click();

    await expect(page.locator('#main-slide').getByText('Unsplash Creator')).toBeVisible();
    await page.getByRole('button', { name: 'Clear' }).click();
    await expect(page.locator('#main-slide').getByText('Add image')).toBeVisible();
  });

  test('dragging and resizing updates object geometry on the stage', async ({ page }) => {
    await loadEditor(page, objectSlides);

    await page.getByRole('button', { name: /Add/i }).click();
    await page.getByRole('button', { name: 'T Text box Heading or body', exact: true }).click();
    const body = page.locator('[data-object-role="textbox"]').first();
    await expect(body).toBeVisible();
    await page.keyboard.press('Escape');
    await body.click();
    const before = await body.evaluate((el) => ({
      left: el.style.left,
      top: el.style.top,
      width: el.style.width,
      height: el.style.height,
    }));

    const box = await body.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2 + 40, { steps: 5 });
    await page.mouse.up();

    const afterMove = await body.evaluate((el) => ({ left: el.style.left, top: el.style.top }));
    expect(afterMove.left).not.toBe(before.left);
    expect(afterMove.top).not.toBe(before.top);

    const handle = page.getByLabel('Resize selected object');
    await expect(handle).toBeVisible();
    const handleBox = await handle.boundingBox();
    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(handleBox.x + handleBox.width / 2 + 70, handleBox.y + handleBox.height / 2 + 35, { steps: 5 });
    await page.mouse.up();

    const afterResize = await body.evaluate((el) => ({ width: el.style.width, height: el.style.height }));
    expect(afterResize.width).not.toBe(before.width);
    expect(afterResize.height).not.toBe(before.height);
  });

  test('pptx export uses native text image table and shape paths', async ({ page }) => {
    await loadEditor(page, [
      {
        title: 'Native export',
        editorVersion: 2,
        objects: [
          { id: 'bg', type: 'shape', role: 'background', x: 0, y: 0, w: 100, h: 56.25, z: 0, style: { fill: '#1A0530' } },
          { id: 'title', type: 'text', role: 'title', x: 7, y: 7, w: 60, h: 8, z: 10, content: 'Native export', style: { fontSize: 30, bold: true, color: '#F6F1FB' } },
          { id: 'image', type: 'image', role: 'image', x: 7, y: 18, w: 32, h: 20, z: 12, src: 'https://images.unsplash.com/photo-export', alt: 'Export image' },
          { id: 'table', type: 'table', role: 'table', x: 45, y: 18, w: 45, h: 20, z: 12, rows: [[{ text: 'Metric', style: { bold: true, fill: '#D5F953', color: '#232126' } }, { text: 'Value', style: { bold: true, fill: '#D5F953', color: '#232126' } }], [{ text: 'Users', style: {} }, { text: '42', style: {} }]] },
        ],
      },
    ]);

    await page.evaluate(() => {
      window.__pptxCalls = [];
      window.fetch = async () => new Response(new Blob(['mock-image'], { type: 'image/png' }), { status: 200 });
      window.PptxGenJS = function MockPptxGenJS() {
        this.ShapeType = { rect: 'rect', ellipse: 'ellipse' };
        this.addSlide = () => ({
          addShape: () => window.__pptxCalls.push('shape'),
          addImage: () => window.__pptxCalls.push('image'),
          addTable: () => window.__pptxCalls.push('table'),
          addText: () => window.__pptxCalls.push('text'),
          addNotes: () => window.__pptxCalls.push('notes'),
        });
        this.writeFile = async () => window.__pptxCalls.push('writeFile');
      };
    });

    await page.getByLabel('Export menu').click();
    await page.getByText('Download .pptx').click();
    await page.waitForFunction(() => window.__pptxCalls?.includes('writeFile'));

    const calls = await page.evaluate(() => window.__pptxCalls);
    expect(calls).toEqual(expect.arrayContaining(['shape', 'text', 'image', 'table', 'writeFile']));
  });
});
