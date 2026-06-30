// ============================================================
// AutoDeck Slide Layout Components
// CSS-based hybrid renderer. Each layout is a self-contained
// JSX component that reads content from the slide's object
// model and renders via CSS flex/grid so text wraps naturally.
//
// Overlay layer (images, tables, freeform textboxes) is handled
// separately by SlideGenerator's ObjectStage.
// ============================================================

window.AutoDeckSlideLayouts = (() => {

  // ── Data helpers ───────────────────────────────────────────────────────

  const getObj = (slide, role, n = 0) =>
    ((slide.objects || []).filter(o => o.role === role))[n] || {};

  const getItems = (slide) => {
    const fn = window.AutoDeckSlideObjects?.visualItemsFor;
    return fn ? fn(slide) : (slide.bullets || []).map(label => ({ label, detail: '' })).slice(0, 6);
  };

  const itemLabel = (item, fallback = '') =>
    window.AutoDeckSlideObjects?.itemLabel
      ? window.AutoDeckSlideObjects.itemLabel(item, fallback)
      : String(item?.label || item?.value || fallback);

  const itemDetail = (item) =>
    window.AutoDeckSlideObjects?.itemDetail
      ? window.AutoDeckSlideObjects.itemDetail(item)
      : String(item?.detail || item?.description || '');

  // Merge object-model style overrides onto CSS defaults
  const applyStyle = (obj, base) => {
    const s = (obj && obj.style) ? obj.style : {};
    return {
      ...base,
      ...(s.fontSize   !== undefined && { fontSize:   `${s.fontSize}px`             }),
      ...(s.color      !== undefined && { color:       s.color                       }),
      ...(s.fontFamily !== undefined && { fontFamily:  s.fontFamily                  }),
      ...(s.lineHeight !== undefined && { lineHeight:  s.lineHeight                  }),
      ...(s.align      !== undefined && { textAlign:   s.align                       }),
      ...((s.fontWeight !== undefined || s.bold !== undefined) && {
        fontWeight: s.fontWeight || (s.bold ? 700 : (base.fontWeight || 400)),
      }),
      ...(s.italic && { fontStyle: 'italic' }),
    };
  };

  // ── Slot — single clickable/editable text region ───────────────────────

  const Slot = ({ obj = {}, fallback = '', style = {}, tag: Tag = 'div',
                  selectedId, editingId, onSelect, onEdit, onChange }) => {
    const isEditing  = !!(obj.id && editingId  === obj.id);
    const isSelected = !!(obj.id && selectedId === obj.id);
    return (
      <Tag
        data-object-id={obj.id || undefined}
        data-object-type={obj.type || undefined}
        data-object-role={obj.role || undefined}
        role={obj.role === 'title' ? 'heading' : undefined}
        aria-level={obj.role === 'title' ? 2 : undefined}
        onClick={(e)       => { e.stopPropagation(); obj.id && onSelect(obj.id); }}
        onDoubleClick={(e) => { e.stopPropagation(); obj.id && onEdit(obj.id);   }}
        contentEditable={isEditing || undefined}
        suppressContentEditableWarning={isEditing || undefined}
        onBlur={isEditing
          ? (e) => onChange(obj.id, e.currentTarget.textContent || '')
          : undefined}
        onKeyDown={isEditing
          ? (e) => {
              e.stopPropagation();
              if (e.key === 'Escape') { e.preventDefault(); onChange(obj.id, e.currentTarget.textContent || ''); }
            }
          : undefined}
        style={{
          cursor:       isEditing  ? 'text'    : 'default',
          outline:      isEditing  ? `2px solid ${QX.lime}`
                      : isSelected ? `1px solid ${QX.lime}`
                      :              '1px solid transparent',
          borderRadius: 4,
          padding:      (isSelected || isEditing) ? 2 : 0,
          boxSizing:    'border-box',
          ...(isEditing && { whiteSpace: 'pre-wrap' }),
          ...style,
        }}
      >
        {obj.content !== undefined ? obj.content : fallback}
      </Tag>
    );
  };

  // ── BulletSlot — body text that renders as a dash list ────────────────

  const BulletSlot = ({ obj = {}, slide, style = {}, itemStyle = {}, theme,
                        selectedId, editingId, onSelect, onEdit, onChange }) => {
    const isEditing  = !!(obj.id && editingId  === obj.id);
    const isSelected = !!(obj.id && selectedId === obj.id);
    const raw   = obj.content !== undefined ? obj.content : (slide?.bullets || []).join('\n');
    const lines = raw.split('\n').filter(Boolean);

    if (isEditing) {
      return (
        <div
          data-object-id={obj.id || undefined}
          data-object-type={obj.type || undefined}
          data-object-role={obj.role || undefined}
          contentEditable suppressContentEditableWarning
          onBlur={(e)    => onChange(obj.id, e.currentTarget.textContent || '')}
          onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape') { e.preventDefault(); onChange(obj.id, e.currentTarget.textContent || ''); } }}
          onClick={(e)   => { e.stopPropagation(); onSelect(obj.id); }}
          style={{ whiteSpace: 'pre-wrap', outline: `2px solid ${QX.lime}`, borderRadius: 4, padding: 4, ...style }}
        >{raw}</div>
      );
    }

    return (
      <div
        data-object-id={obj.id || undefined}
        data-object-type={obj.type || undefined}
        data-object-role={obj.role || undefined}
        onClick={(e)       => { e.stopPropagation(); obj.id && onSelect(obj.id); }}
        onDoubleClick={(e) => { e.stopPropagation(); obj.id && onEdit(obj.id);   }}
        style={{ outline: isSelected ? `1px solid ${QX.lime}` : '1px solid transparent', borderRadius: 4, padding: isSelected ? 2 : 0, ...style }}
      >
        {lines.map((line, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, ...itemStyle }}>
            <span style={{ color: theme.accent, fontWeight: 700, flexShrink: 0, marginTop: 3, lineHeight: 1 }}>—</span>
            <span>{line}</span>
          </div>
        ))}
        {lines.length === 0 && (
          <div style={{ opacity: 0.3, fontStyle: 'italic' }}>Double-click to add content</div>
        )}
      </div>
    );
  };

  // ── Chrome — brand label, slide number, footer ─────────────────────────

  const Chrome = ({ slideIndex, total, theme }) => (
    <>
      <div data-object-type="text" data-object-role="brand" style={{ position: 'absolute', left: '3.2%', top: '3.9%', fontFamily: qxType.mono, fontSize: 7, fontWeight: 800, color: theme.accent, letterSpacing: '0.18em', textTransform: 'uppercase', lineHeight: 1, zIndex: 10, pointerEvents: 'none', userSelect: 'none' }}>QUIDAX</div>
      <div data-object-type="text" data-object-role="slide-number" style={{ position: 'absolute', right: '3.2%', top: '3.9%', fontFamily: qxType.mono, fontSize: 7, color: theme.title, opacity: 0.55, lineHeight: 1, zIndex: 10, pointerEvents: 'none', userSelect: 'none' }}>{String(slideIndex + 1).padStart(2, '0')}</div>
      <div data-object-type="text" data-object-role="footer" style={{ position: 'absolute', left: '3.2%', bottom: '3.8%', fontFamily: qxType.mono, fontSize: 6, color: theme.text, opacity: 0.4, lineHeight: 1, zIndex: 10, pointerEvents: 'none', userSelect: 'none' }}>Internal | Confidential | {String(slideIndex + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}</div>
    </>
  );

  // ── EyebrowTitle — shared header block for card layouts ────────────────

  const EyebrowTitle = ({ slide, theme, eyebrowText, selectedId, editingId, onSelect, onEdit, onChange }) => {
    const eyebrowObj = getObj(slide, 'eyebrow');
    const titleObj   = getObj(slide, 'title');
    const sp = { selectedId, editingId, onSelect, onEdit, onChange };
    return (
      <div style={{ marginBottom: '2.5%' }}>
        <Slot obj={eyebrowObj} fallback={eyebrowText} {...sp}
          style={applyStyle(eyebrowObj, { fontFamily: qxType.mono, fontSize: 8.5, fontWeight: 700, color: theme.accent, letterSpacing: '0.22em', textTransform: 'uppercase', lineHeight: 1, marginBottom: '1.8%' })}
        />
        <Slot obj={titleObj} fallback={slide.title || ''} {...sp}
          style={applyStyle(titleObj, { fontFamily: qxType.display, fontSize: 29, fontWeight: 700, color: theme.title, lineHeight: 1.08 })}
        />
      </div>
    );
  };

  // ── CardGrid — flex card grid for feature/summary/process/roadmap ──────

  const CardGrid = ({ slide, items, rolePrefix, metaPrefix, theme, columns = 3, accentFirst = true,
                      selectedId, editingId, onSelect, onEdit, onChange }) => {
    const bgObjs     = (slide.objects || []).filter(o => o.role === rolePrefix);
    const titleObjs  = (slide.objects || []).filter(o => o.role === `${rolePrefix}-title`);
    const detailObjs = (slide.objects || []).filter(o => o.role === `${rolePrefix}-detail`);
    const sp = { selectedId, editingId, onSelect, onEdit, onChange };

    return (
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(columns, items.length || 1)}, 1fr)`, gap: '2.5%', flex: 1, minHeight: 0 }}>
        {items.map((item, i) => {
          const bgObj     = bgObjs[i]     || {};
          const titleObj  = titleObjs[i]  || {};
          const detailObj = detailObjs[i] || {};
          const accent    = accentFirst && i === 0;
          const bgColor   = (bgObj.style?.fill) || (accent ? theme.accent  : theme.panel);
          const border    = accent ? theme.accent : theme.rule;
          const titleColor  = accent ? '#232126' : theme.title;
          const detailColor = accent ? 'rgba(35,33,38,0.72)' : theme.muted;
          const label  = titleObj.content  !== undefined ? titleObj.content  : itemLabel(item, `${metaPrefix} ${i + 1}`);
          const detail = detailObj.content !== undefined ? detailObj.content : itemDetail(item);

          return (
            <div key={i} style={{ borderRadius: 8, border: `1px solid ${border}`, background: bgColor, padding: '5% 6%', display: 'flex', flexDirection: 'column', gap: '5%', overflow: 'hidden' }}>
              <div style={{ fontFamily: qxType.mono, fontSize: 7.5, fontWeight: 700, color: accent ? '#1A0530' : theme.accent, letterSpacing: '0.18em', textTransform: 'uppercase', pointerEvents: 'none', userSelect: 'none', flexShrink: 0 }}>
                {metaPrefix} {String(i + 1).padStart(2, '0')}
              </div>
              <Slot obj={titleObj.id ? titleObj : {}} fallback={label} {...sp}
                style={applyStyle(titleObj, { fontFamily: qxType.display, fontSize: 12.5, fontWeight: 700, color: titleColor, lineHeight: 1.2, flexShrink: 0 })}
              />
              {detail ? (
                <Slot obj={detailObj.id ? detailObj : {}} fallback={detail} {...sp}
                  style={applyStyle(detailObj, { fontFamily: qxType.body, fontSize: 10.5, color: detailColor, lineHeight: 1.35, flex: 1 })}
                />
              ) : null}
            </div>
          );
        })}
      </div>
    );
  };

  // ── Shared slot-props helper ───────────────────────────────────────────

  const sp = (p) => ({
    selectedId: p.selectedObjectId,
    editingId:  p.editingObjectId,
    onSelect:   p.onSelect,
    onEdit:     p.onEdit,
    onChange:   p.onContentChange,
  });

  // ══════════════════════════════════════════════════════════════════════
  // LAYOUTS
  // ══════════════════════════════════════════════════════════════════════

  // ── 1. Standard ───────────────────────────────────────────────────────
  const StandardLayout = (p) => {
    const { slide, theme } = p;
    const titleObj = getObj(slide, 'title');
    const bodyObj  = getObj(slide, 'body');
    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', padding: '14% 7% 10%' }}>
        <Chrome slideIndex={p.slideIndex} total={p.total} theme={theme} />
        <Slot obj={titleObj} fallback={slide.title || ''} {...sp(p)}
          style={applyStyle(titleObj, { fontFamily: qxType.display, fontSize: 34, fontWeight: 700, color: theme.title, lineHeight: 1.08, marginBottom: '5%' })}
        />
        <BulletSlot obj={bodyObj} slide={slide} theme={theme} {...sp(p)}
          style={applyStyle(bodyObj, { fontFamily: qxType.body, fontSize: 16, color: theme.text, lineHeight: 1.5, flex: 1, display: 'flex', flexDirection: 'column', gap: 0 })}
          itemStyle={{ marginBottom: 10 }}
        />
      </div>
    );
  };

  // ── 2. Split ──────────────────────────────────────────────────────────
  const SplitLayout = (p) => {
    const { slide, theme } = p;
    const eyebrowObj = getObj(slide, 'eyebrow');
    const titleObj   = getObj(slide, 'title');
    const bodyObj    = getObj(slide, 'body');
    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'row', padding: '14% 7% 10%', gap: 0 }}>
        <Chrome slideIndex={p.slideIndex} total={p.total} theme={theme} />
        {/* Left zone — eyebrow + title */}
        <div style={{ flex: '0 0 44%', display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingRight: '4%' }}>
          <Slot obj={eyebrowObj} fallback={slide.kicker || 'Section'} {...sp(p)}
            style={applyStyle(eyebrowObj, { fontFamily: qxType.mono, fontSize: 8.5, fontWeight: 700, color: theme.accent, letterSpacing: '0.22em', textTransform: 'uppercase', lineHeight: 1, marginBottom: '4%' })}
          />
          <Slot obj={titleObj} fallback={slide.title || ''} {...sp(p)}
            style={applyStyle(titleObj, { fontFamily: qxType.display, fontSize: 34, fontWeight: 700, color: theme.title, lineHeight: 1.06 })}
          />
        </div>
        {/* Divider */}
        <div style={{ width: 1, background: theme.rule, flexShrink: 0, margin: '2% 0', opacity: 0.8 }} />
        {/* Right zone — body */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingLeft: '5%' }}>
          <BulletSlot obj={bodyObj} slide={slide} theme={theme} {...sp(p)}
            style={applyStyle(bodyObj, { fontFamily: qxType.body, fontSize: 16, color: theme.text, lineHeight: 1.5, display: 'flex', flexDirection: 'column', gap: 0 })}
            itemStyle={{ marginBottom: 12 }}
          />
        </div>
      </div>
    );
  };

  // ── 3. Big Title ──────────────────────────────────────────────────────
  const BigTitleLayout = (p) => {
    const { slide, theme } = p;
    const titleObj = getObj(slide, 'title');
    const bodyObj  = getObj(slide, 'body');
    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '14% 7% 10%' }}>
        <Chrome slideIndex={p.slideIndex} total={p.total} theme={theme} />
        <Slot obj={titleObj} fallback={slide.title || ''} {...sp(p)}
          style={applyStyle(titleObj, { fontFamily: qxType.display, fontSize: 48, fontWeight: 800, color: theme.title, lineHeight: 1.02, marginBottom: '4%', letterSpacing: '-0.01em' })}
        />
        {(bodyObj.content || (slide.bullets || []).length > 0) && (
          <BulletSlot obj={bodyObj} slide={slide} theme={theme} {...sp(p)}
            style={applyStyle(bodyObj, { fontFamily: qxType.body, fontSize: 16, color: theme.text, lineHeight: 1.5, maxWidth: '64%', display: 'flex', flexDirection: 'column', gap: 0 })}
            itemStyle={{ marginBottom: 8 }}
          />
        )}
      </div>
    );
  };

  // ── 4. Stat ───────────────────────────────────────────────────────────
  const StatLayout = (p) => {
    const { slide, theme } = p;
    const titleObj = getObj(slide, 'title');
    const bodyObj  = getObj(slide, 'body');
    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '12% 10% 10%', textAlign: 'center' }}>
        <Chrome slideIndex={p.slideIndex} total={p.total} theme={theme} />
        <Slot obj={titleObj} fallback={slide.title || ''} {...sp(p)}
          style={applyStyle(titleObj, { fontFamily: qxType.display, fontSize: 72, fontWeight: 800, color: theme.accent, lineHeight: 0.95, letterSpacing: '-0.02em', marginBottom: '4%', textAlign: 'center' })}
        />
        <BulletSlot obj={bodyObj} slide={slide} theme={theme} {...sp(p)}
          style={applyStyle(bodyObj, { fontFamily: qxType.body, fontSize: 15, color: theme.text, lineHeight: 1.5, display: 'flex', flexDirection: 'column', gap: 0, alignItems: 'center', maxWidth: '70%' })}
          itemStyle={{ marginBottom: 8, justifyContent: 'center' }}
        />
      </div>
    );
  };

  // ── 5. Quote ──────────────────────────────────────────────────────────
  const QuoteLayout = (p) => {
    const { slide, theme } = p;
    const quoteObj = getObj(slide, 'quote');
    const titleObj = getObj(slide, 'title');
    const quoteContent = quoteObj.content !== undefined ? quoteObj.content : ((slide.bullets || [])[0] || slide.title || '');
    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '14% 12% 12%', textAlign: 'center' }}>
        <Chrome slideIndex={p.slideIndex} total={p.total} theme={theme} />
        <div style={{ fontSize: 36, color: theme.accent, fontFamily: qxType.display, fontWeight: 300, opacity: 0.5, lineHeight: 1, marginBottom: '2%', pointerEvents: 'none' }}>"</div>
        <Slot obj={quoteObj.id ? quoteObj : {}} fallback={quoteContent} {...sp(p)}
          style={applyStyle(quoteObj, { fontFamily: qxType.display, fontSize: 26, fontStyle: 'italic', fontWeight: 400, color: theme.title, lineHeight: 1.38, textAlign: 'center', marginBottom: '5%' })}
        />
        <div style={{ width: 32, height: 1, background: theme.accent, opacity: 0.5, marginBottom: '3%', flexShrink: 0 }} />
        <Slot obj={titleObj} fallback={slide.title || ''} {...sp(p)}
          style={applyStyle(titleObj, { fontFamily: qxType.mono, fontSize: 10, fontWeight: 700, color: theme.accent, letterSpacing: '0.18em', textTransform: 'uppercase', textAlign: 'center' })}
        />
      </div>
    );
  };

  // ── 6. Image-Led ──────────────────────────────────────────────────────
  // Image object is rendered by ObjectStage overlay at its model coordinates.
  // CSS here handles the right-side text column only.
  const ImageLayout = (p) => {
    const { slide, theme } = p;
    const eyebrowObj = getObj(slide, 'eyebrow');
    const titleObj   = getObj(slide, 'title');
    const bodyObj    = getObj(slide, 'body');
    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'row', padding: '12% 7% 10%' }}>
        <Chrome slideIndex={p.slideIndex} total={p.total} theme={theme} />
        {/* Left side — reserved for image overlay (54% width) */}
        <div style={{ flex: '0 0 54%' }} />
        {/* Right side — text */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingLeft: '2%' }}>
          <Slot obj={eyebrowObj} fallback={slide.kicker || 'Image-led story'} {...sp(p)}
            style={applyStyle(eyebrowObj, { fontFamily: qxType.mono, fontSize: 8.5, fontWeight: 700, color: theme.accent, letterSpacing: '0.22em', textTransform: 'uppercase', lineHeight: 1, marginBottom: '4%' })}
          />
          <Slot obj={titleObj} fallback={slide.title || ''} {...sp(p)}
            style={applyStyle(titleObj, { fontFamily: qxType.display, fontSize: 28, fontWeight: 700, color: theme.title, lineHeight: 1.08, marginBottom: '5%' })}
          />
          <BulletSlot obj={bodyObj} slide={slide} theme={theme} {...sp(p)}
            style={applyStyle(bodyObj, { fontFamily: qxType.body, fontSize: 14, color: theme.text, lineHeight: 1.45, flex: 1, display: 'flex', flexDirection: 'column', gap: 0 })}
            itemStyle={{ marginBottom: 9 }}
          />
        </div>
      </div>
    );
  };

  // ── 7. Minimal ────────────────────────────────────────────────────────
  const MinimalLayout = (p) => {
    const { slide, theme } = p;
    const titleObj = getObj(slide, 'title');
    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '12% 7% 10%' }}>
        <Chrome slideIndex={p.slideIndex} total={p.total} theme={theme} />
        <Slot obj={titleObj} fallback={slide.title || ''} {...sp(p)}
          style={applyStyle(titleObj, { fontFamily: qxType.display, fontSize: 50, fontWeight: 800, color: theme.title, lineHeight: 1.02, letterSpacing: '-0.015em', maxWidth: '80%' })}
        />
      </div>
    );
  };

  // ── 8. Centered ───────────────────────────────────────────────────────
  const CenteredLayout = (p) => {
    const { slide, theme } = p;
    const titleObj = getObj(slide, 'title');
    const bodyObj  = getObj(slide, 'body');
    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '14% 10% 10%', textAlign: 'center' }}>
        <Chrome slideIndex={p.slideIndex} total={p.total} theme={theme} />
        <Slot obj={titleObj} fallback={slide.title || ''} {...sp(p)}
          style={applyStyle(titleObj, { fontFamily: qxType.display, fontSize: 38, fontWeight: 700, color: theme.title, lineHeight: 1.06, textAlign: 'center', marginBottom: '4%', maxWidth: '80%' })}
        />
        <BulletSlot obj={bodyObj} slide={slide} theme={theme} {...sp(p)}
          style={applyStyle(bodyObj, { fontFamily: qxType.body, fontSize: 16, color: theme.text, lineHeight: 1.5, display: 'flex', flexDirection: 'column', gap: 0, alignItems: 'center', maxWidth: '66%' })}
          itemStyle={{ marginBottom: 8, justifyContent: 'center' }}
        />
      </div>
    );
  };

  // ── 9. Process Flow ───────────────────────────────────────────────────
  const ProcessFlowLayout = (p) => {
    const { slide, theme } = p;
    const items = getItems(slide).slice(0, 5);
    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', padding: '12% 7% 10%' }}>
        <Chrome slideIndex={p.slideIndex} total={p.total} theme={theme} />
        <EyebrowTitle slide={slide} theme={theme} eyebrowText="Process flow" {...sp(p)} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 0, minHeight: 0 }}>
          {items.map((item, i) => {
            const titleObjs  = (slide.objects || []).filter(o => o.role === 'step-card-title');
            const detailObjs = (slide.objects || []).filter(o => o.role === 'step-card-detail');
            const titleObj   = titleObjs[i]  || {};
            const detailObj  = detailObjs[i] || {};
            const accent     = i === 0;
            const bgColor    = accent ? theme.accent : theme.panel;
            const titleColor = accent ? '#232126' : theme.title;
            const detailColor = accent ? 'rgba(35,33,38,0.72)' : theme.muted;
            const label  = titleObj.content  !== undefined ? titleObj.content  : itemLabel(item, `Step ${i + 1}`);
            const detail = detailObj.content !== undefined ? detailObj.content : itemDetail(item);
            return (
              <React.Fragment key={i}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '80%', borderRadius: 8, border: `1px solid ${accent ? theme.accent : theme.rule}`, background: bgColor, padding: '4% 5%', gap: '8%', overflow: 'hidden' }}>
                  <div style={{ fontFamily: qxType.mono, fontSize: 7, fontWeight: 700, color: accent ? '#1A0530' : theme.accent, letterSpacing: '0.2em', textTransform: 'uppercase', pointerEvents: 'none', userSelect: 'none' }}>
                    STEP {String(i + 1).padStart(2, '0')}
                  </div>
                  <Slot obj={titleObj.id ? titleObj : {}} fallback={label} {...sp(p)}
                    style={applyStyle(titleObj, { fontFamily: qxType.display, fontSize: 12.5, fontWeight: 700, color: titleColor, lineHeight: 1.2 })}
                  />
                  {detail ? (
                    <Slot obj={detailObj.id ? detailObj : {}} fallback={detail} {...sp(p)}
                      style={applyStyle(detailObj, { fontFamily: qxType.body, fontSize: 10.5, color: detailColor, lineHeight: 1.32, flex: 1 })}
                    />
                  ) : null}
                </div>
                {i < items.length - 1 && (
                  <div style={{ flexShrink: 0, width: '3%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.accent, fontSize: 18, fontWeight: 700, pointerEvents: 'none' }}>→</div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    );
  };

  // ── 10. Comparison ────────────────────────────────────────────────────
  const ComparisonLayout = (p) => {
    const { slide, theme } = p;
    const items     = getItems(slide);
    const compItems = items.filter(it => it.type === 'comparison_column');
    const half      = Math.ceil(items.length / 2);
    const left  = compItems[0] || { label: 'Current',  detail: items.slice(0, half).map(it => itemLabel(it)).join(' · ') };
    const right = compItems[1] || { label: 'Future',   detail: items.slice(half).map(it => itemLabel(it)).join(' · ') };

    const leftTitleObj  = getObj(slide, 'comparison-left-title');
    const leftDetailObj = getObj(slide, 'comparison-left-detail');
    const rightTitleObj  = getObj(slide, 'comparison-right-title');
    const rightDetailObj = getObj(slide, 'comparison-right-detail');

    const renderCard = (item, titleObj, detailObj, accent) => {
      const bg          = accent ? theme.panel : theme.accent;
      const titleColor  = accent ? theme.title : '#232126';
      const detailColor = accent ? theme.muted  : 'rgba(35,33,38,0.70)';
      const border      = accent ? theme.rule   : theme.accent;
      const metaLabel   = accent ? '01 BEFORE' : '02 AFTER';
      const label  = titleObj.content  !== undefined ? titleObj.content  : itemLabel(item, item.label || '');
      const detail = detailObj.content !== undefined ? detailObj.content : itemDetail(item);

      return (
        <div style={{ flex: 1, borderRadius: 8, border: `1px solid ${border}`, background: bg, padding: '5% 6%', display: 'flex', flexDirection: 'column', gap: '5%', overflow: 'hidden' }}>
          <div style={{ fontFamily: qxType.mono, fontSize: 7.5, fontWeight: 700, color: accent ? theme.accent : '#1A0530', letterSpacing: '0.18em', textTransform: 'uppercase', pointerEvents: 'none', userSelect: 'none', flexShrink: 0 }}>{metaLabel}</div>
          <Slot obj={titleObj.id ? titleObj : {}} fallback={label} {...sp(p)}
            style={applyStyle(titleObj, { fontFamily: qxType.display, fontSize: 16, fontWeight: 700, color: titleColor, lineHeight: 1.18, flexShrink: 0 })}
          />
          <Slot obj={detailObj.id ? detailObj : {}} fallback={detail} {...sp(p)}
            style={applyStyle(detailObj, { fontFamily: qxType.body, fontSize: 12, color: detailColor, lineHeight: 1.4, flex: 1 })}
          />
        </div>
      );
    };

    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', padding: '12% 7% 10%' }}>
        <Chrome slideIndex={p.slideIndex} total={p.total} theme={theme} />
        <EyebrowTitle slide={slide} theme={theme} eyebrowText="Comparison" {...sp(p)} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'row', gap: '2%', alignItems: 'stretch', minHeight: 0 }}>
          {renderCard(left,  leftTitleObj,  leftDetailObj,  true)}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, width: '8%' }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', border: `1px solid ${theme.rule}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.accent, fontSize: 18, fontWeight: 700, pointerEvents: 'none' }}>→</div>
          </div>
          {renderCard(right, rightTitleObj, rightDetailObj, false)}
        </div>
      </div>
    );
  };

  // ── 11. Table Matrix ──────────────────────────────────────────────────
  // Table object is rendered by the ObjectStage overlay at its model coordinates.
  // CSS handles the title block; the table overlay appears below it automatically.
  const TableMatrixLayout = (p) => {
    const { slide, theme } = p;
    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', padding: '12% 7% 10%' }}>
        <Chrome slideIndex={p.slideIndex} total={p.total} theme={theme} />
        <EyebrowTitle slide={slide} theme={theme} eyebrowText="Editable table matrix" {...sp(p)} />
        {/* Space for the table overlay — it renders absolutely at its model coordinates */}
      </div>
    );
  };

  // ── 12. Statistics / KPI Cards ────────────────────────────────────────
  const StatisticsLayout = (p) => {
    const { slide, theme } = p;
    const items = getItems(slide).slice(0, 4);
    const kpiValueObjs = (slide.objects || []).filter(o => o.role === 'kpi-value');
    const kpiLabelObjs = (slide.objects || []).filter(o => o.role === 'kpi-label');
    const titleObj     = getObj(slide, 'title');

    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', padding: '12% 7% 10%' }}>
        <Chrome slideIndex={p.slideIndex} total={p.total} theme={theme} />
        <Slot obj={titleObj} fallback={slide.title || ''} {...sp(p)}
          style={applyStyle(titleObj, { fontFamily: qxType.display, fontSize: 28, fontWeight: 700, color: theme.title, lineHeight: 1.1, marginBottom: '4%' })}
        />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'row', gap: '3%', minHeight: 0 }}>
          {items.map((item, i) => {
            const valueObj = kpiValueObjs[i] || {};
            const labelObj = kpiLabelObjs[i] || {};
            const accent   = i === 0;
            const bgColor  = accent ? theme.accent : theme.panel;
            const valColor = accent ? '#232126'    : theme.accent;
            const lblColor = accent ? '#1A0530'    : theme.muted;
            const rawLabel = itemLabel(item, `Metric ${i + 1}`);
            const numMatch = rawLabel.match(/(?:[$#])?\d+(?:[.,]\d+)?\s*(?:%|x|M|K|B|bn|m|k)?/i);
            const value    = valueObj.content !== undefined ? valueObj.content : (numMatch ? numMatch[0] : rawLabel.split(/\s+/).slice(0, 2).join(' '));
            const label    = labelObj.content !== undefined ? labelObj.content : rawLabel.replace(numMatch ? numMatch[0] : '', '').trim() || itemDetail(item) || 'Metric';

            return (
              <div key={i} style={{ flex: 1, borderRadius: 8, border: `1px solid ${accent ? theme.accent : theme.rule}`, background: bgColor, padding: '5% 6%', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '8%', overflow: 'hidden' }}>
                <Slot obj={valueObj.id ? valueObj : {}} fallback={value} {...sp(p)}
                  style={applyStyle(valueObj, { fontFamily: qxType.display, fontSize: 36, fontWeight: 800, color: valColor, lineHeight: 0.95, letterSpacing: '-0.02em' })}
                />
                <Slot obj={labelObj.id ? labelObj : {}} fallback={label} {...sp(p)}
                  style={applyStyle(labelObj, { fontFamily: qxType.body, fontSize: 11, color: lblColor, lineHeight: 1.3 })}
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ── 13. Hierarchy ─────────────────────────────────────────────────────
  const HierarchyLayout = (p) => {
    const { slide, theme } = p;
    const items      = getItems(slide);
    const topNode    = items[0] || { label: slide.title || 'Top Level' };
    const children   = items.length > 1 ? items.slice(1, 4) : (slide.bullets || []).slice(1, 4).map(b => ({ label: b }));

    const topTitleObj  = getObj(slide, 'hierarchy-top-title');
    const cardTitleObjs = (slide.objects || []).filter(o => o.role === 'hierarchy-card-title');
    const cardDetailObjs = (slide.objects || []).filter(o => o.role === 'hierarchy-card-detail');

    const topLabel = topTitleObj.content !== undefined ? topTitleObj.content : itemLabel(topNode, slide.title || 'Top Level');

    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', padding: '12% 7% 10%' }}>
        <Chrome slideIndex={p.slideIndex} total={p.total} theme={theme} />
        <EyebrowTitle slide={slide} theme={theme} eyebrowText="Hierarchy" {...sp(p)} />
        {/* Top node */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2%', flex: '0 0 auto' }}>
          <div style={{ borderRadius: 8, border: `1px solid ${theme.accent}`, background: theme.accent, padding: '2% 4%', minWidth: '35%', maxWidth: '50%' }}>
            <Slot obj={topTitleObj.id ? topTitleObj : {}} fallback={topLabel} {...sp(p)}
              style={applyStyle(topTitleObj, { fontFamily: qxType.display, fontSize: 14, fontWeight: 700, color: '#232126', lineHeight: 1.2, textAlign: 'center' })}
            />
          </div>
        </div>
        {/* Connector stem */}
        {children.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'center', flexShrink: 0, height: '4%' }}>
            <div style={{ width: 1, background: theme.rule }} />
          </div>
        )}
        {/* Children rail */}
        {children.length > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', flexShrink: 0, height: '1%' }}>
            <div style={{ height: 1, background: theme.rule, width: children.length === 2 ? '50%' : '75%' }} />
          </div>
        )}
        {/* Child nodes */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'row', gap: '3%', alignItems: 'flex-start', minHeight: 0 }}>
          {children.map((child, i) => {
            const titleObj  = cardTitleObjs[i]  || {};
            const detailObj = cardDetailObjs[i] || {};
            const label  = titleObj.content  !== undefined ? titleObj.content  : itemLabel(child, `Level ${i + 2}`);
            const detail = detailObj.content !== undefined ? detailObj.content : itemDetail(child);
            return (
              <div key={i} style={{ flex: 1, borderRadius: 8, border: `1px solid ${theme.rule}`, background: theme.panel, padding: '4% 5%', overflow: 'hidden' }}>
                <div style={{ fontFamily: qxType.mono, fontSize: 7, fontWeight: 700, color: theme.accent, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: '6%', pointerEvents: 'none', userSelect: 'none' }}>LEVEL {i + 2}</div>
                <Slot obj={titleObj.id ? titleObj : {}} fallback={label} {...sp(p)}
                  style={applyStyle(titleObj, { fontFamily: qxType.display, fontSize: 12, fontWeight: 700, color: theme.title, lineHeight: 1.2, marginBottom: '5%' })}
                />
                {detail ? (
                  <Slot obj={detailObj.id ? detailObj : {}} fallback={detail} {...sp(p)}
                    style={applyStyle(detailObj, { fontFamily: qxType.body, fontSize: 10, color: theme.muted, lineHeight: 1.3 })}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ── 14. Roadmap ───────────────────────────────────────────────────────
  const RoadmapLayout = (p) => {
    const { slide, theme } = p;
    const items = getItems(slide).slice(0, 5);
    const labelObjs  = (slide.objects || []).filter(o => o.role === 'timeline-label');
    const detailObjs = (slide.objects || []).filter(o => o.role === 'timeline-detail');

    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', padding: '12% 7% 10%' }}>
        <Chrome slideIndex={p.slideIndex} total={p.total} theme={theme} />
        <EyebrowTitle slide={slide} theme={theme} eyebrowText="Roadmap" {...sp(p)} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: 0 }}>
          {/* Timeline rail */}
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
            <div style={{ position: 'absolute', left: 0, right: 0, height: 1, background: theme.rule, top: '50%' }} />
            {items.map((item, i) => {
              const labelObj  = labelObjs[i]  || {};
              const detailObj = detailObjs[i] || {};
              const accent    = i === 0;
              const label  = labelObj.content  !== undefined ? labelObj.content  : itemLabel(item, `Phase ${i + 1}`);
              const detail = detailObj.content !== undefined ? detailObj.content : itemDetail(item);
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                  {/* Label above rail for odd items, below for even */}
                  {i % 2 === 0 && (
                    <div style={{ marginBottom: '8%', textAlign: 'center', minHeight: '28%' }}>
                      <Slot obj={labelObj.id ? labelObj : {}} fallback={label} {...sp(p)}
                        style={applyStyle(labelObj, { fontFamily: qxType.display, fontSize: 11, fontWeight: 700, color: theme.title, lineHeight: 1.2, textAlign: 'center' })}
                      />
                      {detail && <Slot obj={detailObj.id ? detailObj : {}} fallback={detail} {...sp(p)}
                        style={applyStyle(detailObj, { fontFamily: qxType.body, fontSize: 9.5, color: theme.muted, lineHeight: 1.2, textAlign: 'center', marginTop: '4%' })}
                      />}
                    </div>
                  )}
                  {i % 2 !== 0 && <div style={{ minHeight: '28%', marginBottom: '8%' }} />}
                  {/* Dot */}
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: accent ? theme.accent : theme.panel, border: `1.5px solid ${accent ? theme.accent : theme.rule}`, zIndex: 1, flexShrink: 0 }} />
                  {/* Label below rail for even items */}
                  {i % 2 !== 0 && (
                    <div style={{ marginTop: '8%', textAlign: 'center' }}>
                      <Slot obj={labelObj.id ? labelObj : {}} fallback={label} {...sp(p)}
                        style={applyStyle(labelObj, { fontFamily: qxType.display, fontSize: 11, fontWeight: 700, color: theme.title, lineHeight: 1.2, textAlign: 'center' })}
                      />
                      {detail && <Slot obj={detailObj.id ? detailObj : {}} fallback={detail} {...sp(p)}
                        style={applyStyle(detailObj, { fontFamily: qxType.body, fontSize: 9.5, color: theme.muted, lineHeight: 1.2, textAlign: 'center', marginTop: '4%' })}
                      />}
                    </div>
                  )}
                  {i % 2 === 0 && <div style={{ minHeight: '28%', marginTop: '8%' }} />}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // ── 15. Feature Breakdown ─────────────────────────────────────────────
  const FeatureBreakdownLayout = (p) => {
    const { slide, theme } = p;
    const items = getItems(slide).slice(0, 6);
    const cols  = items.length <= 3 ? items.length || 1 : 3;
    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', padding: '12% 7% 10%' }}>
        <Chrome slideIndex={p.slideIndex} total={p.total} theme={theme} />
        <EyebrowTitle slide={slide} theme={theme} eyebrowText="Feature breakdown" {...sp(p)} />
        <CardGrid slide={slide} items={items} rolePrefix="feature-card" metaPrefix="FEATURE" theme={theme} columns={cols} accentFirst={true} {...sp(p)} />
      </div>
    );
  };

  // ── 16. Summary ───────────────────────────────────────────────────────
  const SummaryLayout = (p) => {
    const { slide, theme } = p;
    const items = getItems(slide).slice(0, 6);
    const cols  = items.length <= 3 ? items.length || 1 : 3;
    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', padding: '12% 7% 10%' }}>
        <Chrome slideIndex={p.slideIndex} total={p.total} theme={theme} />
        <EyebrowTitle slide={slide} theme={theme} eyebrowText="Key takeaways" {...sp(p)} />
        <CardGrid slide={slide} items={items} rolePrefix="takeaway-card" metaPrefix="TAKE" theme={theme} columns={cols} accentFirst={false} {...sp(p)} />
      </div>
    );
  };

  // ── 17. Image Focus ───────────────────────────────────────────────────
  // The hero image is handled here in CSS (not via overlay) so text can
  // render above it. We exclude role='hero-image' from ObjectStage overlays.
  const ImageFocusLayout = (p) => {
    const { slide, theme } = p;
    const heroObj   = (slide.objects || []).find(o => o.role === 'hero-image' && o.type === 'image');
    const kickerObj = getObj(slide, 'kicker');
    const titleObj  = getObj(slide, 'title');
    const bodyObj   = getObj(slide, 'body');
    const imgSrc    = heroObj?.src || '';

    return (
      <div style={{ position: 'absolute', inset: 0 }}>
        {/* Full-bleed image */}
        {imgSrc && (
          <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${imgSrc})`, backgroundSize: 'cover', backgroundPosition: 'center', zIndex: 1 }} />
        )}
        {!imgSrc && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.25)', zIndex: 1 }} />
        )}
        {/* Dark gradient scrim — left side */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg,rgba(0,0,0,0.72) 0%,rgba(0,0,0,0.45) 55%,rgba(0,0,0,0.10) 100%)', zIndex: 2 }} />
        {/* Chrome */}
        <Chrome slideIndex={p.slideIndex} total={p.total} theme={{ ...theme, title: '#F6F1FB', text: '#F6F1FB', accent: theme.accent }} />
        {/* Text — bottom-left */}
        <div style={{ position: 'absolute', left: '6%', bottom: '14%', width: '45%', zIndex: 4, display: 'flex', flexDirection: 'column', gap: '4%' }}>
          <Slot obj={kickerObj} fallback={slide.kicker || 'Image focus'} {...sp(p)}
            style={applyStyle(kickerObj, { fontFamily: qxType.mono, fontSize: 8.5, fontWeight: 700, color: theme.accent, letterSpacing: '0.22em', textTransform: 'uppercase', lineHeight: 1 })}
          />
          <Slot obj={titleObj} fallback={slide.title || ''} {...sp(p)}
            style={applyStyle(titleObj, { fontFamily: qxType.display, fontSize: 36, fontWeight: 700, color: '#FFFFFF', lineHeight: 1.06, letterSpacing: '-0.01em' })}
          />
          {(bodyObj.content || (slide.bullets || []).length > 0) && (
            <BulletSlot obj={bodyObj} slide={slide} theme={{ ...theme, accent: theme.accent, text: 'rgba(255,255,255,0.80)' }} {...sp(p)}
              style={applyStyle(bodyObj, { fontFamily: qxType.body, fontSize: 14, color: 'rgba(255,255,255,0.80)', lineHeight: 1.45, display: 'flex', flexDirection: 'column', gap: 0 })}
              itemStyle={{ marginBottom: 7 }}
            />
          )}
        </div>
      </div>
    );
  };

  // ── Layout router ──────────────────────────────────────────────────────

  const LAYOUT_MAP = {
    standard:          StandardLayout,
    split:             SplitLayout,
    bigTitle:          BigTitleLayout,
    stat:              StatLayout,
    quote:             QuoteLayout,
    image:             ImageLayout,
    minimal:           MinimalLayout,
    centered:          CenteredLayout,
    process_flow:      ProcessFlowLayout,
    comparison:        ComparisonLayout,
    table_matrix:      TableMatrixLayout,
    statistics:        StatisticsLayout,
    hierarchy:         HierarchyLayout,
    roadmap:           RoadmapLayout,
    feature_breakdown: FeatureBreakdownLayout,
    summary:           SummaryLayout,
    image_focus:       ImageFocusLayout,
  };

  const SlideLayoutRenderer = (props) => {
    const Layout = LAYOUT_MAP[props.layout] || StandardLayout;
    return <Layout {...props} />;
  };

  return { SlideLayoutRenderer, LAYOUT_MAP };

})();
