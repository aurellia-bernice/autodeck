// ============================================================
// SlideGenerator - object-based presentation editor
// Every visible slide element is represented by slide.objects[].
// ============================================================

const {
  DEMO_SLIDES,
  LAYOUTS,
  buildThemes,
  deriveBrandColors,
  pptFontName,
} = window.AutoDeckSlideEditorModel;
const SlideEditorAgent = window.AutoDeckSlideEditorAgent;
const { pptBox, toHex } = window.AutoDeckSlideEditorExport;

const SlideGenerator = ({ slides: initialSlides, config, tweaks, brandConfig, onBack, activeDeckId }) => {
  const isDemo = !Array.isArray(initialSlides) || initialSlides.length === 0;
  const safeInitial = isDemo ? DEMO_SLIDES : initialSlides;
  if (isDemo && typeof console !== 'undefined') {
    console.warn('[AutoDeck] SlideGenerator: no slides provided, falling back to demo data.');
  }

  const brandColors = deriveBrandColors(brandConfig);
  const customTheme = brandColors ? {
    name: 'Brand',
    swatch: brandColors.primary,
    gradient: `linear-gradient(155deg,${brandColors.bgDark || '#0F031F'} 0%,${brandColors.primary} 55%,${brandColors.secondary || brandColors.primary} 100%)`,
    title: brandColors.bgLight || '#F6F1FB',
    text: `${brandColors.bgLight || '#F6F1FB'}c7`,
    accent: brandColors.lime || brandColors.accent || QX.lime,
    rule: `${brandColors.bgLight || '#F6F1FB'}2e`,
  } : null;

  const THEMES = buildThemes(customTheme);

  const normalizeSlideList = (slides) => {
    const enhanced = window.AutoDeckTemplatePresets?.enhanceSlides
      ? window.AutoDeckTemplatePresets.enhanceSlides(slides, config?.templateStyle)
      : slides;
    return window.AutoDeckSlideObjects?.ensureSlidesObjects
      ? window.AutoDeckSlideObjects.ensureSlidesObjects(enhanced)
      : enhanced;
  };

  const [localSlides, setLocalSlides] = React.useState(() => normalizeSlideList(safeInitial));
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [globalTheme, setGlobalTheme] = React.useState(brandColors ? 'custom' : (window.AutoDeckTemplatePresets?.getTemplatePreset?.(config?.templateStyle)?.theme || 'purple'));
  const [slideThemeOverrides, setSlideThemeOverrides] = React.useState({});
  const [slideLayoutOverrides, setSlideLayoutOverrides] = React.useState({});
  const [selectedObjectId, setSelectedObjectId] = React.useState(null);
  const [selectedCell, setSelectedCell] = React.useState(null);
  const [editingObjectId, setEditingObjectId] = React.useState(null);
  const [editPanelOpen, setEditPanelOpen] = React.useState(true);
  const [editTab, setEditTab] = React.useState('style');
  const [showGrid, setShowGrid] = React.useState(false);
  const [showMenu, setShowMenu] = React.useState(false);
  const [showThemePop, setShowThemePop] = React.useState(false);
  const [showAddMenu, setShowAddMenu] = React.useState(false);
  const [toast, setToast] = React.useState(null);
  const [imgQuery, setImgQuery] = React.useState('');
  const [imgUrl, setImgUrl] = React.useState('');
  const [imgResults, setImgResults] = React.useState([]);
  const [imgGenerating, setImgGenerating] = React.useState(false);
  const [imgPage, setImgPage] = React.useState(1);
  const [agentOpen, setAgentOpen] = React.useState(false);
  const [agentSlideIndex, setAgentSlideIndex] = React.useState(0);
  const [agentMessages, setAgentMessages] = React.useState([]);
  const [agentInput, setAgentInput] = React.useState('');
  const [agentThinking, setAgentThinking] = React.useState(false);
  const [agentHistorySessions, setAgentHistorySessions] = React.useState([]);
  const [agentHistoryOpen, setAgentHistoryOpen] = React.useState(false);
  const stageRef = React.useRef(null);
  const agentInputRef = React.useRef(null);
  const agentScrollRef = React.useRef(null);
  const saveTimerRef = React.useRef(null);
  const suppressSaveRef = React.useRef(true);

  React.useEffect(() => {
    setLocalSlides(normalizeSlideList(safeInitial));
    setCurrentIndex(0);
    setSelectedObjectId(null);
    setSelectedCell(null);
    suppressSaveRef.current = true;
    setTimeout(() => { suppressSaveRef.current = false; }, 500);
  }, [JSON.stringify((safeInitial || []).map((s) => ({ title: s.title, bullets: s.bullets, objects: s.objects?.length })))] );

  React.useEffect(() => {
    if (agentScrollRef.current) agentScrollRef.current.scrollTop = agentScrollRef.current.scrollHeight;
  }, [agentMessages, agentThinking]);

  React.useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setShowMenu(false);
        setShowThemePop(false);
        setAgentOpen(false);
        setEditingObjectId(null);
      }
      if (agentOpen || editingObjectId || e.target?.tagName === 'INPUT' || e.target?.tagName === 'TEXTAREA' || e.target?.isContentEditable) return;
      if (e.key === 'ArrowRight') goTo(currentIndex + 1);
      if (e.key === 'ArrowLeft') goTo(currentIndex - 1);
      if (e.key.toLowerCase() === 'g') setShowGrid((s) => !s);
      if (e.key.toLowerCase() === 'f') handlePresent();
      if ((e.key === 'Backspace' || e.key === 'Delete') && selectedObjectId) deleteSelected();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [currentIndex, localSlides.length, agentOpen, editingObjectId, selectedObjectId]);

  React.useEffect(() => {
    if (selectedObjectId) {
      setEditPanelOpen(true);
      setEditTab('style');
    } else {
      setEditTab('layout');
    }
  }, [selectedObjectId]);

  React.useEffect(() => {
    if (suppressSaveRef.current || !activeDeckId || !window.firebase?.app) return;
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        const saveFn = firebase.app().functions('us-central1').httpsCallable('saveDeckEdits', { timeout: 60000 });
        await saveFn({ deckId: activeDeckId, slides: localSlides, editorVersion: window.AutoDeckSlideObjects?.EDITOR_VERSION || 2 });
        showToast('Saved', 'success', 1200);
      } catch (_) {
        showToast('Autosave unavailable', 'info', 1600);
      }
    }, 1200);
    return () => clearTimeout(saveTimerRef.current);
  }, [JSON.stringify(localSlides), activeDeckId]);

  const total = localSlides.length;
  const slide = localSlides[currentIndex] || localSlides[0] || {};
  const selectedObject = (slide.objects || []).find((obj) => obj.id === selectedObjectId) || null;
  const theme = THEMES[slideThemeOverrides[currentIndex] || globalTheme || slide.theme] || THEMES.purple;
  const layout = slideLayoutOverrides[currentIndex] || slide.renderLayout || slide.layout || 'standard';
  const deckTitleRaw = localSlides[0]?.title || config?.inputText || 'Untitled deck';
  const deckTitle = deckTitleRaw.split(/\s+/).slice(0, 6).join(' ') + (deckTitleRaw.split(/\s+/).length > 6 ? '...' : '');

  const showToast = (msg, type = 'info', ms = 2600) => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), ms);
  };

  const updateSlideAt = (idx, updater) => {
    setLocalSlides((prev) => prev.map((s, i) => {
      if (i !== idx) return s;
      const next = typeof updater === 'function' ? updater(s) : updater;
      return window.AutoDeckSlideObjects?.ensureSlideObjects
        ? window.AutoDeckSlideObjects.ensureSlideObjects(next, i, prev.length)
        : next;
    }));
  };

  const updateCurrentSlide = (updater) => updateSlideAt(currentIndex, updater);

  const updateObject = (objectId, patchOrUpdater) => {
    updateCurrentSlide((s) => ({
      ...s,
      objects: (s.objects || []).map((obj) => {
        if (obj.id !== objectId) return obj;
        const patch = typeof patchOrUpdater === 'function' ? patchOrUpdater(obj) : patchOrUpdater;
        return { ...obj, ...patch, style: { ...(obj.style || {}), ...(patch.style || {}) } };
      }),
    }));
  };

  const stagePoint = (event) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 56.25,
    };
  };

  const snapValue = (value, step = showGrid ? 1 : 0.25) => Math.round(value / step) * step;
  const clampBox = (box) => ({
    x: Math.max(0, Math.min(99, snapValue(box.x))),
    y: Math.max(0, Math.min(55.25, snapValue(box.y))),
    w: Math.max(2, Math.min(100 - Math.max(0, box.x), snapValue(box.w))),
    h: Math.max(2, Math.min(56.25 - Math.max(0, box.y), snapValue(box.h))),
  });

  const beginMove = (event, obj) => {
    if (obj.locked || editingObjectId) return;
    event.preventDefault();
    event.stopPropagation();
    setSelectedObjectId(obj.id);
    setSelectedCell(null);
    const start = stagePoint(event);
    const origin = { x: obj.x, y: obj.y, w: obj.w, h: obj.h };
    const onMove = (moveEvent) => {
      const point = stagePoint(moveEvent);
      updateObject(obj.id, clampBox({
        ...origin,
        x: origin.x + point.x - start.x,
        y: origin.y + point.y - start.y,
      }));
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const beginResize = (event, obj) => {
    if (obj.locked || editingObjectId) return;
    event.preventDefault();
    event.stopPropagation();
    setSelectedObjectId(obj.id);
    const start = stagePoint(event);
    const origin = { x: obj.x, y: obj.y, w: obj.w, h: obj.h };
    const onMove = (moveEvent) => {
      const point = stagePoint(moveEvent);
      updateObject(obj.id, clampBox({
        ...origin,
        w: origin.w + point.x - start.x,
        h: origin.h + point.y - start.y,
      }));
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const syncLegacyFields = (s) => {
    const derived = window.AutoDeckSlideObjects?.deriveLegacyFields?.(s) || s;
    return {
      ...s,
      title: derived.title || s.title,
      bullets: derived.bullets || s.bullets || [],
    };
  };

  const addObject = (obj) => {
    const id = obj.id || `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    updateCurrentSlide((s) => ({ ...s, objects: [...(s.objects || []), { ...obj, id }] }));
    setSelectedObjectId(id);
    setSelectedCell(null);
    setEditPanelOpen(true);
    setEditTab(obj.type === 'image' ? 'image' : obj.type === 'table' ? 'table' : 'style');
    return id;
  };

  const addNewSlide = () => {
    const blank = window.AutoDeckSlideObjects?.ensureSlidesObjects
      ? window.AutoDeckSlideObjects.ensureSlidesObjects([{ title: 'New Slide', renderLayout: 'standard', bullets: [] }])[0]
      : { title: 'New Slide', renderLayout: 'standard', bullets: [], objects: [] };
    const insertAt = currentIndex + 1;
    setLocalSlides((prev) => {
      const next = [...prev];
      next.splice(insertAt, 0, blank);
      return next;
    });
    setCurrentIndex(insertAt);
    showToast('New slide added', 'success');
  };

  const addTextbox = () => {
    const id = addObject({
      type: 'text',
      role: 'textbox',
      content: 'New textbox',
      x: 18,
      y: 18,
      w: 34,
      h: 8,
      z: nextZ(),
      locked: false,
      style: { fontFamily: brandConfig?.bodyFont || qxType.body, fontSize: 16, bold: false, italic: false, align: 'left', color: theme.title, lineHeight: 1.2 },
    });
    setEditingObjectId(id);
    showToast('Textbox added', 'success');
  };

  const addTable = () => {
    addObject({
      type: 'table',
      role: 'table',
      x: 12,
      y: 18,
      w: 76,
      h: 24,
      z: nextZ(),
      locked: false,
      rows: [
        [{ text: 'Column 1', style: { bold: true, align: 'left', color: '#232126', fill: QX.lime } }, { text: 'Column 2', style: { bold: true, align: 'left', color: '#232126', fill: QX.lime } }, { text: 'Column 3', style: { bold: true, align: 'left', color: '#232126', fill: QX.lime } }],
        [{ text: 'Row 1', style: {} }, { text: 'Add detail', style: {} }, { text: 'Add detail', style: {} }],
        [{ text: 'Row 2', style: {} }, { text: 'Add detail', style: {} }, { text: 'Add detail', style: {} }],
      ],
      style: { fontFamily: brandConfig?.bodyFont || qxType.body, fontSize: 10, borderColor: 'rgba(246,241,251,0.20)' },
    });
    showToast('Table added', 'success');
  };

  const addImagePlaceholder = () => {
    const existingFrame = (slide.objects || []).find((obj) => obj.type === 'image' && !obj.src && !obj.locked);
    if (existingFrame) {
      openImageTools(existingFrame);
      showToast('Image frame selected', 'success');
      return existingFrame.id;
    }
    const prompt = slide.imagePrompt || slide.title || '';
    const id = addObject({
      type: 'image',
      role: 'image',
      x: 62,
      y: 17,
      w: 29,
      h: 24,
      z: nextZ(),
      locked: false,
      src: '',
      prompt,
      alt: '',
      credit: '',
      creditUrl: '',
      fit: 'cover',
      style: { fill: '#320067', stroke: theme.rule, radius: 4 },
    });
    setImgQuery(prompt);
    setSelectedObjectId(id);
    setEditPanelOpen(true);
    setEditTab('image');
    showToast('Image placeholder added', 'success');
  };

  const nextZ = () => Math.max(0, ...(slide.objects || []).map((obj) => Number(obj.z) || 0)) + 1;

  const deleteSelected = () => {
    if (!selectedObjectId) return;
    updateCurrentSlide((s) => syncLegacyFields({ ...s, objects: (s.objects || []).filter((obj) => obj.id !== selectedObjectId) }));
    setSelectedObjectId(null);
    setSelectedCell(null);
  };

  const duplicateSelected = () => {
    if (!selectedObject) return;
    const id = `dup-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    addObject({ ...selectedObject, id, x: Math.min(92, selectedObject.x + 2), y: Math.min(52, selectedObject.y + 2), z: nextZ() });
  };

  const bringForward = () => selectedObject && updateObject(selectedObject.id, { z: (selectedObject.z || 0) + 1 });
  const sendBackward = () => selectedObject && updateObject(selectedObject.id, { z: (selectedObject.z || 0) - 1 });

  const updateSelectedStyle = (patch) => {
    if (!selectedObject) return;
    if (selectedObject.type === 'table' && selectedCell) {
      updateObject(selectedObject.id, (obj) => ({
        rows: obj.rows.map((row, ri) => row.map((cell, ci) => (
          ri === selectedCell.row && ci === selectedCell.col
            ? { ...cell, style: { ...(cell.style || {}), ...patch } }
            : cell
        ))),
      }));
      return;
    }
    updateObject(selectedObject.id, { style: patch });
  };

  const updateSelectedFontSize = (value) => {
    const fontSize = Math.max(6, Math.min(96, parseInt(value, 10) || 16));
    updateSelectedStyle({ fontSize });
  };

  const applyLayout = (key) => {
    const base = { ...slide, renderLayout: key, layout: key, visualLayout: key, objects: undefined };
    const compiled = window.AutoDeckSlideObjects?.ensureSlideObjects
      ? window.AutoDeckSlideObjects.ensureSlideObjects(base, currentIndex, total)
      : base;
    updateSlideAt(currentIndex, compiled);
    setSlideLayoutOverrides((prev) => ({ ...prev, [currentIndex]: key }));
    setSelectedObjectId(null);
    setSelectedCell(null);
  };

  const goTo = (i) => {
    const next = Math.max(0, Math.min(localSlides.length - 1, i));
    setCurrentIndex(next);
    setSelectedObjectId(null);
    setSelectedCell(null);
    setEditingObjectId(null);
  };

  const normalizeAgentLayout = (value) => SlideEditorAgent.normalizeAgentLayout(value, LAYOUTS);
  const layoutFromAgentText = (value) => SlideEditorAgent.layoutFromAgentText(value);
  const agentTargetSlideIndex = (value, fallback = currentIndex) => SlideEditorAgent.agentTargetSlideIndex(value, {
    fallback,
    total: localSlides.length,
  });

  const applyAgentPatch = (idx, patch = {}) => {
    const targetIdx = Math.max(0, Math.min(localSlides.length - 1, idx));
    const normalizedLayout = normalizeAgentLayout(patch.updatedLayout || patch.layout);
    updateSlideAt(targetIdx, (s) => {
      let next = { ...s, bullets: Array.isArray(s.bullets) ? [...s.bullets] : [] };
      const bulletChanged = Array.isArray(patch.updatedBullets) || Array.isArray(patch.addBullets) || patch.removeLastBullet;
      if (patch.updatedTitle) next.title = String(patch.updatedTitle).trim();
      if (Array.isArray(patch.updatedBullets)) next.bullets = patch.updatedBullets.map(String).filter(Boolean).slice(0, 6);
      if (Array.isArray(patch.addBullets)) next.bullets = [...next.bullets, ...patch.addBullets.map(String).filter(Boolean)].slice(0, 6);
      if (patch.removeLastBullet && next.bullets.length > 1) next.bullets = next.bullets.slice(0, -1);
      if (bulletChanged) {
        next = {
          ...next,
          components: [],
        };
        delete next.tableRows;
      }
      if (normalizedLayout) {
        next.layout = normalizedLayout;
        next.visualLayout = normalizedLayout;
        next.renderLayout = normalizedLayout;
        next.objects = undefined;
      } else if (bulletChanged) {
        next.objects = undefined;
      } else {
        const titleObj = (next.objects || []).find((obj) => obj.type === 'text' && obj.role === 'title');
        const bodyObj = (next.objects || []).find((obj) => obj.type === 'text' && obj.role === 'body');
        next.objects = (next.objects || []).map((obj) => {
          if (obj.id === titleObj?.id && patch.updatedTitle) return { ...obj, content: next.title };
          if (obj.id === bodyObj?.id && (patch.updatedBullets || patch.addBullets || patch.removeLastBullet)) return { ...obj, content: next.bullets.join('\n') };
          return obj;
        });
      }
      return next;
    });
    if (normalizedLayout) setSlideLayoutOverrides((prev) => ({ ...prev, [targetIdx]: normalizedLayout }));
    if (targetIdx !== currentIndex) goTo(targetIdx);
    setAgentSlideIndex(targetIdx);
  };

  const localAgentPatch = (userText, idx) => {
    return SlideEditorAgent.localAgentPatch(userText, localSlides[idx] || {});
  };

  const simulateAgentResponse = (userText, fallbackIdx) => {
    const targetIdx = agentTargetSlideIndex(userText, fallbackIdx);
    const patch = localAgentPatch(userText, targetIdx);
    if (patch.needsClarification) {
      setAgentSlideIndex(targetIdx);
      return `I can edit slide ${targetIdx + 1}, but I need a clearer change. Ask me to rename the title, add a bullet, or switch to a layout like Split, Table, Timeline, or Summary.`;
    }
    applyAgentPatch(targetIdx, patch);
    const layoutName = patch.updatedLayout ? (LAYOUTS.find((l) => l.key === patch.updatedLayout)?.name || patch.updatedLayout) : '';
    if (patch.updatedLayout && (patch.updatedTitle || patch.updatedBullets || patch.addBullets || patch.removeLastBullet)) return `Done - slide ${targetIdx + 1} updated and switched to ${layoutName} layout.`;
    if (patch.updatedLayout) return `Done - slide ${targetIdx + 1} is now using the ${layoutName} layout.`;
    return `Done - slide ${targetIdx + 1} is updated.`;
  };

  const agentIntroMessage = (idx, fresh = false) => (
    SlideEditorAgent.agentIntroMessage(idx, localSlides[idx]?.title, fresh)
  );

  const openAgent = (idx) => {
    setAgentSlideIndex(idx);
    setAgentMessages((prev) => prev.length ? prev : [agentIntroMessage(idx)]);
    setAgentInput('');
    setAgentOpen(true);
    setEditPanelOpen(false);
    setTimeout(() => agentInputRef.current?.focus(), 80);
  };

  const handleAgentSend = async () => {
    const text = agentInput.trim();
    if (!text || agentThinking) return;
    const nextHistory = [...agentMessages, { role: 'user', text }];
    setAgentMessages(nextHistory);
    setAgentInput('');
    setAgentThinking(true);
    const requestedSlideIndex = agentTargetSlideIndex(text, agentSlideIndex);
    const requestedLayout = layoutFromAgentText(text);
    let reply = null;
    let usedRealApi = false;
    try {
      if (window.firebase?.app) {
        const agentEditFn = firebase.app().functions('us-central1').httpsCallable('agentEdit');
        const s = localSlides[requestedSlideIndex] || {};
        const { data } = await agentEditFn({
          slideIndex: requestedSlideIndex,
          slideCount: localSlides.length,
          slideTitle: s.title || '',
          bullets: s.bullets || [],
          slideContent: (s.objects || []).filter((obj) => obj.type === 'text').map((obj) => obj.content).join('\n'),
          components: s.components || [],
          currentLayout: s.renderLayout || s.layout || 'standard',
          availableLayouts: LAYOUTS.map((l) => ({ key: l.key, name: l.name, desc: l.desc })),
          deckTitles: localSlides.map((item) => item.title || ''),
          deckSlides: localSlides.map((item, i) => ({ index: i, title: item.title, layout: item.renderLayout || item.layout, bullets: item.bullets || [] })),
          sourceContext: { prompt: config?.inputText || '', parsedFileText: config?.parsedFileText || '' },
          userMessage: text,
          history: agentMessages.slice(-20).map((m) => ({ role: m.role, text: m.text })),
        });
        const responseSlideIndex = Number.isInteger(data?.targetSlideIndex) ? Math.max(0, Math.min(localSlides.length - 1, data.targetSlideIndex)) : requestedSlideIndex;
        const responsePatch = { ...(data || {}), updatedLayout: data?.updatedLayout || requestedLayout || undefined };
        if (responsePatch.updatedTitle || responsePatch.updatedBullets || responsePatch.updatedLayout) {
          applyAgentPatch(responseSlideIndex, responsePatch);
          const layoutName = responsePatch.updatedLayout ? (LAYOUTS.find((l) => l.key === normalizeAgentLayout(responsePatch.updatedLayout))?.name || responsePatch.updatedLayout) : '';
          reply = responsePatch.updatedLayout && !data?.updatedLayout
            ? `Done - slide ${responseSlideIndex + 1} is now using the ${layoutName} layout.`
            : (data.assistantReply || `Done - slide ${responseSlideIndex + 1} updated.`);
          usedRealApi = true;
        } else if (data?.needsClarification && data?.assistantReply) {
          reply = data.assistantReply;
          usedRealApi = true;
        }
      }
    } catch (_) {}
    if (!usedRealApi) reply = simulateAgentResponse(text, requestedSlideIndex);
    setAgentMessages((prev) => [...prev, { role: 'assistant', text: reply }]);
    setAgentThinking(false);
    setTimeout(() => agentInputRef.current?.focus(), 30);
  };

  const fetchImages = async (page = 1, queryOverride = '') => {
    const q = String(queryOverride || imgQuery || selectedObject?.prompt || slide.imagePrompt || slide.title || '').trim();
    if (!q || imgGenerating) return;
    if (queryOverride) setImgQuery(q);
    setImgGenerating(true);
    setImgResults([]);
    try {
      const searchImagesFn = firebase.app().functions('us-central1').httpsCallable('searchImages', { timeout: 30000 });
      const { data } = await searchImagesFn({ query: q, count: 6, orientation: 'landscape', page });
      const photos = data?.images || [];
      if (photos.length) setImgResults(photos);
      else showToast('No photos found', 'info');
    } catch (err) {
      showToast(err.message || 'Unsplash search failed', 'info');
    } finally {
      setImgGenerating(false);
    }
  };

  const applyImage = (image) => {
    const src = image.src || image;
    if (!src) return;
    const prompt = imgQuery.trim() || selectedObject?.prompt || slide.imagePrompt || slide.title || '';
    if (selectedObject?.type === 'image') {
      updateObject(selectedObject.id, {
        src,
        prompt,
        alt: image.alt || prompt || '',
        credit: image.credit || '',
        creditUrl: image.creditUrl || '',
      });
    } else {
      const id = addObject({
        type: 'image',
        role: 'image',
        x: 14,
        y: 12,
        w: 44,
        h: 30,
        z: nextZ(),
        locked: false,
        src,
        prompt,
        alt: image.alt || prompt || '',
        credit: image.credit || '',
        creditUrl: image.creditUrl || '',
        fit: 'cover',
        style: { radius: 4 },
      });
      setSelectedObjectId(id);
    }
    setEditTab('image');
    showToast('Image applied', 'success');
  };

  const applyImageUrl = () => {
    const url = imgUrl.trim();
    if (!url) return;
    applyImage({ src: url, thumb: url, alt: imgQuery.trim() || selectedObject?.alt || slide.title || 'Slide image' });
    setImgUrl('');
  };

  const removeImage = () => {
    if (!selectedObject || selectedObject.type !== 'image') return;
    updateObject(selectedObject.id, { src: '', credit: '', creditUrl: '' });
    setEditTab('image');
    showToast('Image cleared', 'success');
  };

  const openImageTools = (obj, shouldSearch = false) => {
    const prompt = obj?.prompt || slide.imagePrompt || slide.title || '';
    if (obj?.id) setSelectedObjectId(obj.id);
    setSelectedCell(null);
    setEditPanelOpen(true);
    setEditTab('image');
    if (prompt) setImgQuery((current) => current || prompt);
    if (shouldSearch) {
      setImgPage(1);
      setTimeout(() => fetchImages(1, prompt), 0);
    }
  };

  const handlePresent = () => {
    setShowMenu(false);
    document.documentElement.requestFullscreen?.().catch(() => {});
    showToast('Press Esc to exit presentation', 'info');
  };

  const handleDownloadPPTX = async () => {
    setShowMenu(false);
    showToast('Generating .pptx...', 'loading');
    try {
      const pptx = new PptxGenJS();
      pptx.layout = 'LAYOUT_WIDE';
      pptx.author = 'AutoDeck AI';
      pptx.subject = config?.templateStyle || 'Quidax internal deck';
      const displayFont = pptFontName(brandConfig?.displayFont, qxType.display, 'display');
      const bodyFont = pptFontName(brandConfig?.bodyFont, qxType.body, 'body');
      pptx.theme = { headFontFace: displayFont, bodyFontFace: bodyFont, lang: 'en-US' };

      localSlides.forEach((s) => {
        const pSlide = pptx.addSlide();
        [...(s.objects || [])].sort((a, b) => (a.z || 0) - (b.z || 0)).forEach((obj) => {
          const box = pptBox(obj);
          if (obj.type === 'shape') {
            pSlide.addShape(obj.style?.shape === 'ellipse' ? pptx.ShapeType.ellipse : pptx.ShapeType.rect, {
              ...box,
              fill: { color: toHex(obj.style?.fill, '1A0530'), transparency: Math.round((1 - (obj.style?.opacity ?? 1)) * 100) },
              line: { color: obj.style?.stroke === 'transparent' ? toHex(obj.style?.fill, '1A0530') : toHex(obj.style?.stroke, '1A0530'), transparency: obj.style?.stroke === 'transparent' ? 100 : 0, width: obj.style?.strokeWidth || 0 },
            });
          } else if (obj.type === 'image') {
            if (obj.src) pSlide.addImage({ path: obj.src, ...box });
            else pSlide.addShape(pptx.ShapeType.rect, { ...box, fill: { color: '320067', transparency: 35 }, line: { color: 'B890FE', transparency: 20 } });
          } else if (obj.type === 'table') {
            const rows = (obj.rows || []).map((row) => row.map((cell) => ({
              text: cell.text || '',
              options: {
                bold: cell.style?.bold === true,
                italic: cell.style?.italic === true,
                align: cell.style?.align || 'left',
                color: toHex(cell.style?.color, 'F6F1FB'),
                fill: { color: toHex(cell.style?.fill, '1A0530') },
              },
            })));
            pSlide.addTable(rows, {
              ...box,
              fontFace: pptFontName(obj.style?.fontFamily, bodyFont),
              fontSize: obj.style?.fontSize || 10,
              border: { color: toHex(obj.style?.borderColor, 'B890FE'), pt: 0.5 },
              valign: 'mid',
              margin: 0.05,
            });
          } else {
            pSlide.addText(obj.content || '', {
              ...box,
              fontFace: pptFontName(obj.style?.fontFamily, obj.role === 'title' ? displayFont : bodyFont, obj.role === 'title' ? 'display' : 'body'),
              fontSize: obj.style?.fontSize || 16,
              bold: obj.style?.bold === true,
              italic: obj.style?.italic === true,
              color: toHex(obj.style?.color, 'F6F1FB'),
              align: obj.style?.align || 'left',
              valign: 'mid',
              fit: 'shrink',
              breakLine: false,
            });
          }
        });
        if (s.speakerNotes && pSlide.addNotes) pSlide.addNotes(s.speakerNotes);
      });
      await pptx.writeFile({ fileName: `${deckTitle || 'AutoDeck'}.pptx` });
      showToast('PPTX downloaded', 'success');
    } catch (err) {
      showToast('Export failed - try again', 'info');
    }
  };

  const handleDownloadPNG = async () => {
    setShowMenu(false);
    showToast('Saving slide as PNG...', 'loading');
    try {
      const el = document.getElementById('main-slide');
      if (!el) return showToast('Slide not found', 'info');
      const canvas = await html2canvas(el, { useCORS: true, scale: 2, backgroundColor: null });
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `slide-${currentIndex + 1}.png`;
      a.click();
      showToast('Slide saved as PNG', 'success');
    } catch (_) {
      showToast('Export failed - try again', 'info');
    }
  };

  const handleShare = () => {
    setShowMenu(false);
    const link = `autodeck.quidax.com/d/${activeDeckId || Math.random().toString(36).slice(2, 8)}`;
    navigator.clipboard?.writeText(link).catch(() => {});
    showToast('Link copied', 'success');
  };

  const handleDuplicate = () => { setShowMenu(false); showToast('Deck duplicated to your library', 'success'); };

  const objectStyle = (obj) => ({
    position: 'absolute',
    left: `${obj.x}%`,
    top: `${(obj.y / 56.25) * 100}%`,
    width: `${obj.w}%`,
    height: `${(obj.h / 56.25) * 100}%`,
    zIndex: obj.z,
    cursor: obj.locked ? 'default' : editingObjectId === obj.id ? 'text' : 'move',
  });

  const renderTextObject = (obj) => {
    const selected = obj.id === selectedObjectId;
    const editing = editingObjectId === obj.id;
    return (
      <div
        key={obj.id}
        data-object-id={obj.id}
        data-object-type={obj.type}
        data-object-role={obj.role}
        role={obj.role === 'title' ? 'heading' : undefined}
        aria-level={obj.role === 'title' ? 2 : undefined}
        onPointerDown={(e) => beginMove(e, obj)}
        onClick={(e) => { e.stopPropagation(); setSelectedObjectId(obj.id); setSelectedCell(null); }}
        onDoubleClick={(e) => { e.stopPropagation(); setSelectedObjectId(obj.id); setSelectedCell(null); setEditingObjectId(obj.id); }}
        style={{
          ...objectStyle(obj),
          color: obj.style?.color || theme.title,
          fontFamily: obj.style?.fontFamily || qxType.body,
          fontSize: `${obj.style?.fontSize || 16}px`,
          fontWeight: obj.style?.fontWeight || (obj.style?.bold ? 700 : 400),
          fontStyle: obj.style?.italic ? 'italic' : 'normal',
          textAlign: obj.style?.align || 'left',
          lineHeight: obj.style?.lineHeight || 1.2,
          letterSpacing: obj.style?.letterSpacing || 0,
          textTransform: obj.style?.textTransform || 'none',
          whiteSpace: 'pre-wrap',
          overflow: 'hidden',
          outline: selected ? `2px solid ${QX.lime}` : '1px solid transparent',
          borderRadius: 4,
          padding: 4,
        }}
        contentEditable={editing}
        suppressContentEditableWarning
        onBlur={(e) => {
          const content = e.currentTarget.textContent || '';
          updateCurrentSlide((s) => syncLegacyFields({
            ...s,
            objects: (s.objects || []).map((item) => item.id === obj.id ? { ...item, content } : item),
          }));
          setEditingObjectId(null);
        }}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Escape') { e.preventDefault(); setEditingObjectId(null); }
        }}
      >
        {obj.content}
      </div>
    );
  };

  const renderShapeObject = (obj) => (
    <div
      key={obj.id}
      data-object-id={obj.id}
      data-object-type={obj.type}
      data-object-role={obj.role}
      onPointerDown={(e) => beginMove(e, obj)}
      onClick={(e) => { e.stopPropagation(); setSelectedObjectId(obj.id); setSelectedCell(null); }}
      style={{
        ...objectStyle(obj),
        background: obj.style?.fill || 'transparent',
        opacity: obj.style?.opacity ?? 1,
        border: obj.style?.stroke && obj.style.stroke !== 'transparent' ? `${obj.style?.strokeWidth || 1}px solid ${obj.style.stroke}` : 'none',
        borderRadius: obj.style?.shape === 'ellipse' ? '50%' : `${obj.style?.radius || 0}px`,
        outline: obj.id === selectedObjectId ? `2px solid ${QX.lime}` : 'none',
      }}
    />
  );

  const renderImageObject = (obj) => {
    const selected = obj.id === selectedObjectId;
    const prompt = obj.prompt || slide.imagePrompt || slide.title || 'Search Unsplash';
    return (
      <div
        key={obj.id}
        data-object-id={obj.id}
        data-object-type={obj.type}
        data-object-role={obj.role}
        onPointerDown={(e) => beginMove(e, obj)}
        onClick={(e) => { e.stopPropagation(); setSelectedObjectId(obj.id); setSelectedCell(null); }}
        onDoubleClick={(e) => { e.stopPropagation(); openImageTools(obj); }}
        style={{
          ...objectStyle(obj),
          background: obj.src
            ? `url(${obj.src}) center/${obj.fit || 'cover'} no-repeat`
            : 'linear-gradient(135deg, rgba(97,0,165,0.46), rgba(184,144,254,0.12)), rgba(246,241,251,0.035)',
          border: selected ? `2px solid ${QX.lime}` : `1px solid ${obj.style?.stroke || 'rgba(246,241,251,0.16)'}`,
          borderRadius: obj.style?.radius || 8,
          overflow: 'hidden',
          boxShadow: !obj.src ? 'inset 0 0 0 1px rgba(246,241,251,0.06)' : 'none',
        }}
      >
        {!obj.src && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, textAlign: 'center' }}>
            <div style={{ width: 'min(78%, 320px)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(212,255,63,0.12)', border: '1px solid rgba(212,255,63,0.28)', color: QX.lime, fontFamily: qxType.display, fontSize: 19, fontWeight: 700 }}>+</div>
              <div style={{ fontFamily: qxType.display, fontSize: 14, fontWeight: 700, color: '#F6F1FB', lineHeight: 1.15 }}>Add image</div>
              <div style={{ maxWidth: 260, color: 'rgba(246,241,251,0.62)', fontFamily: qxType.body, fontSize: 10.5, lineHeight: 1.35, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{prompt}</div>
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); openImageTools(obj, true); }}
                style={{ marginTop: 3, height: 28, padding: '0 11px', borderRadius: 999, border: '1px solid rgba(212,255,63,0.38)', background: QX.lime, color: QX.limeInk, fontFamily: qxType.body, fontSize: 11, fontWeight: 800, cursor: 'pointer', boxShadow: '0 10px 24px rgba(0,0,0,0.22)' }}
              >
                Search Unsplash
              </button>
            </div>
          </div>
        )}
        {obj.credit && (
          <div style={{ position: 'absolute', left: 8, bottom: 7, padding: '3px 6px', borderRadius: 4, background: 'rgba(0,0,0,0.55)', color: '#fff', fontFamily: qxType.mono, fontSize: 7 }}>
            {obj.credit}
          </div>
        )}
      </div>
    );
  };

  const updateTableCell = (objId, row, col, patch) => {
    updateObject(objId, (obj) => ({
      rows: obj.rows.map((r, ri) => r.map((cell, ci) => (
        ri === row && ci === col
          ? { ...cell, ...patch, style: { ...(cell.style || {}), ...(patch.style || {}) } }
          : cell
      ))),
    }));
  };

  const renderTableObject = (obj) => {
    const selected = obj.id === selectedObjectId;
    const rows = obj.rows || [];
    return (
      <div
        key={obj.id}
        data-object-id={obj.id}
        data-object-type={obj.type}
        data-object-role={obj.role}
        onPointerDown={(e) => beginMove(e, obj)}
        onClick={(e) => { e.stopPropagation(); setSelectedObjectId(obj.id); }}
        style={{
          ...objectStyle(obj),
          display: 'grid',
          gridTemplateRows: `repeat(${Math.max(1, rows.length)}, 1fr)`,
          border: selected ? `2px solid ${QX.lime}` : `1px solid ${obj.style?.borderColor || 'rgba(246,241,251,0.18)'}`,
          borderRadius: 5,
          overflow: 'hidden',
          background: 'rgba(246,241,251,0.04)',
          fontFamily: obj.style?.fontFamily || qxType.body,
          fontSize: `${obj.style?.fontSize || 10}px`,
        }}
      >
        {rows.map((row, ri) => (
          <div key={ri} style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, row.length)}, 1fr)` }}>
            {row.map((cell, ci) => {
              const cellSelected = selectedCell?.objectId === obj.id && selectedCell.row === ri && selectedCell.col === ci;
              return (
                <div
                  key={`${ri}-${ci}`}
                  data-table-cell={`${ri}:${ci}`}
                  contentEditable
                  suppressContentEditableWarning
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); setSelectedObjectId(obj.id); setSelectedCell({ objectId: obj.id, row: ri, col: ci }); }}
                  onBlur={(e) => updateTableCell(obj.id, ri, ci, { text: e.currentTarget.textContent || '' })}
                  style={{
                    padding: 7,
                    minWidth: 0,
                    overflow: 'hidden',
                    borderRight: ci < row.length - 1 ? `1px solid ${obj.style?.borderColor || 'rgba(246,241,251,0.16)'}` : 'none',
                    borderBottom: ri < rows.length - 1 ? `1px solid ${obj.style?.borderColor || 'rgba(246,241,251,0.16)'}` : 'none',
                    background: cell.style?.fill || (ri === 0
                      ? (obj.style?.headerFill || QX.lime)
                      : ((obj.style?.alternateRows && ri % 2 === 0) ? 'rgba(246,241,251,0.07)' : (obj.style?.bodyFill || 'rgba(246,241,251,0.04)'))),
                    color: cell.style?.color || (ri === 0 ? (obj.style?.headerText || '#1A0530') : (obj.style?.bodyText || theme.title)),
                    fontWeight: cell.style?.bold ? 700 : 400,
                    fontStyle: cell.style?.italic ? 'italic' : 'normal',
                    textAlign: cell.style?.align || 'left',
                    outline: cellSelected ? `2px solid ${QX.lime}` : 'none',
                    whiteSpace: 'pre-wrap',
                    lineHeight: 1.25,
                  }}
                >
                  {cell.text}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  const ResizeHandle = () => {
    if (!selectedObject || selectedObject.locked) return null;
    return (
      <button
        aria-label="Resize selected object"
        onPointerDown={(e) => beginResize(e, selectedObject)}
        style={{
          position: 'absolute',
          left: `${selectedObject.x + selectedObject.w}%`,
          top: `${((selectedObject.y + selectedObject.h) / 56.25) * 100}%`,
          width: 14,
          height: 14,
          marginLeft: -7,
          marginTop: -7,
          zIndex: 400,
          border: `2px solid ${QX.lime}`,
          background: '#0F031F',
          borderRadius: 3,
          cursor: 'nwse-resize',
        }}
      />
    );
  };

  const ObjectStage = () => (
    <div
      id="main-slide"
      ref={stageRef}
      onClick={() => { setSelectedObjectId(null); setSelectedCell(null); }}
      style={{
        width: '100%',
        aspectRatio: '16/9',
        borderRadius: 12,
        overflow: 'hidden',
        position: 'relative',
        background: theme.gradient,
        backgroundImage: theme.gradient,
        backgroundColor: '#0B0118',
        boxShadow: '0 30px 90px rgba(0,0,0,0.55), 0 0 0 1px rgba(246,241,251,0.06)',
      }}
    >
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, zIndex: -1, pointerEvents: 'none', background: theme.gradient, backgroundImage: theme.gradient, backgroundColor: '#0B0118' }} />
      {showGrid && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 350, pointerEvents: 'none', backgroundImage: 'linear-gradient(rgba(246,241,251,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(246,241,251,0.08) 1px, transparent 1px)', backgroundSize: '8.333% 12.5%' }} />
      )}
      {[...(slide.objects || [])].sort((a, b) => (a.z || 0) - (b.z || 0)).map((obj) => {
        if (obj.type === 'shape') return renderShapeObject(obj);
        if (obj.type === 'image') return renderImageObject(obj);
        if (obj.type === 'table') return renderTableObject(obj);
        return renderTextObject(obj);
      })}
      <ResizeHandle />
    </div>
  );

  const chromeBtn = (active = false) => ({
    height: 32,
    padding: '0 12px',
    borderRadius: 8,
    border: `1px solid ${active ? 'rgba(246,241,251,0.28)' : 'rgba(246,241,251,0.10)'}`,
    background: active ? 'rgba(246,241,251,0.06)' : 'transparent',
    color: active ? '#F6F1FB' : 'rgba(246,241,251,0.70)',
    fontFamily: qxType.body,
    fontSize: 12.5,
    fontWeight: 500,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 7,
  });

  const selectedTypeLabel = selectedObject
    ? selectedObject.type === 'table' && selectedCell ? 'Table cell' : `${selectedObject.type.charAt(0).toUpperCase()}${selectedObject.type.slice(1)} object`
    : 'No object selected';

  const selectedFontStyle = selectedObject?.type === 'table' && selectedCell
    ? selectedObject.rows?.[selectedCell.row]?.[selectedCell.col]?.style || {}
    : selectedObject?.style || {};

  const agentQuickPrompts = [
    { label: 'Split layout', text: `make slide ${agentSlideIndex + 1} split layout` },
    { label: 'Table layout', text: `make slide ${agentSlideIndex + 1} table layout` },
    { label: 'Add detail', text: `add more information to slide ${agentSlideIndex + 1}` },
    { label: 'Shorten title', text: `make the title of slide ${agentSlideIndex + 1} shorter` },
  ];

  const panelTabs = [
    { key: 'style', label: 'Style', sub: 'Text' },
    { key: 'layout', label: 'Layouts', sub: 'Slide' },
    { key: 'image', label: 'Images', sub: 'Media' },
    { key: 'table', label: 'Tables', sub: 'Rows' },
  ];
  const canFormatText = selectedObject && ['text', 'table'].includes(selectedObject.type);
  const selectedSummary = selectedObject
    ? `${selectedTypeLabel}${selectedObject.role ? ` · ${selectedObject.role}` : ''}`
    : 'Select any object on the slide';
  const imageSearchValue = imgQuery.trim() || selectedObject?.prompt || slide.imagePrompt || slide.title || '';
  const activeImageObject = selectedObject?.type === 'image' ? selectedObject : null;

  const inspectorPanel = {
    width: 380,
    flexShrink: 0,
    borderLeft: '1px solid rgba(246,241,251,0.10)',
    background: 'linear-gradient(180deg, rgba(23,7,41,0.98) 0%, rgba(11,1,24,0.99) 100%)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: '-24px 0 70px rgba(0,0,0,0.25)',
  };
  const inspectorHeader = {
    padding: '18px 20px 14px',
    borderBottom: '1px solid rgba(246,241,251,0.08)',
    background: 'linear-gradient(180deg, rgba(246,241,251,0.035), rgba(246,241,251,0.012))',
  };
  const inspectorCard = {
    border: '1px solid rgba(246,241,251,0.10)',
    background: 'rgba(246,241,251,0.045)',
    borderRadius: 14,
    padding: 14,
    boxShadow: '0 12px 30px rgba(0,0,0,0.12)',
  };
  const sectionTitle = {
    fontFamily: qxType.mono,
    fontSize: 9,
    letterSpacing: '0.22em',
    textTransform: 'uppercase',
    color: 'rgba(246,241,251,0.46)',
    marginBottom: 10,
  };
  const inspectorButton = (variant = 'ghost', disabled = false) => ({
    height: 38,
    padding: '0 13px',
    borderRadius: 10,
    border: variant === 'primary' ? '1px solid rgba(212,255,63,0.55)' : '1px solid rgba(246,241,251,0.11)',
    background: variant === 'primary' ? QX.lime : variant === 'danger' ? 'rgba(188,59,35,0.12)' : 'rgba(246,241,251,0.045)',
    color: variant === 'primary' ? QX.limeInk : variant === 'danger' ? '#FCA5A5' : 'rgba(246,241,251,0.84)',
    fontFamily: qxType.body,
    fontSize: 12.5,
    fontWeight: variant === 'primary' ? 800 : 650,
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.45 : 1,
    textAlign: 'center',
  });
  const compactField = {
    ...panelInput,
    height: 40,
    borderRadius: 10,
    background: 'rgba(5,0,12,0.35)',
    border: '1px solid rgba(246,241,251,0.13)',
    fontFamily: qxType.body,
    fontSize: 13,
  };
  const rowLabel = {
    fontFamily: qxType.body,
    fontSize: 12.5,
    fontWeight: 650,
    color: 'rgba(246,241,251,0.86)',
  };

  return (
    <div style={{ height: '100vh', background: '#0B0118', display: 'flex', flexDirection: 'column', fontFamily: qxType.body, userSelect: editingObjectId ? 'text' : 'none', overflow: 'hidden' }}
      onClick={() => { setShowMenu(false); setShowThemePop(false); setShowAddMenu(false); }}>

      <div style={{ padding: '14px 24px', borderBottom: '1px solid rgba(246,241,251,0.08)', display: 'flex', alignItems: 'center', gap: 14, background: 'rgba(0,0,0,0.30)', flexShrink: 0, position: 'relative', zIndex: 50 }}
        onClick={(e) => e.stopPropagation()}>
        <button onClick={onBack} style={{ ...chromeBtn(), padding: '0 10px' }}>Back</button>
        <div style={{ width: 1, height: 22, background: 'rgba(246,241,251,0.10)' }} />
        <div style={{ width: 36, height: 36, borderRadius: 9, background: 'linear-gradient(135deg,#3D0F6E 0%,#7B2FBE 100%)', border: '1px solid rgba(246,241,251,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span style={{ fontFamily: qxType.mono, fontSize: 10, fontWeight: 800, color: QX.lime, letterSpacing: '0.04em' }}>QX</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
          <span style={{ fontFamily: qxType.mono, fontSize: 9, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'rgba(246,241,251,0.45)' }}>AutoDeck · Quidax</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 2 }}>
            <span style={{ fontFamily: qxType.display, fontSize: 15, fontWeight: 600, color: '#F6F1FB', letterSpacing: '-0.012em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 300 }}>{deckTitle}</span>
            <span style={{ fontFamily: qxType.mono, fontSize: 10, color: 'rgba(246,241,251,0.40)', letterSpacing: '0.14em' }}>{String(currentIndex + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Insert dropdown */}
          <div style={{ position: 'relative' }}>
            <button onClick={(e) => { e.stopPropagation(); setShowAddMenu((p) => !p); setShowMenu(false); setShowThemePop(false); }} style={{ ...chromeBtn(showAddMenu), gap: 6 }}>
              <span style={{ fontSize: 14, lineHeight: 1, marginTop: -1 }}>+</span> Add
              <span style={{ fontSize: 8, opacity: 0.65, marginLeft: 1 }}>▾</span>
            </button>
            {showAddMenu && (
              <div style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, background: '#170729', border: '1px solid rgba(246,241,251,0.10)', borderRadius: 12, padding: 6, minWidth: 210, zIndex: 300, boxShadow: '0 18px 50px rgba(0,0,0,0.6)' }}>
                {[
                  { icon: '+', label: 'New Slide', sub: 'Insert after current', action: () => { addNewSlide(); setShowAddMenu(false); }, accent: true },
                ].map(({ icon, label, sub, action, accent }) => (
                  <button key={label} onClick={action} style={{ display: 'flex', alignItems: 'center', gap: 11, width: '100%', padding: '10px 12px', borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(246,241,251,0.06)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: accent ? 'rgba(212,255,63,0.13)' : 'rgba(246,241,251,0.07)', border: `1px solid ${accent ? 'rgba(212,255,63,0.30)' : 'rgba(246,241,251,0.10)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: accent ? QX.lime : '#F6F1FB', fontSize: accent ? 20 : 14, fontWeight: 700, flexShrink: 0 }}>{icon}</div>
                    <div>
                      <div style={{ fontFamily: qxType.body, fontSize: 13, fontWeight: 650, color: '#F6F1FB' }}>{label}</div>
                      <div style={{ fontFamily: qxType.mono, fontSize: 8.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(246,241,251,0.42)', marginTop: 2 }}>{sub}</div>
                    </div>
                  </button>
                ))}
                <div style={{ height: 1, background: 'rgba(246,241,251,0.08)', margin: '4px 6px' }} />
                {[
                  { icon: 'T', label: 'Text box', sub: 'Heading or body', action: () => { addTextbox(); setShowAddMenu(false); } },
                  { icon: '⊞', label: 'Table', sub: 'Editable rows', action: () => { addTable(); setShowAddMenu(false); } },
                  { icon: '▭', label: 'Image', sub: 'Search or upload', action: () => { addImagePlaceholder(); setShowAddMenu(false); } },
                ].map(({ icon, label, sub, action }) => (
                  <button key={label} onClick={action} style={{ display: 'flex', alignItems: 'center', gap: 11, width: '100%', padding: '10px 12px', borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(246,241,251,0.06)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(246,241,251,0.07)', border: '1px solid rgba(246,241,251,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F6F1FB', fontSize: 14, fontWeight: 700, flexShrink: 0 }}>{icon}</div>
                    <div>
                      <div style={{ fontFamily: qxType.body, fontSize: 13, fontWeight: 650, color: '#F6F1FB' }}>{label}</div>
                      <div style={{ fontFamily: qxType.mono, fontSize: 8.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(246,241,251,0.42)', marginTop: 2 }}>{sub}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div style={{ width: 1, height: 18, background: 'rgba(246,241,251,0.12)', margin: '0 3px' }} />
          {/* View group */}
          <button onClick={() => setShowGrid((s) => !s)} title="Toggle grid (G)" style={chromeBtn(showGrid)}>Grid</button>
          <div style={{ position: 'relative' }}>
            <button onClick={(e) => { e.stopPropagation(); setShowThemePop((p) => !p); setShowMenu(false); }} style={chromeBtn(showThemePop)}>
              <span style={{ width: 14, height: 14, borderRadius: '50%', background: theme.swatch, border: '1px solid rgba(246,241,251,0.3)', display: 'inline-block' }} />
              Theme
            </button>
            {showThemePop && (
              <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, background: '#170729', border: '1px solid rgba(246,241,251,0.10)', borderRadius: 12, padding: 14, width: 240, zIndex: 300, boxShadow: '0 18px 50px rgba(0,0,0,0.6)' }}>
                <div style={{ fontFamily: qxType.mono, fontSize: 9, letterSpacing: '0.30em', textTransform: 'uppercase', color: 'rgba(246,241,251,0.45)', marginBottom: 10 }}>Deck theme</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 7 }}>
                  {Object.entries(THEMES).map(([k, t]) => (
                    <button key={k} title={t.name} onClick={() => setGlobalTheme(k)} style={{ aspectRatio: '1', borderRadius: 8, padding: 0, cursor: 'pointer', background: t.gradient, border: globalTheme === k ? '2px solid #F6F1FB' : '1px solid rgba(246,241,251,0.10)' }} />
                  ))}
                </div>
                <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: qxType.body, fontSize: 12, color: 'rgba(246,241,251,0.72)' }}>
                  <span>Active</span>
                  <strong style={{ color: '#F6F1FB', fontWeight: 700 }}>{theme.name}</strong>
                </div>
              </div>
            )}
          </div>
          <div style={{ width: 1, height: 18, background: 'rgba(246,241,251,0.12)', margin: '0 3px' }} />
          {/* AI agent */}
          <button onClick={() => agentOpen ? setAgentOpen(false) : openAgent(currentIndex)} style={{ ...chromeBtn(agentOpen), borderColor: agentOpen ? QX.lime : 'rgba(212,255,63,0.35)', color: QX.lime }}>Agent</button>
          <div style={{ width: 1, height: 18, background: 'rgba(246,241,251,0.12)', margin: '0 3px' }} />
          {/* Primary action */}
          <button onClick={handlePresent} style={{ height: 36, padding: '0 20px', borderRadius: 9, border: 'none', background: QX.lime, color: '#1A0530', fontFamily: qxType.body, fontSize: 13, fontWeight: 800, cursor: 'pointer', letterSpacing: '0.01em' }}>Present</button>
          <div style={{ position: 'relative' }}>
            <button aria-label="Export menu" title="Export menu" onClick={(e) => { e.stopPropagation(); setShowMenu((p) => !p); setShowThemePop(false); }} style={{ ...chromeBtn(showMenu), width: 32, padding: 0, justifyContent: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                <circle cx="4" cy="8" r="1.4" fill="currentColor" />
                <circle cx="8" cy="8" r="1.4" fill="currentColor" />
                <circle cx="12" cy="8" r="1.4" fill="currentColor" />
              </svg>
            </button>
            {showMenu && (
              <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, background: '#170729', border: '1px solid rgba(246,241,251,0.10)', borderRadius: 12, padding: 6, minWidth: 230, zIndex: 300, boxShadow: '0 18px 50px rgba(0,0,0,0.6)' }}>
                <MenuItem label="Export as PDF" sub="Print current slide" onClick={() => { setShowMenu(false); window.print(); }} />
                <MenuItem label="Download .pptx" sub="PowerPoint format" onClick={handleDownloadPPTX} />
                <MenuItem label="Save slide as PNG" sub="Current slide only" onClick={handleDownloadPNG} />
                <div style={{ height: 1, background: 'rgba(246,241,251,0.08)', margin: '4px 0' }} />
                <MenuItem label="Share link" sub="Copy shareable URL" onClick={handleShare} />
                <MenuItem label="Duplicate deck" sub="Save a copy to library" onClick={handleDuplicate} />
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '28px 64px', position: 'relative' }}>
          <button onClick={() => goTo(currentIndex - 1)} disabled={currentIndex === 0} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', width: 38, height: 38, borderRadius: '50%', border: '1px solid rgba(246,241,251,0.14)', background: 'rgba(246,241,251,0.04)', color: 'rgba(246,241,251,0.7)', cursor: currentIndex === 0 ? 'default' : 'pointer' }}>‹</button>
          <div style={{ width: '100%', maxWidth: (editPanelOpen || agentOpen) ? 880 : 1040, transition: `max-width 240ms ${qxEase}` }}>
            <ObjectStage />
            <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontFamily: qxType.mono, fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(246,241,251,0.30)' }}>Layout</span>
              <span style={{ fontFamily: qxType.body, fontSize: 11, color: 'rgba(246,241,251,0.55)' }}>{LAYOUTS.find((l) => l.key === layout)?.name || 'Standard'}</span>
              {selectedObject && <><span style={{ color: 'rgba(246,241,251,0.22)', fontSize: 11 }}>·</span><span style={{ fontFamily: qxType.body, fontSize: 11, color: 'rgba(246,241,251,0.42)' }}>{selectedTypeLabel}</span></>}
            </div>
          </div>
          <button onClick={() => goTo(currentIndex + 1)} disabled={currentIndex === total - 1} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', width: 38, height: 38, borderRadius: '50%', border: '1px solid rgba(246,241,251,0.14)', background: 'rgba(246,241,251,0.04)', color: 'rgba(246,241,251,0.7)', cursor: currentIndex === total - 1 ? 'default' : 'pointer' }}>›</button>
        </div>

        {editPanelOpen && (
          <aside style={inspectorPanel} onClick={(e) => e.stopPropagation()} aria-label="Customize slide">
            <div style={inspectorHeader}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ padding: '3px 10px', borderRadius: 999, background: 'rgba(246,241,251,0.06)', border: '1px solid rgba(246,241,251,0.10)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontFamily: qxType.mono, fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(246,241,251,0.50)' }}>Slide</span>
                    <span style={{ fontFamily: qxType.mono, fontSize: 10, fontWeight: 700, color: '#F6F1FB' }}>{String(currentIndex + 1).padStart(2, '0')}</span>
                  </div>
                </div>
                <button onClick={() => setEditPanelOpen(false)} aria-label="Collapse panel" title="Collapse panel" style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid rgba(246,241,251,0.10)', background: 'rgba(246,241,251,0.04)', color: 'rgba(246,241,251,0.50)', cursor: 'pointer', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
              </div>
              <div style={{ marginTop: 12, ...inspectorCard, padding: 12, display: 'flex', alignItems: 'center', gap: 11 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: selectedObject ? 'rgba(212,255,63,0.14)' : 'rgba(246,241,251,0.07)', border: selectedObject ? '1px solid rgba(212,255,63,0.30)' : '1px solid rgba(246,241,251,0.10)', color: selectedObject ? QX.lime : 'rgba(246,241,251,0.50)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, textTransform: 'uppercase' }}>{selectedObject ? selectedObject.type?.[0] : '▤'}</div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontFamily: qxType.body, fontSize: 13.5, fontWeight: 750, color: '#F6F1FB', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedObject ? (selectedObject.content?.slice(0, 28) || selectedObject.alt || selectedObject.role || selectedObject.type) : (LAYOUTS.find((l) => l.key === layout)?.name || 'Standard')}</div>
                  <div style={{ marginTop: 2, fontFamily: qxType.mono, fontSize: 8.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(246,241,251,0.42)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedObject ? selectedSummary : 'Slide layout · click an object to select'}</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 7, marginTop: 12 }}>
                {panelTabs.map((tab) => (
                  <button key={tab.key} onClick={() => setEditTab(tab.key)} style={{ height: 38, borderRadius: 10, border: editTab === tab.key ? '1.5px solid rgba(138,99,255,0.90)' : '1px solid rgba(246,241,251,0.09)', background: editTab === tab.key ? 'rgba(138,99,255,0.18)' : 'rgba(246,241,251,0.035)', color: editTab === tab.key ? '#FFFFFF' : 'rgba(246,241,251,0.55)', cursor: 'pointer', fontFamily: qxType.body, fontSize: 12.5, fontWeight: 700, boxShadow: editTab === tab.key ? '0 0 0 2px rgba(138,99,255,0.22), 0 0 14px rgba(138,99,255,0.16)' : 'none', transition: 'all 150ms' }}>
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {editTab === 'style' && (
                <>
                  {!selectedObject && (
                    <div style={inspectorCard}>
                      <div style={sectionTitle}>Start editing</div>
                      <div style={{ color: '#F6F1FB', fontFamily: qxType.display, fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Select text, image, or table</div>
                      <div style={{ color: 'rgba(246,241,251,0.60)', fontSize: 12.5, lineHeight: 1.45 }}>Click any item on the slide to format, move, duplicate, or delete it.</div>
                    </div>
                  )}
                  {canFormatText && (() => {
                    const currentWeight = selectedFontStyle.fontWeight || (selectedFontStyle.bold ? 700 : 400);
                    const activeColor = selectedFontStyle.color && /^#[0-9a-f]{6}$/i.test(selectedFontStyle.color) ? selectedFontStyle.color : '#F6F1FB';
                    const colorPalette = ['#F6F1FB', '#B890FE', '#D4FF3F', '#7B2FBE', '#0891B2', '#22C55E'];
                    const fieldLabel = { fontFamily: qxType.body, fontSize: 11, fontWeight: 500, color: 'rgba(246,241,251,0.55)', marginBottom: 7, display: 'block' };
                    return (
                      <div style={inspectorCard}>
                        <div style={{ display: 'grid', gap: 14 }}>
                          <div>
                            <span style={fieldLabel}>Text</span>
                            <select value={selectedFontStyle.fontFamily || qxType.body} onChange={(e) => updateSelectedStyle({ fontFamily: e.target.value })} style={compactField}>
                              {[brandConfig?.displayFont, brandConfig?.bodyFont, qxType.display, qxType.body, 'Aptos', 'Aptos Display', 'Arial', 'Georgia', 'Times New Roman'].filter(Boolean).map((f) => <option key={f} value={f}>{String(f).replace(/"/g, '').split(',')[0].trim()}</option>)}
                            </select>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 10 }}>
                            <div>
                              <span style={fieldLabel}>Weight</span>
                              <select value={currentWeight} onChange={(e) => { const w = parseInt(e.target.value); updateSelectedStyle({ fontWeight: w, bold: w >= 600 }); }} style={compactField}>
                                <option value={400}>Regular · 400</option>
                                <option value={500}>Medium · 500</option>
                                <option value={600}>Semibold · 600</option>
                                <option value={700}>Bold · 700</option>
                                <option value={800}>Extra bold · 800</option>
                              </select>
                            </div>
                            <div>
                              <span style={fieldLabel}>Size</span>
                              <div style={{ display: 'flex', alignItems: 'center', height: 40, borderRadius: 10, border: '1px solid rgba(246,241,251,0.13)', background: 'rgba(5,0,12,0.35)', overflow: 'hidden' }}>
                                <button onClick={() => updateSelectedFontSize(Math.max(6, (selectedFontStyle.fontSize || 16) - 1))} style={{ width: 34, height: '100%', border: 'none', borderRight: '1px solid rgba(246,241,251,0.08)', background: 'transparent', color: 'rgba(246,241,251,0.65)', cursor: 'pointer', fontSize: 16, flexShrink: 0 }}>−</button>
                                <input type="number" min="6" max="96" value={selectedFontStyle.fontSize || 16} onChange={(e) => updateSelectedFontSize(e.target.value)} style={{ flex: 1, textAlign: 'center', background: 'transparent', border: 'none', color: '#F6F1FB', fontFamily: qxType.body, fontSize: 13, fontWeight: 600, outline: 'none', padding: 0, width: 0 }} />
                                <button onClick={() => updateSelectedFontSize(Math.min(96, (selectedFontStyle.fontSize || 16) + 1))} style={{ width: 34, height: '100%', border: 'none', borderLeft: '1px solid rgba(246,241,251,0.08)', background: 'transparent', color: 'rgba(246,241,251,0.65)', cursor: 'pointer', fontSize: 16, flexShrink: 0 }}>+</button>
                              </div>
                            </div>
                          </div>
                          <div>
                            <span style={fieldLabel}>Colour</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              {colorPalette.map((hex) => (
                                <button key={hex} onClick={() => updateSelectedStyle({ color: hex })} title={hex} style={{ width: 28, height: 28, borderRadius: 6, background: hex, border: activeColor.toUpperCase() === hex.toUpperCase() ? `2px solid #F6F1FB` : '1.5px solid rgba(246,241,251,0.15)', cursor: 'pointer', padding: 0, flexShrink: 0 }} />
                              ))}
                            </div>
                          </div>
                          <div>
                            <span style={fieldLabel}>Alignment & emphasis</span>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
                              <button onClick={() => updateSelectedStyle({ bold: !selectedFontStyle.bold, fontWeight: selectedFontStyle.bold ? 400 : 700 })} style={miniButton(selectedFontStyle.bold)}>B</button>
                              <button onClick={() => updateSelectedStyle({ italic: !selectedFontStyle.italic })} style={{ ...miniButton(selectedFontStyle.italic), fontStyle: 'italic' }}>I</button>
                              {[['left','←'], ['center','↔'], ['right','→']].map(([a, sym]) => <button key={a} onClick={() => updateSelectedStyle({ align: a })} style={miniButton(selectedFontStyle.align === a)}>{sym}</button>)}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                  {selectedObject?.type === 'shape' && (
                    <div style={inspectorCard}>
                      <div style={sectionTitle}>Fill & opacity</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 96px', gap: 10 }}>
                        <div>
                          <label style={{ ...rowLabel, display: 'block', marginBottom: 7 }}>Fill color</label>
                          <div style={{ position: 'relative' }}>
                            <input type="color" value={selectedObject.style?.fill && /^#[0-9a-f]{6}$/i.test(selectedObject.style.fill) ? selectedObject.style.fill : '#1A0530'} onChange={(e) => updateObject(selectedObjectId, { style: { fill: e.target.value } })} style={{ ...compactField, height: 40, padding: 3, cursor: 'pointer', width: '100%' }} />
                            <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontFamily: qxType.mono, fontSize: 10, color: 'rgba(246,241,251,0.55)', pointerEvents: 'none', letterSpacing: '0.06em' }}>
                              {(selectedObject.style?.fill && /^#[0-9a-f]{6}$/i.test(selectedObject.style.fill) ? selectedObject.style.fill : '#1A0530').toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <div>
                          <label style={{ ...rowLabel, display: 'block', marginBottom: 7 }}>Opacity</label>
                          <input type="number" min="0" max="1" step="0.05" value={Math.round((selectedObject.style?.opacity ?? 1) * 100) / 100} onChange={(e) => updateObject(selectedObjectId, { style: { opacity: Math.min(1, Math.max(0, parseFloat(e.target.value) || 0)) } })} style={compactField} />
                        </div>
                      </div>
                    </div>
                  )}
                  {selectedObject?.type === 'image' && (
                    <div style={inspectorCard}>
                      <div style={sectionTitle}>Image</div>
                      <div style={{ color: 'rgba(246,241,251,0.64)', fontSize: 12.5, lineHeight: 1.45, marginBottom: 10 }}>Search or replace this photo in the Images tab.</div>
                      <button onClick={() => setEditTab('image')} style={{ ...inspectorButton('primary'), width: '100%' }}>Open Images</button>
                    </div>
                  )}
                  <div style={inspectorCard}>
                    <div style={sectionTitle}>Object actions</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <button onClick={duplicateSelected} disabled={!selectedObject} style={inspectorButton('ghost', !selectedObject)}>Duplicate</button>
                      <button onClick={deleteSelected} disabled={!selectedObject} style={inspectorButton('danger', !selectedObject)}>Delete</button>
                      <button onClick={bringForward} disabled={!selectedObject} style={inspectorButton('ghost', !selectedObject)}>Bring forward</button>
                      <button onClick={sendBackward} disabled={!selectedObject} style={inspectorButton('ghost', !selectedObject)}>Send back</button>
                    </div>
                  </div>
                </>
              )}
              {editTab === 'layout' && (() => {
                const lt = (key, active) => {
                  const s = active ? QX.lime : 'rgba(246,241,251,0.30)';
                  const f = active ? 'rgba(212,255,63,0.18)' : 'rgba(246,241,251,0.08)';
                  const shapes = {
                    standard:          (<><rect x="3" y="5" width="22" height="3" rx="1" fill={s} /><rect x="3" y="11" width="18" height="1.5" rx="0.75" fill={s} opacity="0.5" /><rect x="3" y="14.5" width="14" height="1.5" rx="0.75" fill={s} opacity="0.4" /></>),
                    split:             (<><rect x="3" y="4" width="11" height="14" rx="1" fill={f} stroke={s} strokeWidth="0.6" /><rect x="16" y="4" width="9" height="14" rx="1" fill={f} stroke={s} strokeWidth="0.6" /></>),
                    bigTitle:          (<><rect x="3" y="7" width="22" height="5" rx="1" fill={s} /><rect x="3" y="15" width="12" height="1.5" rx="0.75" fill={s} opacity="0.4" /></>),
                    stat:              (<><rect x="9" y="4" width="10" height="8" rx="1" fill={f} stroke={s} strokeWidth="0.6" /><rect x="7" y="15" width="14" height="2" rx="1" fill={s} opacity="0.4" /></>),
                    quote:             (<><rect x="5" y="7" width="18" height="2" rx="1" fill={s} opacity="0.7" /><rect x="5" y="11" width="18" height="2" rx="1" fill={s} opacity="0.7" /><rect x="9" y="15" width="10" height="1.5" rx="0.75" fill={s} opacity="0.3" /></>),
                    image:             (<><rect x="3" y="4" width="10" height="14" rx="1" fill={f} stroke={s} strokeWidth="0.6" /><rect x="15" y="5" width="10" height="2.5" rx="1" fill={s} /><rect x="15" y="10" width="8" height="1.5" rx="0.75" fill={s} opacity="0.4" /><rect x="15" y="13" width="8" height="1.5" rx="0.75" fill={s} opacity="0.4" /></>),
                    minimal:           (<><rect x="4" y="9" width="20" height="4" rx="1" fill={s} /></>),
                    centered:          (<><rect x="7" y="5" width="14" height="3" rx="1" fill={s} /><rect x="8" y="11" width="12" height="1.5" rx="0.75" fill={s} opacity="0.5" /><rect x="10" y="14.5" width="8" height="1.5" rx="0.75" fill={s} opacity="0.35" /></>),
                    process_flow:      (<><rect x="2" y="7" width="7" height="8" rx="1" fill={f} stroke={s} strokeWidth="0.6" /><rect x="11" y="7" width="7" height="8" rx="1" fill={f} stroke={s} strokeWidth="0.6" /><rect x="20" y="7" width="6" height="8" rx="1" fill={f} stroke={s} strokeWidth="0.6" /></>),
                    comparison:        (<><rect x="3" y="4" width="10" height="14" rx="1" fill={f} stroke={s} strokeWidth="0.6" /><rect x="15" y="4" width="10" height="14" rx="1" fill={f} stroke={s} strokeWidth="0.6" /></>),
                    table_matrix:      (<><rect x="3" y="4" width="22" height="3" rx="0.5" fill={s} opacity="0.75" /><rect x="3" y="9" width="22" height="2" rx="0.5" fill={s} opacity="0.3" /><rect x="3" y="13" width="22" height="2" rx="0.5" fill={s} opacity="0.3" /></>),
                    timeline:          (<><line x1="3" y1="11" x2="25" y2="11" stroke={s} strokeWidth="1.5" opacity="0.5" /><circle cx="8" cy="11" r="2" fill={s} /><circle cx="15" cy="11" r="2" fill={s} /><circle cx="22" cy="11" r="2" fill={s} /></>),
                    statistics:        (<><rect x="2" y="4" width="10" height="7" rx="1" fill={f} stroke={s} strokeWidth="0.5" /><rect x="14" y="4" width="10" height="7" rx="1" fill={f} stroke={s} strokeWidth="0.5" /><rect x="2" y="13" width="10" height="6" rx="1" fill={f} stroke={s} strokeWidth="0.5" /><rect x="14" y="13" width="10" height="6" rx="1" fill={f} stroke={s} strokeWidth="0.5" /></>),
                    hierarchy:         (<><rect x="9" y="3" width="10" height="4" rx="1" fill={s} opacity="0.8" /><rect x="4" y="10" width="8" height="4" rx="1" fill={s} opacity="0.5" /><rect x="16" y="10" width="8" height="4" rx="1" fill={s} opacity="0.5" /></>),
                    roadmap:           (<><rect x="2" y="7" width="7" height="8" rx="1" fill={f} stroke={s} strokeWidth="0.6" /><rect x="11" y="7" width="7" height="8" rx="1" fill={f} stroke={s} strokeWidth="0.6" /><rect x="20" y="7" width="6" height="8" rx="1" fill={f} stroke={s} strokeWidth="0.6" /></>),
                    problem_solution:  (<><rect x="3" y="5" width="10" height="12" rx="1" fill={f} stroke={s} strokeWidth="0.6" /><rect x="15" y="5" width="10" height="12" rx="1" fill={active ? 'rgba(212,255,63,0.28)' : 'rgba(246,241,251,0.12)'} stroke={s} strokeWidth="0.6" /></>),
                    feature_breakdown: (<><rect x="2" y="4" width="7" height="14" rx="1" fill={f} stroke={s} strokeWidth="0.6" /><rect x="11" y="4" width="6" height="14" rx="1" fill={f} stroke={s} strokeWidth="0.6" /><rect x="19" y="4" width="7" height="14" rx="1" fill={f} stroke={s} strokeWidth="0.6" /></>),
                    summary:           (<><rect x="3" y="5" width="22" height="2" rx="1" fill={s} /><rect x="3" y="9.5" width="22" height="1.5" rx="0.75" fill={s} opacity="0.5" /><rect x="3" y="13" width="22" height="1.5" rx="0.75" fill={s} opacity="0.5" /><rect x="3" y="16.5" width="14" height="1.5" rx="0.75" fill={s} opacity="0.35" /></>),
                    image_focus:       (<><rect x="0" y="0" width="28" height="22" fill={f} stroke={s} strokeWidth="0.5" /><rect x="4" y="7" width="20" height="3" rx="1" fill={s} /><rect x="7" y="13" width="14" height="1.5" rx="0.75" fill={s} opacity="0.4" /></>),
                  };
                  return (
                    <svg viewBox="0 0 28 22" style={{ display: 'block', width: '100%', height: 48 }}>
                      {shapes[key] || shapes.standard}
                    </svg>
                  );
                };
                return (
                  <div style={inspectorCard}>
                    <div style={{ fontFamily: qxType.body, fontSize: 13, fontWeight: 700, color: '#F6F1FB', marginBottom: 4 }}>Choose a layout</div>
                    <div style={{ fontSize: 11.5, color: 'rgba(246,241,251,0.50)', lineHeight: 1.5, marginBottom: 14 }}>Switching layout rebuilds this slide's objects from your content.</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      {LAYOUTS.map((l) => {
                        const active = layout === l.key;
                        return (
                          <button key={l.key} onClick={() => applyLayout(l.key)} style={{ borderRadius: 10, border: active ? `1.5px solid ${QX.lime}` : '1px solid rgba(246,241,251,0.10)', background: active ? 'rgba(212,255,63,0.08)' : 'rgba(5,0,12,0.28)', cursor: 'pointer', textAlign: 'left', padding: '10px 10px 8px', boxShadow: active ? `0 0 0 3px rgba(212,255,63,0.06)` : 'none' }}>
                            {lt(l.key, active)}
                            <div style={{ fontSize: 12, fontWeight: 700, color: active ? QX.lime : '#F6F1FB', marginTop: 6 }}>{l.name}</div>
                            <div style={{ marginTop: 3, fontFamily: qxType.mono, fontSize: 7.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(246,241,251,0.38)' }}>{l.desc}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
              {editTab === 'image' && (
                <>
                  <div style={inspectorCard}>
                    <div style={sectionTitle}>Selected image</div>
                    {activeImageObject ? (
                      <div style={{ display: 'grid', gap: 10 }}>
                        {activeImageObject.src ? (
                        <div style={{ aspectRatio: '16/9', borderRadius: 10, overflow: 'hidden', background: `url(${activeImageObject.src}) center/cover no-repeat`, border: '1px solid rgba(246,241,251,0.10)' }} />
                      ) : (
                        <div style={{ aspectRatio: '16/9', borderRadius: 10, border: '1.5px dashed rgba(246,241,251,0.22)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                          <span style={{ fontFamily: qxType.mono, fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(246,241,251,0.38)' }}>Empty frame</span>
                          <span style={{ fontFamily: qxType.mono, fontSize: 8, letterSpacing: '0.14em', color: 'rgba(246,241,251,0.22)' }}>16 : 9</span>
                        </div>
                      )}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                          <button onClick={() => fetchImages(1, imageSearchValue)} disabled={imgGenerating} style={inspectorButton('primary', imgGenerating)}>{imgGenerating ? 'Searching...' : 'Replace'}</button>
                          <button onClick={removeImage} style={inspectorButton('ghost')}>Clear</button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gap: 11 }}>
                        <div style={{ color: 'rgba(246,241,251,0.64)', fontSize: 12.5, lineHeight: 1.45 }}>No image is selected. Add a frame or search below to insert one.</div>
                        <button onClick={addImagePlaceholder} style={{ ...inspectorButton('ghost'), width: '100%' }}>Add image frame</button>
                      </div>
                    )}
                  </div>
                  <div style={inspectorCard}>
                    <div style={sectionTitle}>Search Unsplash</div>
                    <input value={imgQuery} onChange={(e) => setImgQuery(e.target.value)} placeholder={selectedObject?.prompt || slide.imagePrompt || 'Describe the image you need'} style={compactField} />
                    <button onClick={() => { setImgPage(1); fetchImages(1); }} disabled={imgGenerating || !imageSearchValue} style={{ ...inspectorButton('primary', imgGenerating || !imageSearchValue), width: '100%', marginTop: 9 }}>{imgGenerating ? 'Finding photos...' : 'Search Unsplash'}</button>
                    {imgResults.length > 0 && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginTop: 12 }}>
                        {imgResults.map((img) => (
                          <button key={img.id} onClick={() => applyImage(img)} style={{ padding: 0, border: selectedObject?.src === img.src ? `2px solid ${QX.lime}` : '1px solid rgba(246,241,251,0.10)', borderRadius: 10, overflow: 'hidden', cursor: 'pointer', aspectRatio: '16/9', background: `url(${img.thumb}) center/cover no-repeat`, boxShadow: '0 10px 24px rgba(0,0,0,0.18)' }} title={img.alt} aria-label={`Use image ${img.alt || img.id}`} />
                        ))}
                      </div>
                    )}
                    {imgResults.length > 0 && <button onClick={() => { const next = imgPage + 1; setImgPage(next); fetchImages(next); }} disabled={imgGenerating} style={{ ...inspectorButton('ghost', imgGenerating), width: '100%', marginTop: 9 }}>More images</button>}
                  </div>
                  <div style={inspectorCard}>
                    <div style={sectionTitle}>Use image URL</div>
                    <input value={imgUrl} onChange={(e) => setImgUrl(e.target.value)} placeholder="https://..." style={compactField} />
                    <button onClick={applyImageUrl} disabled={!imgUrl.trim()} style={{ ...inspectorButton('ghost', !imgUrl.trim()), width: '100%', marginTop: 9 }}>Apply URL</button>
                  </div>
                </>
              )}
              {editTab === 'table' && (() => {
                const headerPresets = [
                  { label: 'Lime',    bg: '#D4FF3F', text: '#1A0530' },
                  { label: 'Lilac',   bg: '#B890FE', text: '#1A0530' },
                  { label: 'Brand',   bg: '#7B2FBE', text: '#F6F1FB' },
                  { label: 'Surface', bg: '#170729', text: 'rgba(246,241,251,0.55)' },
                  { label: 'Green',   bg: '#22C55E', text: '#1A0530' },
                ];
                const bodyPresets = [
                  { label: 'Subtle',  bg: 'transparent' },
                  { label: 'Surface', bg: 'rgba(246,241,251,0.05)' },
                  { label: 'Deep',    bg: 'rgba(26,5,48,0.70)' },
                  { label: 'Violet',  bg: 'rgba(123,47,190,0.22)' },
                  { label: 'Stripe',  bg: 'rgba(246,241,251,0.02)', stripe: true },
                ];
                const isTbl = selectedObject?.type === 'table';
                const curHdrFill = selectedObject?.style?.headerFill || '#D4FF3F';
                const curHdrText = selectedObject?.style?.headerText || '#1A0530';
                const curBdyFill = selectedObject?.style?.bodyFill ?? 'transparent';
                const curAlt     = selectedObject?.style?.alternateRows || false;
                const activeHdr  = headerPresets.find(p => p.bg === curHdrFill) || headerPresets[0];
                const activeBdy  = bodyPresets.find(p => p.bg === curBdyFill)  || bodyPresets[0];
                const previewRows = selectedObject?.rows?.slice(0, 3) || [];
                const colCount = previewRows[0]?.length || 3;
                return (
                  <>
                    {/* Show table styling when a table is selected */}
                    {isTbl ? (
                      <>
                        {/* Live mini preview */}
                        <div style={inspectorCard}>
                          <div style={{ ...sectionTitle, marginBottom: 10 }}>Table preview</div>
                          <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(246,241,251,0.10)' }}>
                            {previewRows.length > 0 ? previewRows.map((row, ri) => {
                              const isHdr = ri === 0;
                              const isAlt = !isHdr && curAlt && ri % 2 === 0;
                              const rowBg = isHdr ? curHdrFill : isAlt ? 'rgba(246,241,251,0.07)' : curBdyFill;
                              const rowClr = isHdr ? curHdrText : (selectedObject?.style?.bodyText || '#F6F1FB');
                              return (
                                <div key={ri} style={{ display: 'grid', gridTemplateColumns: `repeat(${row.length}, 1fr)`, borderBottom: ri < previewRows.length - 1 ? '1px solid rgba(246,241,251,0.08)' : 'none' }}>
                                  {row.map((cell, ci) => (
                                    <div key={ci} style={{ padding: '7px 10px', background: rowBg, color: rowClr, fontFamily: qxType.body, fontSize: 11, fontWeight: isHdr ? 700 : 400, borderRight: ci < row.length - 1 ? '1px solid rgba(246,241,251,0.08)' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {cell.text || ''}
                                    </div>
                                  ))}
                                </div>
                              );
                            }) : (
                              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${colCount}, 1fr)` }}>
                                {Array.from({ length: colCount }).map((_, ci) => (
                                  <div key={ci} style={{ padding: '7px 10px', background: curHdrFill, color: curHdrText, fontFamily: qxType.body, fontSize: 11, fontWeight: 700, borderRight: ci < colCount - 1 ? '1px solid rgba(246,241,251,0.08)' : 'none' }}>Col {ci + 1}</div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Header row colour */}
                        <div style={inspectorCard}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                            <span style={{ fontFamily: qxType.body, fontSize: 12.5, fontWeight: 650, color: '#F6F1FB' }}>Header row</span>
                            <span style={{ fontFamily: qxType.body, fontSize: 11.5, color: 'rgba(246,241,251,0.45)' }}>{activeHdr.label}</span>
                          </div>
                          <div style={{ display: 'flex', gap: 7 }}>
                            {headerPresets.map(p => (
                              <button key={p.label} title={p.label} onClick={() => updateObject(selectedObjectId, { style: { headerFill: p.bg, headerText: p.text } })}
                                style={{ flex: 1, height: 44, borderRadius: 12, background: p.bg, border: curHdrFill === p.bg ? '2px solid rgba(138,99,255,0.90)' : '1.5px solid rgba(246,241,251,0.12)', cursor: 'pointer', padding: 0, transition: 'border 130ms', boxShadow: curHdrFill === p.bg ? '0 0 0 3px rgba(138,99,255,0.25)' : 'none' }} />
                            ))}
                          </div>
                        </div>

                        {/* Body rows colour */}
                        <div style={inspectorCard}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                            <span style={{ fontFamily: qxType.body, fontSize: 12.5, fontWeight: 650, color: '#F6F1FB' }}>Body rows</span>
                            <span style={{ fontFamily: qxType.body, fontSize: 11.5, color: 'rgba(246,241,251,0.45)' }}>{activeBdy.label}</span>
                          </div>
                          <div style={{ display: 'flex', gap: 7 }}>
                            {bodyPresets.map(p => (
                              <button key={p.label} title={p.label} onClick={() => updateObject(selectedObjectId, { style: { bodyFill: p.bg } })}
                                style={{ flex: 1, height: 44, borderRadius: 12, background: p.stripe ? 'repeating-linear-gradient(135deg,rgba(246,241,251,0.12) 0px,rgba(246,241,251,0.12) 3px,rgba(11,1,24,0.80) 3px,rgba(11,1,24,0.80) 9px)' : (p.bg === 'transparent' ? 'rgba(246,241,251,0.05)' : p.bg), border: curBdyFill === p.bg ? '2px solid rgba(138,99,255,0.90)' : '1.5px solid rgba(246,241,251,0.12)', cursor: 'pointer', padding: 0, transition: 'border 130ms', boxShadow: curBdyFill === p.bg ? '0 0 0 3px rgba(138,99,255,0.25)' : 'none' }} />
                            ))}
                          </div>
                        </div>

                        {/* Alternate row shading */}
                        <div style={{ ...inspectorCard, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontFamily: qxType.body, fontSize: 12.5, fontWeight: 650, color: '#F6F1FB' }}>Alternate row shading</span>
                          <button onClick={() => updateObject(selectedObjectId, { style: { alternateRows: !curAlt } })}
                            style={{ width: 44, height: 26, borderRadius: 13, border: 'none', background: curAlt ? QX.lime : 'rgba(246,241,251,0.14)', cursor: 'pointer', position: 'relative', transition: 'background 180ms', flexShrink: 0, padding: 0 }}>
                            <span style={{ position: 'absolute', top: 3, left: curAlt ? 21 : 3, width: 20, height: 20, borderRadius: '50%', background: curAlt ? '#1A0530' : '#F6F1FB', transition: 'left 180ms', display: 'block' }} />
                          </button>
                        </div>

                        {/* Add table — inside card to match the lilac card appearance */}
                        <div style={inspectorCard}>
                          <button onClick={addTable} style={{ ...inspectorButton('ghost'), width: '100%' }}>Add table</button>
                        </div>
                      </>
                    ) : (
                      /* No table selected — prompt to insert */
                      <>
                        <div style={inspectorCard}>
                          <div style={sectionTitle}>Tables</div>
                          <div style={{ color: 'rgba(246,241,251,0.55)', fontFamily: qxType.body, fontSize: 12.5, lineHeight: 1.5, marginBottom: 16 }}>Insert a table, click any cell to edit it, then set row colours below.</div>
                          <div style={{ fontFamily: qxType.mono, fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(246,241,251,0.30)', marginBottom: 8 }}>Preview</div>
                          <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(246,241,251,0.10)', marginBottom: 14 }}>
                            {[
                              { cells: ['Plan', 'Price', 'Seats'], isHeader: true },
                              { cells: ['Starter', '$0', '3'], isHeader: false },
                              { cells: ['Growth', '$49', '20'], isHeader: false },
                            ].map((row, ri) => (
                              <div key={ri} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', borderBottom: ri < 2 ? '1px solid rgba(246,241,251,0.08)' : 'none' }}>
                                {row.cells.map((cell, ci) => (
                                  <div key={ci} style={{ padding: '7px 10px', background: row.isHeader ? '#D4FF3F' : 'transparent', color: row.isHeader ? '#1A0530' : 'rgba(246,241,251,0.80)', fontFamily: qxType.body, fontSize: 11, fontWeight: row.isHeader ? 700 : 400, borderRight: ci < 2 ? '1px solid rgba(246,241,251,0.08)' : 'none' }}>{cell}</div>
                                ))}
                              </div>
                            ))}
                          </div>
                          <button onClick={addTable} style={{ height: 38, padding: '0 13px', borderRadius: 10, border: '1px solid rgba(196,169,240,0.35)', background: '#C4A9F0', color: '#1A0530', fontFamily: qxType.body, fontSize: 12.5, fontWeight: 800, cursor: 'pointer', width: '100%', textAlign: 'center' }}>+ Add table</button>
                        </div>
                      </>
                    )}
                  </>
                );
              })()}
            </div>
            <div style={{ padding: '10px 18px 12px', borderTop: '1px solid rgba(246,241,251,0.06)', display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: QX.lime, display: 'inline-block', flexShrink: 0 }} />
              <span style={{ fontFamily: qxType.body, fontSize: 11, color: 'rgba(246,241,251,0.36)' }}>Double-click any element to edit</span>
            </div>
          </aside>
        )}

        {agentOpen && (
          <aside style={{ ...inspectorPanel, width: 360, borderLeft: `1px solid rgba(212,255,63,0.18)`, background: 'linear-gradient(180deg, #0E0220 0%, #080115 100%)' }} onClick={(e) => e.stopPropagation()} aria-label="AI Agent">
            {/* Header */}
            <div style={{ padding: '16px 18px 14px', borderBottom: '1px solid rgba(246,241,251,0.09)', background: 'linear-gradient(180deg,rgba(212,255,63,0.05),rgba(212,255,63,0.02))', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: QX.lime, flexShrink: 0 }} />
                    <span style={{ fontFamily: qxType.mono, fontSize: 9, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'rgba(246,241,251,0.45)' }}>Agent · Slide {agentSlideIndex + 1}</span>
                    <span style={{ fontFamily: qxType.mono, fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(246,241,251,0.30)' }}>· {LAYOUTS.find((l) => l.key === (localSlides[agentSlideIndex]?.renderLayout || localSlides[agentSlideIndex]?.layout))?.name || 'Standard'}</span>
                  </div>
                  <div style={{ fontFamily: qxType.display, fontSize: 14, fontWeight: 600, color: '#F6F1FB', letterSpacing: '-0.012em', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{localSlides[agentSlideIndex]?.title}</div>
                </div>
                <button onClick={() => { setAgentOpen(false); setEditPanelOpen(true); }} style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid rgba(246,241,251,0.10)', background: 'rgba(246,241,251,0.04)', color: 'rgba(246,241,251,0.50)', cursor: 'pointer', flexShrink: 0, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
              </div>
            </div>

            {/* Messages */}
            <div ref={agentScrollRef} style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {agentMessages.map((m, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div style={{ maxWidth: '86%', padding: '10px 13px', borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px', background: m.role === 'user' ? QX.lime : 'rgba(246,241,251,0.07)', color: m.role === 'user' ? '#232126' : 'rgba(246,241,251,0.92)', fontFamily: qxType.body, fontSize: 13, lineHeight: 1.5, fontWeight: m.role === 'user' ? 700 : 400 }}>{m.text}</div>
                </div>
              ))}
              {agentThinking && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: QX.lime, opacity: 0.7 }} />
                  <span style={{ color: 'rgba(246,241,251,0.55)', fontSize: 13, fontFamily: qxType.body }}>Thinking…</span>
                </div>
              )}
            </div>

            {/* Input area */}
            <div style={{ padding: '10px 14px 14px', borderTop: '1px solid rgba(246,241,251,0.09)', background: 'rgba(5,0,12,0.60)', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontFamily: qxType.mono, fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(246,241,251,0.38)' }}>Target · Slide {agentSlideIndex + 1}</div>
                <button onClick={() => { if (agentMessages.some((m) => m.role === 'user')) setAgentHistorySessions((prev) => [{ id: Date.now(), title: agentMessages.find((m) => m.role === 'user')?.text || 'Agent chat', slideIndex: agentSlideIndex, messages: agentMessages }, ...prev].slice(0, 12)); setAgentMessages([agentIntroMessage(agentSlideIndex, true)]); }} style={{ border: 'none', background: 'transparent', color: QX.lime, cursor: 'pointer', fontSize: 11.5, fontWeight: 700, fontFamily: qxType.body }}>New chat</button>
              </div>
              {agentHistoryOpen && agentHistorySessions.length > 0 && (
                <div style={{ border: '1px solid rgba(246,241,251,0.10)', borderRadius: 10, padding: 8, maxHeight: 130, overflowY: 'auto' }}>
                  <div style={{ fontFamily: qxType.mono, fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(246,241,251,0.42)', padding: '2px 4px 7px' }}>Previous chats</div>
                  {agentHistorySessions.map((session) => (
                    <button key={session.id} onClick={() => { setAgentSlideIndex(session.slideIndex); setAgentMessages(session.messages); setAgentHistoryOpen(false); }} style={panelButton}>{session.title}</button>
                  ))}
                </div>
              )}
              <button onClick={() => setAgentHistoryOpen((p) => !p)} disabled={!agentHistorySessions.length} style={{ ...panelButton, opacity: agentHistorySessions.length ? 1 : 0.45, fontSize: 11.5 }}>History</button>
              <div style={{ display: 'flex', gap: 5, overflowX: 'auto', paddingBottom: 2 }}>
                {agentQuickPrompts.map((item) => (
                  <button key={item.label} onClick={() => { setAgentInput(item.text); setTimeout(() => agentInputRef.current?.focus(), 20); }} style={{ flexShrink: 0, padding: '5px 8px', borderRadius: 999, border: '1px solid rgba(246,241,251,0.10)', background: 'rgba(246,241,251,0.04)', color: 'rgba(246,241,251,0.72)', cursor: 'pointer', fontFamily: qxType.body, fontSize: 11.5 }}>{item.label}</button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 7, alignItems: 'flex-end' }}>
                <textarea ref={agentInputRef} value={agentInput} onChange={(e) => setAgentInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAgentSend(); } }} placeholder="Ask Agent to rewrite the title, switch layout, add detail…" rows={2} style={{ flex: 1, minHeight: 46, maxHeight: 110, padding: '11px 12px', borderRadius: 11, border: '1px solid rgba(246,241,251,0.13)', background: 'rgba(246,241,251,0.045)', color: '#F6F1FB', fontFamily: qxType.body, fontSize: 13, outline: 'none', resize: 'vertical', lineHeight: 1.45 }} />
                <button onClick={handleAgentSend} disabled={!agentInput.trim() || agentThinking} style={{ width: 42, height: 42, borderRadius: 11, border: 'none', background: agentInput.trim() && !agentThinking ? QX.lime : 'rgba(246,241,251,0.07)', color: agentInput.trim() && !agentThinking ? '#232126' : 'rgba(246,241,251,0.28)', cursor: agentInput.trim() && !agentThinking ? 'pointer' : 'default', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>→</button>
              </div>
            </div>
          </aside>
        )}
      </div>

      <div style={{ borderTop: '1px solid rgba(246,241,251,0.08)', padding: '10px 24px 12px', overflowX: 'auto', display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(0,0,0,0.30)', flexShrink: 0 }}>
        {localSlides.map((s, i) => {
          const active = i === currentIndex;
          return (
            <button key={i} onClick={() => goTo(i)} style={{ flexShrink: 0, width: 124, padding: 0, cursor: 'pointer', background: 'transparent', border: 'none', display: 'flex', flexDirection: 'column', gap: 5, opacity: active ? 1 : 0.78 }}>
              <div style={{ width: '100%', aspectRatio: '16/9', borderRadius: 5, overflow: 'hidden', position: 'relative', background: (THEMES[slideThemeOverrides[i] || globalTheme] || THEMES.purple).gradient, border: active ? `1px solid ${QX.lime}` : '1px solid rgba(246,241,251,0.08)' }}>
                <div style={{ position: 'absolute', top: 5, left: 7, fontFamily: qxType.mono, fontSize: 7, letterSpacing: '0.2em', color: '#F6F1FB', opacity: 0.7 }}>QX</div>
                <div style={{ position: 'absolute', top: 5, right: 7, fontFamily: qxType.mono, fontSize: 7, letterSpacing: '0.18em', color: '#F6F1FB', opacity: 0.55 }}>{String(i + 1).padStart(2, '0')}</div>
                <div style={{ position: 'absolute', left: 7, right: 7, bottom: 6, fontFamily: qxType.display, fontWeight: 600, fontSize: 7, color: '#F6F1FB', lineHeight: 1.15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1px' }}>
                <span style={{ fontFamily: qxType.mono, fontSize: 9, letterSpacing: '0.18em', color: active ? QX.lime : 'rgba(246,241,251,0.42)' }}>{String(i + 1).padStart(2, '0')}</span>
                <span style={{ fontFamily: qxType.body, fontSize: 10, color: 'rgba(246,241,251,0.45)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 90, textAlign: 'right' }}>{s.title}</span>
              </div>
            </button>
          );
        })}
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: 170, left: '50%', transform: 'translateX(-50%)', background: toast.type === 'success' ? 'rgba(52,199,123,0.14)' : toast.type === 'loading' ? 'rgba(212,255,63,0.10)' : 'rgba(23,7,41,0.94)', border: `1px solid ${toast.type === 'success' ? 'rgba(52,199,123,0.40)' : toast.type === 'loading' ? 'rgba(212,255,63,0.30)' : 'rgba(246,241,251,0.12)'}`, color: toast.type === 'success' ? '#6EE7B7' : toast.type === 'loading' ? QX.lime : '#F6F1FB', padding: '10px 18px', borderRadius: 24, fontFamily: qxType.body, fontSize: 12.5, zIndex: 500 }}>
          {toast.msg}
        </div>
      )}


      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #main-slide, #main-slide * { visibility: visible !important; }
          #main-slide { position: fixed !important; inset: 0 !important; width: 100vw !important; height: 100vh !important; max-width: none !important; border-radius: 0 !important; box-shadow: none !important; }
        }
      `}</style>
    </div>
  );
};

const panelLabel = {
  fontFamily: qxType.mono,
  fontSize: 9,
  letterSpacing: '0.24em',
  textTransform: 'uppercase',
  color: 'rgba(246,241,251,0.42)',
};

const panelInput = {
  width: '100%',
  height: 36,
  borderRadius: 8,
  border: '1px solid rgba(246,241,251,0.12)',
  background: 'rgba(246,241,251,0.05)',
  color: '#F6F1FB',
  padding: '0 10px',
  outline: 'none',
};

const panelButton = {
  padding: '9px 11px',
  borderRadius: 8,
  border: '1px solid rgba(246,241,251,0.08)',
  background: 'rgba(246,241,251,0.03)',
  color: 'rgba(246,241,251,0.78)',
  fontFamily: qxType.body,
  fontSize: 12,
  cursor: 'pointer',
  textAlign: 'left',
};

const miniButton = (active) => ({
  height: 34,
  borderRadius: 7,
  border: active ? `1px solid ${QX.lime}` : '1px solid rgba(246,241,251,0.10)',
  background: active ? 'rgba(212,255,63,0.10)' : 'rgba(246,241,251,0.03)',
  color: active ? QX.lime : 'rgba(246,241,251,0.76)',
  cursor: 'pointer',
  fontWeight: 800,
});

const MenuItem = ({ label, sub, onClick }) => (
  <button onClick={onClick} style={{ width: '100%', padding: '9px 10px', borderRadius: 8, border: 'none', background: 'transparent', color: 'rgba(246,241,251,0.85)', fontFamily: qxType.body, fontSize: 12.5, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 2, textAlign: 'left' }}>
    <span>{label}</span>
    {sub && <span style={{ fontFamily: qxType.mono, fontSize: 9.5, color: 'rgba(246,241,251,0.40)', letterSpacing: '0.10em' }}>{sub}</span>}
  </button>
);

Object.assign(window, { SlideGenerator });
