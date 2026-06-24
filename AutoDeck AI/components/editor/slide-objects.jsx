// ============================================================
// Slide Object Composer
// Converts legacy slide outlines into an editable object model.
// Keep browser and functions copies in sync.
// ============================================================

(function attachSlideObjects(global, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (global) global.AutoDeckSlideObjects = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createSlideObjects() {
  const EDITOR_VERSION = 2;
  const OBJECT_VISUAL_VERSION = 2;
  const SLIDE_W = 100;
  const SLIDE_H = 56.25;
  const DEFAULT_DISPLAY_FONT = '"Uncut Sans", "Inter", system-ui, sans-serif';
  const DEFAULT_BODY_FONT = '"Uncut Sans", "Inter", system-ui, sans-serif';

  const clamp = (value, min, max, fallback) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, n));
  };

  const compactText = (value) => String(value || '').replace(/\s+/g, ' ').trim();
  const trimWords = (value, maxWords = 22) => compactText(value).split(/\s+/).filter(Boolean).slice(0, maxWords).join(' ');
  const objectId = (slideIndex, role, n = 0) => `s${slideIndex + 1}-${role}-${n}`;
  const zSort = (objects) => [...objects].sort((a, b) => (a.z || 0) - (b.z || 0));

  const displayRoles = new Set(['title', 'quote', 'kpi-value']);
  const defaultFontForRole = (role) => displayRoles.has(role) ? DEFAULT_DISPLAY_FONT : DEFAULT_BODY_FONT;

  const textObject = (slideIndex, role, content, box, style = {}, n = 0) => ({
    id: objectId(slideIndex, role, n),
    type: 'text',
    role,
    content: String(content || ''),
    x: box.x,
    y: box.y,
    w: box.w,
    h: box.h,
    z: box.z || 10,
    locked: false,
    style: {
      fontFamily: style.fontFamily || defaultFontForRole(role),
      fontSize: clamp(style.fontSize, 6, 120, role === 'title' ? 34 : 16),
      bold: style.bold !== undefined ? !!style.bold : role === 'title',
      italic: !!style.italic,
      align: style.align || 'left',
      color: style.color || '#F6F1FB',
      lineHeight: style.lineHeight || 1.18,
      ...style,
    },
  });

  const shapeObject = (slideIndex, role, box, style = {}, n = 0) => ({
    id: objectId(slideIndex, role, n),
    type: 'shape',
    role,
    x: box.x,
    y: box.y,
    w: box.w,
    h: box.h,
    z: box.z || 0,
    locked: false,
    style: {
      shape: style.shape || 'rect',
      fill: style.fill || '#1A0530',
      stroke: style.stroke || 'transparent',
      strokeWidth: clamp(style.strokeWidth, 0, 8, 0),
      radius: clamp(style.radius, 0, 24, 0),
      opacity: clamp(style.opacity, 0, 1, 1),
      ...style,
    },
  });

  const imageObject = (slideIndex, role, image = {}, box, n = 0) => ({
    id: objectId(slideIndex, role, n),
    type: 'image',
    role,
    x: box.x,
    y: box.y,
    w: box.w,
    h: box.h,
    z: box.z || 5,
    locked: false,
    src: image.src || image.url || image.path || '',
    prompt: image.prompt || image.imagePrompt || '',
    alt: image.alt || image.prompt || image.imagePrompt || '',
    credit: image.credit || '',
    creditUrl: image.creditUrl || '',
    fit: image.fit || 'cover',
    style: {
      fill: image.src || image.url || image.path ? 'transparent' : '#3C0076',
      stroke: image.src || image.url || image.path ? 'transparent' : '#B890FE',
      radius: image.radius === undefined ? 4 : image.radius,
    },
  });

  const normalizeCell = (value, header = false) => {
    if (value && typeof value === 'object') {
      return {
        text: compactText(value.text || value.content || value.label || ''),
        style: {
          bold: header || value.style?.bold === true || value.bold === true,
          italic: value.style?.italic === true || value.italic === true,
          align: value.style?.align || value.align || 'left',
          color: value.style?.color || value.color || (header ? '#1A0530' : '#F6F1FB'),
          fill: value.style?.fill || value.fill || (header ? '#D5F953' : 'rgba(246,241,251,0.06)'),
        },
      };
    }
    return {
      text: compactText(value),
      style: {
        bold: header,
        italic: false,
        align: 'left',
        color: header ? '#1A0530' : '#F6F1FB',
        fill: header ? '#D5F953' : 'rgba(246,241,251,0.06)',
      },
    };
  };

  const tableObject = (slideIndex, role, rows, box, style = {}, n = 0) => {
    const safeRows = Array.isArray(rows) && rows.length ? rows : [
      ['Column 1', 'Column 2'],
      ['Add detail', 'Add detail'],
      ['Add detail', 'Add detail'],
    ];
    return {
      id: objectId(slideIndex, role, n),
      type: 'table',
      role,
      x: box.x,
      y: box.y,
      w: box.w,
      h: box.h,
      z: box.z || 12,
      locked: false,
      rows: safeRows.map((row, rowIndex) => {
        const cells = Array.isArray(row) ? row : [row];
        return cells.map((cell) => normalizeCell(cell, rowIndex === 0));
      }),
      style: {
        fontFamily: style.fontFamily || DEFAULT_BODY_FONT,
        fontSize: clamp(style.fontSize, 7, 32, 11),
        borderColor: style.borderColor || 'rgba(246,241,251,0.16)',
        headerFill: style.headerFill || '#D5F953',
        cellFill: style.cellFill || 'rgba(246,241,251,0.06)',
        ...style,
      },
    };
  };

  const normalizeObject = (obj = {}, index = 0, fallbackZ = 0) => {
    const type = ['text', 'image', 'table', 'shape'].includes(obj.type) ? obj.type : 'text';
    const minSize = type === 'shape' ? 0.1 : 1;
    const base = {
      id: compactText(obj.id) || objectId(index, obj.role || type, fallbackZ),
      type,
      role: compactText(obj.role || type),
      x: clamp(obj.x, 0, SLIDE_W, 8),
      y: clamp(obj.y, 0, SLIDE_H, 8),
      w: clamp(obj.w, minSize, SLIDE_W, 30),
      h: clamp(obj.h, minSize, SLIDE_H, 8),
      z: clamp(obj.z, -1000, 1000, fallbackZ),
      locked: obj.locked === true,
      style: { ...(obj.style || {}) },
    };

    if (type === 'text') {
      return {
        ...base,
        content: String(obj.content || obj.text || ''),
        style: {
          fontFamily: obj.style?.fontFamily || defaultFontForRole(base.role),
          fontSize: clamp(obj.style?.fontSize, 6, 120, 16),
          bold: obj.style?.bold === true,
          italic: obj.style?.italic === true,
          align: ['left', 'center', 'right'].includes(obj.style?.align) ? obj.style.align : 'left',
          color: obj.style?.color || '#F6F1FB',
          lineHeight: obj.style?.lineHeight || 1.2,
          ...obj.style,
        },
      };
    }
    if (type === 'image') {
      return {
        ...base,
        src: String(obj.src || ''),
        prompt: String(obj.prompt || ''),
        alt: String(obj.alt || ''),
        credit: String(obj.credit || ''),
        creditUrl: String(obj.creditUrl || ''),
        fit: obj.fit || 'cover',
      };
    }
    if (type === 'table') {
      return {
        ...base,
        rows: (Array.isArray(obj.rows) && obj.rows.length ? obj.rows : [['Column 1', 'Column 2'], ['Add detail', 'Add detail']])
          .map((row, rowIndex) => (Array.isArray(row) ? row : [row]).map((cell) => normalizeCell(cell, rowIndex === 0))),
        style: {
          fontFamily: obj.style?.fontFamily || DEFAULT_BODY_FONT,
          fontSize: clamp(obj.style?.fontSize, 7, 32, 11),
          borderColor: obj.style?.borderColor || 'rgba(246,241,251,0.16)',
          headerFill: obj.style?.headerFill || '#D5F953',
          cellFill: obj.style?.cellFill || 'rgba(246,241,251,0.06)',
          ...obj.style,
        },
      };
    }
    return base;
  };

  const slideColors = (slide = {}) => {
    const light = slide.theme === 'soft';
    return {
      bg: light ? '#FAF7FF' : '#1A0530',
      panel: light ? '#FFFFFF' : '#2D0F4E',
      panelAlt: light ? '#F3E8FF' : '#3A0A67',
      title: light ? '#232126' : '#F6F1FB',
      text: light ? '#4A484D' : '#E8DDF4',
      muted: light ? '#6B5F76' : 'rgba(246,241,251,0.72)',
      accent: light ? '#6100A5' : '#D5F953',
      rule: light ? 'rgba(97,0,165,0.18)' : 'rgba(246,241,251,0.18)',
    };
  };

  const visualItemsFor = (slide = {}) => {
    const components = Array.isArray(slide.components)
      ? slide.components.filter((item) => item && (item.label || item.value || item.items?.length))
      : [];
    if (components.length) return components.slice(0, 6);
    return (Array.isArray(slide.bullets) ? slide.bullets : []).map((bullet, i) => ({
      type: 'item',
      label: bullet,
      detail: '',
      level: i + 1,
    })).slice(0, 6);
  };

  const tableRowsFromSlide = (slide = {}) => {
    if (Array.isArray(slide.tableRows) && slide.tableRows.length) return slide.tableRows;
    const items = visualItemsFor(slide);
    const comparison = items.filter((item) => item.type === 'comparison_column');
    if (comparison.length >= 2) {
      const left = comparison[0];
      const right = comparison[1];
      const leftItems = Array.isArray(left.items) ? left.items : [left.detail || left.label];
      const rightItems = Array.isArray(right.items) ? right.items : [right.detail || right.label];
      const count = Math.max(leftItems.length, rightItems.length, 2);
      return [
        [left.label || 'Current', right.label || 'Future'],
        ...Array.from({ length: count }, (_, i) => [leftItems[i] || '', rightItems[i] || '']),
      ];
    }
    if (items.length >= 2) {
      return [
        ['Item', 'Detail'],
        ...items.map((item) => [item.label || item.value || 'Item', item.detail || (Array.isArray(item.items) ? item.items.join('; ') : '') || '']),
      ];
    }
    const bullets = Array.isArray(slide.bullets) ? slide.bullets : [];
    return [
      ['Topic', 'Detail'],
      ...bullets.slice(0, 5).map((bullet, i) => [`Point ${i + 1}`, bullet]),
    ];
  };

  const itemLabel = (item = {}, fallback = '') => compactText(item.label || item.value || item.title || item.name || fallback);
  const itemDetail = (item = {}) => compactText(item.detail || item.description || item.content || item.summary || '');
  const itemPoints = (item = {}) => {
    if (Array.isArray(item.items) && item.items.length) return item.items.map(compactText).filter(Boolean);
    const detail = itemDetail(item);
    return detail ? [detail] : [];
  };

  const titleBlock = (objects, index, title, c, eyebrow, maxW = 72) => {
    objects.push(textObject(index, 'eyebrow', eyebrow, { x: 7, y: 7.1, w: 42, h: 2.2, z: 12 }, {
      fontFamily: DEFAULT_BODY_FONT,
      fontSize: 8.5,
      bold: true,
      color: c.accent,
      letterSpacing: '0.22em',
    }));
    objects.push(textObject(index, 'title', title, { x: 7, y: 10.5, w: maxW, h: 8.8, z: 12 }, {
      fontSize: 33,
      color: c.title,
      bold: true,
      lineHeight: 1.05,
    }));
  };

  const addCardObjects = (objects, index, item, i, box, c, options = {}) => {
    const accent = options.accent === true;
    const label = itemLabel(item, `${options.labelPrefix || 'Item'} ${i + 1}`);
    const detail = itemDetail(item);
    const fg = accent ? '#232126' : c.title;
    const tx = accent ? 'rgba(35,33,38,0.78)' : c.muted;
    objects.push(shapeObject(index, options.role || 'card', box, {
      fill: accent ? c.accent : c.panel,
      stroke: accent ? c.accent : c.rule,
      radius: options.radius === undefined ? 6 : options.radius,
      opacity: accent ? 1 : 0.92,
    }, i));
    objects.push(textObject(index, `${options.role || 'card'}-meta`, options.meta || String(i + 1).padStart(2, '0'), { x: box.x + 1.8, y: box.y + 1.5, w: 9, h: 2.4, z: box.z + 6 }, {
      fontFamily: DEFAULT_BODY_FONT,
      fontSize: 8.5,
      bold: true,
      color: accent ? '#232126' : c.accent,
      letterSpacing: '0.12em',
    }, i));
    objects.push(textObject(index, `${options.role || 'card'}-title`, trimWords(label, options.titleWords || 10), { x: box.x + 1.8, y: box.y + 5.1, w: box.w - 3.6, h: detail ? 4.6 : box.h - 6.2, z: box.z + 7 }, {
      fontSize: options.titleSize || 13,
      bold: true,
      color: fg,
      lineHeight: 1.16,
    }, i));
    if (detail) {
      objects.push(textObject(index, `${options.role || 'card'}-detail`, trimWords(detail, options.detailWords || 18), { x: box.x + 1.8, y: box.y + 10.2, w: box.w - 3.6, h: box.h - 11.7, z: box.z + 7 }, {
        fontSize: options.detailSize || 10.5,
        bold: false,
        color: tx,
        lineHeight: 1.28,
      }, i));
    }
  };

  const imageDataFromSlide = (slide = {}) => ({
    src: slide.image?.src || slide.imageUrl || slide.imageSrc || '',
    prompt: slide.image?.prompt || slide.imagePrompt || slide.title || '',
    alt: slide.image?.alt || slide.imagePrompt || slide.title || '',
    credit: slide.image?.credit || '',
    creditUrl: slide.image?.creditUrl || '',
  });

  const shouldHaveImage = (slide = {}) => Boolean(
    slide.needsImage ||
    slide.imagePrompt ||
    slide.layout === 'image' ||
    slide.renderLayout === 'image' ||
    slide.slideType === 'image_focus' ||
    slide.renderLayout === 'image_focus'
  );

  const composeLegacyObjects = (slide = {}, index = 0, total = 1) => {
    const layout = slide.renderLayout || slide.layout || 'standard';
    const c = slideColors(slide);
    const objects = [
      shapeObject(index, 'background', { x: 0, y: 0, w: 100, h: 56.25, z: 0 }, { fill: c.bg }),
      textObject(index, 'brand', 'QUIDAX', { x: 3.2, y: 2.2, w: 14, h: 2.4, z: 80 }, {
        fontFamily: DEFAULT_BODY_FONT,
        fontSize: 7,
        bold: true,
        color: c.accent,
        align: 'left',
      }),
      textObject(index, 'slide-number', String(index + 1).padStart(2, '0'), { x: 90, y: 2.2, w: 6, h: 2.4, z: 80 }, {
        fontFamily: DEFAULT_BODY_FONT,
        fontSize: 7,
        color: c.title,
        align: 'right',
      }),
      textObject(index, 'footer', `Internal | Confidential | ${String(index + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`, { x: 3.2, y: 52.1, w: 44, h: 2, z: 80 }, {
        fontFamily: DEFAULT_BODY_FONT,
        fontSize: 6,
        color: c.text,
      }),
    ];

    const title = slide.title || 'Untitled slide';
    const bullets = Array.isArray(slide.bullets) ? slide.bullets.filter(Boolean) : [];
    const image = imageDataFromSlide(slide);

    if (layout === 'table_matrix') {
      titleBlock(objects, index, title, c, 'Editable table matrix', 76);
      objects.push(tableObject(index, 'table', tableRowsFromSlide(slide), { x: 7, y: 21, w: 86, h: 26, z: 20 }, {
        fontFamily: DEFAULT_BODY_FONT,
        fontSize: 11,
      }));
      return zSort(objects);
    }

    if (layout === 'image_focus') {
      objects.push(imageObject(index, 'hero-image', image, { x: 0, y: 0, w: 100, h: 56.25, z: 2 }));
      objects.push(shapeObject(index, 'image-overlay', { x: 0, y: 0, w: 58, h: 56.25, z: 3 }, { fill: '#000000', opacity: 0.55 }));
      objects.push(textObject(index, 'kicker', slide.kicker || 'Image focus', { x: 6, y: 26, w: 36, h: 3, z: 20 }, { fontFamily: DEFAULT_BODY_FONT, fontSize: 8, bold: true, color: c.accent }));
      objects.push(textObject(index, 'title', title, { x: 6, y: 30, w: 46, h: 12, z: 20 }, { fontSize: 38, color: '#FFFFFF', bold: true }));
      if (bullets[0]) objects.push(textObject(index, 'body', bullets.slice(0, 2).join('\n'), { x: 6, y: 43, w: 43, h: 7, z: 20 }, { fontSize: 13, color: '#FFFFFF', bold: false }));
      return zSort(objects);
    }

    if (layout === 'image') {
      objects.push(imageObject(index, 'image', image, { x: 6, y: 10, w: 47, h: 36, z: 8 }));
      objects.push(textObject(index, 'eyebrow', slide.kicker || 'Image-led story', { x: 58, y: 12, w: 32, h: 2.3, z: 12 }, { fontSize: 8.5, bold: true, color: c.accent, letterSpacing: '0.22em' }));
      objects.push(textObject(index, 'title', title, { x: 58, y: 15.5, w: 34, h: 10.5, z: 12 }, { fontSize: 30, color: c.title, bold: true, lineHeight: 1.05 }));
      objects.push(textObject(index, 'body', bullets.join('\n'), { x: 58, y: 28, w: 34, h: 16, z: 12 }, { fontSize: 15, color: c.text, bold: false, lineHeight: 1.35 }));
      return zSort(objects);
    }

    if (layout === 'split' || layout === 'comparison' || layout === 'problem_solution') {
      if (layout === 'comparison' || layout === 'problem_solution') {
        titleBlock(objects, index, title, c, layout === 'problem_solution' ? 'Problem / solution' : 'Comparison', 76);
        const items = visualItemsFor(slide);
        const comparisonItems = items.filter((item) => item.type === 'comparison_column');
        const columns = layout === 'problem_solution'
          ? [
              items.find((item) => item.type === 'problem') || { label: 'Problem', detail: bullets[0] || '' },
              items.find((item) => item.type === 'solution') || { label: 'Solution', detail: bullets[1] || bullets[0] || '' },
            ]
          : (comparisonItems.length >= 2 ? comparisonItems.slice(0, 2) : [
              { label: 'Current', items: bullets.slice(0, Math.ceil(bullets.length / 2)) },
              { label: 'Future', items: bullets.slice(Math.ceil(bullets.length / 2)) },
            ]);
        columns.slice(0, 2).forEach((item, i) => {
          const x = i === 0 ? 7 : 55;
          const accent = i === 1;
          addCardObjects(objects, index, item, i, { x, y: 24, w: 38, h: 18, z: 8 }, c, {
            role: i === 0 ? 'comparison-left' : 'comparison-right',
            accent,
            meta: i === 0 ? (layout === 'problem_solution' ? '01 PROBLEM' : '01 BEFORE') : (layout === 'problem_solution' ? '02 SOLUTION' : '02 AFTER'),
            titleWords: 8,
            titleSize: 16,
            detailSize: 12,
          });
          const points = Array.isArray(item.items) ? itemPoints(item) : [];
          points.slice(0, 3).forEach((point, pi) => {
            objects.push(textObject(index, `comparison-point-${i}`, `${String(pi + 1).padStart(2, '0')}  ${trimWords(point, 12)}`, { x: x + 2, y: 34.7 + pi * 3.4, w: 34, h: 2.6, z: 24 }, {
              fontFamily: DEFAULT_BODY_FONT,
              fontSize: 10.5,
              bold: false,
              color: accent ? 'rgba(35,33,38,0.78)' : c.muted,
              lineHeight: 1.15,
            }, pi + (i * 10)));
          });
        });
        objects.push(shapeObject(index, 'comparison-arrow-ring', { x: 47.2, y: 30.2, w: 5.6, h: 5.6, z: 20 }, { shape: 'ellipse', fill: c.bg, stroke: c.rule, strokeWidth: 1, opacity: 1 }));
        objects.push(textObject(index, 'comparison-arrow', '→', { x: 47.2, y: 30.5, w: 5.6, h: 4, z: 24 }, { fontSize: 22, bold: true, align: 'center', color: c.accent, lineHeight: 1 }));
        return zSort(objects);
      }
      objects.push(textObject(index, 'eyebrow', slide.kicker || 'Section', { x: 6, y: 16, w: 30, h: 2.3, z: 12 }, { fontSize: 8.5, bold: true, color: c.accent, letterSpacing: '0.22em' }));
      objects.push(textObject(index, 'title', title, { x: 6, y: 19.5, w: 39, h: 14, z: 12 }, { fontSize: 34, color: c.title, bold: true, lineHeight: 1.05 }));
      objects.push(shapeObject(index, 'split-rule', { x: 49, y: 14, w: 0.12, h: 31, z: 10 }, { fill: c.rule, opacity: 1 }));
      objects.push(textObject(index, 'body', bullets.join('\n'), { x: 54, y: 17, w: 38, h: 24, z: 12 }, { fontSize: 16, color: c.text, bold: false, lineHeight: 1.45 }));
      return zSort(objects);
    }

    if (layout === 'statistics') {
      objects.push(textObject(index, 'title', title, { x: 7, y: 7, w: 70, h: 8, z: 12 }, { fontSize: 29, color: c.title, bold: true }));
      visualItemsFor(slide).slice(0, 4).forEach((item, i) => {
        const x = 7 + i * 22;
        const value = item.value || compactText(item.label).match(/(?:[$#])?\d+(?:\.\d+)?\s*(?:%|x|M|K|B|bn|m)?/i)?.[0] || String(i + 1).padStart(2, '0');
        objects.push(shapeObject(index, 'kpi-card', { x, y: 22, w: 18, h: 16, z: 8 }, { fill: i === 0 ? c.accent : c.panel, stroke: c.rule, radius: 6, opacity: i === 0 ? 1 : 0.9 }, i));
        objects.push(textObject(index, 'kpi-value', value, { x: x + 1.5, y: 24, w: 15, h: 6, z: 14 }, { fontSize: 31, bold: true, color: i === 0 ? '#232126' : c.accent, lineHeight: 0.95 }, i));
        objects.push(textObject(index, 'kpi-label', compactText(item.label).replace(value, '').trim() || item.detail || 'Metric', { x: x + 1.5, y: 32.4, w: 15, h: 5, z: 14 }, { fontSize: 11, bold: false, color: i === 0 ? '#232126' : c.text, lineHeight: 1.25 }, i));
      });
      return zSort(objects);
    }

    if (layout === 'process_flow') {
      titleBlock(objects, index, title, c, 'Process flow', 76);
      const items = visualItemsFor(slide);
      const steps = items.slice(0, 5);
      const count = Math.max(1, steps.length);
      const gap = count > 1 ? 3.2 : 0;
      const cardW = Math.min(22, (86 - gap * (count - 1)) / count);
      const startX = 7 + (86 - (cardW * count + gap * (count - 1))) / 2;
      steps.forEach((item, i) => {
        const x = startX + i * (cardW + gap);
        addCardObjects(objects, index, item, i, { x, y: 25, w: cardW, h: 16.5, z: 8 }, c, {
          role: 'step-card',
          accent: i === 0,
          meta: `STEP ${String(i + 1).padStart(2, '0')}`,
          titleWords: 9,
          titleSize: 12.5,
          detailSize: 10,
        });
        if (i < count - 1) {
          objects.push(textObject(index, 'flow-arrow', '→', { x: x + cardW + 0.3, y: 31.2, w: gap - 0.6, h: 3.5, z: 24 }, { fontSize: 20, bold: true, align: 'center', color: c.accent, lineHeight: 1 }, i));
        }
      });
      return zSort(objects);
    }

    if (layout === 'timeline' || layout === 'roadmap') {
      titleBlock(objects, index, title, c, layout === 'roadmap' ? 'Roadmap' : 'Timeline', 76);
      const items = visualItemsFor(slide).slice(0, 5);
      const count = Math.max(1, items.length);
      objects.push(shapeObject(index, 'timeline-rule', { x: 9, y: 30, w: 82, h: 0.12, z: 8 }, { fill: c.rule, opacity: 1 }));
      items.forEach((item, i) => {
        const x = count === 1 ? 47 : 9 + i * (82 / (count - 1));
        objects.push(shapeObject(index, 'timeline-dot', { x: x - 1.8, y: 28.2, w: 3.6, h: 3.6, z: 12 }, { shape: 'ellipse', fill: i === 0 ? c.accent : c.bg, stroke: i === 0 ? c.accent : c.rule, strokeWidth: 1, opacity: 1 }, i));
        objects.push(textObject(index, 'timeline-label', itemLabel(item, layout === 'roadmap' ? `Phase ${i + 1}` : `Moment ${i + 1}`), { x: Math.max(5, Math.min(79, x - 7)), y: i % 2 ? 34 : 21.5, w: 15, h: 4.8, z: 14 }, { fontSize: 11.5, bold: true, color: c.title, align: 'center', lineHeight: 1.2 }, i));
        const detail = itemDetail(item) || bullets[i] || '';
        if (detail) objects.push(textObject(index, 'timeline-detail', trimWords(detail, 12), { x: Math.max(5, Math.min(79, x - 7)), y: i % 2 ? 39.2 : 18.1, w: 15, h: 3.2, z: 14 }, { fontSize: 9.5, color: c.muted, align: 'center', lineHeight: 1.2 }, i));
      });
      return zSort(objects);
    }

    if (layout === 'hierarchy') {
      titleBlock(objects, index, title, c, 'Hierarchy', 76);
      const items = visualItemsFor(slide);
      const topNode = items[0] || { label: title };
      addCardObjects(objects, index, topNode, 0, { x: 31, y: 22, w: 38, h: 11, z: 8 }, c, { role: 'hierarchy-top', accent: true, meta: 'TOP LEVEL', titleSize: 15 });
      objects.push(shapeObject(index, 'hierarchy-stem', { x: 49.9, y: 33.2, w: 0.12, h: 4, z: 8 }, { fill: c.rule }));
      const children = (items.length > 1 ? items.slice(1, 4) : bullets.slice(0, 3).map((bullet) => ({ label: bullet })));
      if (children.length > 1) objects.push(shapeObject(index, 'hierarchy-rail', { x: 24, y: 37.1, w: 52, h: 0.12, z: 8 }, { fill: c.rule }));
      children.forEach((item, i) => {
        const x = 12 + i * 29;
        objects.push(shapeObject(index, 'hierarchy-branch', { x: x + 12, y: 37.1, w: 0.12, h: 0.9, z: 8 }, { fill: c.rule }, i));
        addCardObjects(objects, index, item, i + 1, { x, y: 38, w: 24, h: 10.5, z: 8 }, c, { role: 'hierarchy-card', meta: `LEVEL ${i + 2}`, titleSize: 11.5, detailSize: 9.5 });
      });
      return zSort(objects);
    }

    if (layout === 'feature_breakdown' || layout === 'summary') {
      titleBlock(objects, index, title, c, layout === 'summary' ? 'Key takeaways' : 'Feature breakdown', 76);
      const items = visualItemsFor(slide).slice(0, 6);
      items.forEach((item, i) => {
        const col = i % 3;
        const row = Math.floor(i / 3);
        const x = 7 + col * 29;
        const y = 23 + row * 12.5;
        addCardObjects(objects, index, item, i, { x, y, w: 25, h: 10.5, z: 8 }, c, {
          role: layout === 'summary' ? 'takeaway-card' : 'feature-card',
          accent: i === 0,
          meta: layout === 'summary' ? `TAKE ${i + 1}` : `FEATURE ${i + 1}`,
          titleWords: 10,
          titleSize: 11.5,
          detailSize: 9.5,
        });
      });
      return zSort(objects);
    }

    if (layout === 'quote') {
      objects.push(textObject(index, 'quote', bullets[0] || title, { x: 11, y: 18, w: 78, h: 15, z: 12 }, { fontSize: 27, italic: true, bold: false, align: 'center', color: c.title }));
      objects.push(textObject(index, 'title', title, { x: 27, y: 36, w: 46, h: 4, z: 12 }, { fontFamily: DEFAULT_BODY_FONT, fontSize: 10, bold: true, align: 'center', color: c.accent }));
      return zSort(objects);
    }

    if (layout === 'minimal' || layout === 'bigTitle' || layout === 'centered') {
      objects.push(textObject(index, 'title', title, { x: layout === 'centered' ? 12 : 7, y: layout === 'minimal' ? 22 : 18, w: layout === 'centered' ? 76 : 84, h: 13, z: 12 }, {
        fontSize: layout === 'minimal' ? 44 : 46,
        color: c.title,
        bold: true,
        align: layout === 'centered' ? 'center' : 'left',
      }));
      if (bullets[0] && layout !== 'minimal') objects.push(textObject(index, 'body', bullets[0], { x: layout === 'centered' ? 20 : 7, y: 34, w: layout === 'centered' ? 60 : 62, h: 7, z: 12 }, { fontSize: 16, color: c.text, bold: false, align: layout === 'centered' ? 'center' : 'left' }));
      return zSort(objects);
    }

    if (shouldHaveImage(slide)) {
      objects.push(imageObject(index, 'image-placeholder', image, { x: 62, y: 13, w: 31, h: 24, z: 6 }));
      objects.push(textObject(index, 'title', title, { x: 7, y: 14, w: 47, h: 10, z: 12 }, { fontSize: 32, color: c.title, bold: true, lineHeight: 1.05 }));
      objects.push(textObject(index, 'body', bullets.join('\n'), { x: 8, y: 28, w: 47, h: 16, z: 12 }, { fontSize: 15, color: c.text, bold: false, lineHeight: 1.38 }));
      return zSort(objects);
    }
    objects.push(textObject(index, 'title', title, { x: 7, y: 14, w: 72, h: 10, z: 12 }, { fontSize: 32, color: c.title, bold: true, lineHeight: 1.05 }));
    objects.push(textObject(index, 'body', bullets.join('\n'), { x: 8, y: 28, w: 76, h: 18, z: 12 }, { fontSize: 16, color: c.text, bold: false, lineHeight: 1.4 }));
    return zSort(objects);
  };

  const shouldRecomposeVisualObjects = (slide = {}) => {
    if (!Array.isArray(slide.objects) || !slide.objects.length) return false;
    if (Number(slide.visualVersion || 0) >= OBJECT_VISUAL_VERSION) return false;
    return slide.objects.every((obj) => /^s\d+-/.test(String(obj.id || '')));
  };

  const ensureSlideObjects = (slide = {}, index = 0, total = 1) => {
    const sourceObjects = Array.isArray(slide.objects) && slide.objects.length && !shouldRecomposeVisualObjects(slide)
      ? slide.objects
      : composeLegacyObjects(slide, index, total);
    return {
      ...slide,
      editorVersion: EDITOR_VERSION,
      visualVersion: OBJECT_VISUAL_VERSION,
      objects: zSort(sourceObjects.map((obj, i) => normalizeObject(obj, index, i))),
    };
  };

  const ensureSlidesObjects = (slides = []) => Array.isArray(slides)
    ? slides.map((slide, index) => ensureSlideObjects(slide, index, slides.length))
    : [];

  const primaryText = (objects = [], role) => objects.find((obj) => obj.type === 'text' && obj.role === role)?.content || '';

  const deriveLegacyFields = (slide = {}) => {
    const objects = Array.isArray(slide.objects) ? slide.objects : [];
    const title = primaryText(objects, 'title') || slide.title || '';
    const body = primaryText(objects, 'body') || slide.bullets?.join('\n') || '';
    return {
      ...slide,
      title,
      bullets: body.split(/\n+/).map((line) => compactText(line.replace(/^[*\-\d.)\s]+/, ''))).filter(Boolean).slice(0, 6),
    };
  };

  return {
    EDITOR_VERSION,
    OBJECT_VISUAL_VERSION,
    SLIDE_W,
    SLIDE_H,
    normalizeObject,
    ensureSlideObjects,
    ensureSlidesObjects,
    deriveLegacyFields,
    tableRowsFromSlide,
    shouldHaveImage,
    imageDataFromSlide,
  };
});
