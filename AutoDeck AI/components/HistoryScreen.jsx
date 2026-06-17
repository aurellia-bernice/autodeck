// ============================================================
// HistoryScreen — like a library, not a table.
// Featured deck up top, masonry of past decks below, quick stats strip.
// ============================================================
const SEED_DECKS = [
  { id: 's1', title: 'Q2 Sales Strategy Overview',  slides: 10, template: 'Professional', date: '2026-05-03', size: '2.4 MB', author: 'Adaeze O.', favourite: true },
  { id: 's2', title: 'Product Roadmap H2 2026',      slides: 8,  template: 'Bold',         date: '2026-05-02', size: '1.8 MB', author: 'Tunde A.',  favourite: false },
  { id: 's3', title: 'HR Onboarding — New Hires',    slides: 15, template: 'Minimal',      date: '2026-04-30', size: '3.1 MB', author: 'Chiamaka I.', favourite: true },
  { id: 's4', title: 'Engineering All Hands April',  slides: 12, template: 'Professional', date: '2026-04-28', size: '2.0 MB', author: 'Femi K.',   favourite: false },
  { id: 's5', title: 'Investor Update — Series B',   slides: 10, template: 'Professional', date: '2026-04-22', size: '2.7 MB', author: 'Adaeze O.', favourite: true },
  { id: 's6', title: 'Brand Guidelines 2026',        slides: 20, template: 'Bold',         date: '2026-04-18', size: '4.2 MB', author: 'Design',    favourite: false },
  { id: 's7', title: 'Customer Success Stories Q1',  slides: 8,  template: 'Minimal',      date: '2026-04-10', size: '1.5 MB', author: 'Sade B.',   favourite: false },
  { id: 's8', title: 'Operations Review March',      slides: 10, template: 'Fun',          date: '2026-03-31', size: '2.2 MB', author: 'Tunde A.',  favourite: false },
];

const HistoryScreen = ({ tweaks, currentUser, onOpenDeck }) => {
  const T = qxTheme(tweaks?.darkMode);
  const dark = tweaks?.darkMode;
  const [search, setSearch] = React.useState('');
  const [filter, setFilter] = React.useState('All');
  const [view, setView] = React.useState('shelf'); // shelf | list

  const seedColors = {
    Professional: ['#2D0F4E', '#5F2A91', '#B891DC'],
    Bold:         ['#431407', '#9A3412', '#FED7AA'],
    Minimal:      ['#F6F1FB', '#D9C2EE', '#5F2A91'],
    Fun:    ['#0F0A24', '#312E81', '#A5B4FC'],
  };

  const [decks, setDecks] = React.useState(SEED_DECKS);
  const [loading, setLoading] = React.useState(false);
  const [selectedDeck, setSelectedDeck] = React.useState(null);
  const detailPanelRef = React.useRef(null);

  const selectDeck = (d) => {
    setSelectedDeck(d);
    setTimeout(() => {
      detailPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  };

  const deckFromServer = (d) => ({
    id: d.id,
    title: d.title || 'Untitled',
    slides: d.slideCount || 0,
    template: d.template || 'Professional',
    date: d.createdAt ? d.createdAt.slice(0, 10) : '',
    size: `${d.slideCount || 0} slides`,
    author: d.author || currentUser?.displayName || currentUser?.email?.split('@')[0] || '',
    favourite: false,
  });

  const fetchDecks = () => {
    if (!window.firebase?.app) return Promise.resolve([]);
    const listDecksFn = window.firebase.app().functions('us-central1').httpsCallable('listDecks');
    return listDecksFn({})
      .then(({ data }) => (data.decks || []).map(deckFromServer));
  };

  const reloadDecks = () => fetchDecks().then(setDecks);

  React.useEffect(() => {
    let cancelled = false;
    if (!currentUser?.uid || !window.firebase?.app) {
      setDecks(SEED_DECKS);
      setLoading(false);
      return () => { cancelled = true; };
    }

    setLoading(true);
    fetchDecks()
      .then((next) => {
        if (!cancelled) setDecks(next);
      })
      .catch((err) => {
        if (!cancelled) setDecks(SEED_DECKS);
        console.error('[HistoryScreen] listDecks failed:', err?.message || err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [currentUser?.uid]);

  React.useEffect(() => { setSelectedDeck(null); }, [search, filter]);

  const templates = ['All', 'Professional', 'Minimal', 'Bold', 'Fun'];
  const filtered = decks.filter(d => d.title.toLowerCase().includes(search.toLowerCase()) && (filter === 'All' || d.template === filter));
  const featured = filtered[0];
  const activeFeatured = selectedDeck || featured;
  const fmt = (s) => new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const handleDelete = (id) => {
    setDecks(p => p.filter(d => d.id !== id));
    if (!String(id).startsWith('s') && window.firebase?.app) {
      const deleteDeckFn = firebase.app().functions('us-central1').httpsCallable('deleteDeck');
      deleteDeckFn({ deckId: id }).catch(() => {
        reloadDecks().catch(() => {});
      });
    }
  };
  const toggleFav = (id) => setDecks(p => p.map(d => d.id === id ? { ...d, favourite: !d.favourite } : d));

  const totalSlides = decks.reduce((s, d) => s + d.slides, 0);
  const favCount = decks.filter(d => d.favourite).length;

  // ── DeckCover visual ────────────────────────────────────
  const DeckCover = ({ deck, size = 'sm' }) => {
    const c = seedColors[deck.template] || seedColors.Professional;
    const isLight = deck.template === 'Minimal';
    return (
      <div style={{
        position: 'relative', aspectRatio: '3 / 4',
        borderRadius: qxRadius.md, overflow: 'hidden',
        background: `linear-gradient(135deg, ${c[0]} 0%, ${c[1]} 60%, ${c[2]} 140%)`,
        boxShadow: dark ? '0 12px 30px rgba(0,0,0,0.55)' : '0 12px 30px rgba(45,15,78,0.18)',
        color: isLight ? '#1A0530' : '#F6F1FB',
        padding: size === 'lg' ? 28 : 16,
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        transition: `transform 240ms ${qxEase}, box-shadow 240ms ${qxEase}`,
        cursor: 'pointer',
      }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}>
        <div aria-hidden style={{ position: 'absolute', top: -40, right: -40, width: 140, height: 140, borderRadius: '50%', border: `1px solid ${isLight ? c[2] + '40' : c[2] + '40'}` }} />
        <div aria-hidden style={{ position: 'absolute', bottom: -60, left: -60, width: 160, height: 160, borderRadius: '50%', background: `${c[2]}22`, filter: 'blur(20px)' }} />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontFamily: qxType.mono, fontSize: size === 'lg' ? 10 : 8, letterSpacing: '0.22em', textTransform: 'uppercase', opacity: 0.55 }}>
            QUIDAX
          </div>
          {deck.favourite && (
            <svg width={size === 'lg' ? 14 : 10} height={size === 'lg' ? 14 : 10} viewBox="0 0 14 14" fill="currentColor" style={{ opacity: 0.85 }}>
              <path d="M7 1l1.8 4 4.2.4-3.2 2.8 1 4.2L7 10.2 3.2 12.4l1-4.2L1 5.4 5.2 5z"/>
            </svg>
          )}
        </div>
        <div style={{ position: 'relative' }}>
          <div style={{
            fontFamily: qxType.display,
            fontSize: size === 'lg' ? 22 : 13,
            fontWeight: 500, letterSpacing: '-0.015em',
            lineHeight: 1.1, marginBottom: size === 'lg' ? 12 : 6,
            display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>{deck.title}</div>
          <div style={{
            fontFamily: qxType.mono,
            fontSize: size === 'lg' ? 9.5 : 7.5,
            letterSpacing: '0.15em', textTransform: 'uppercase',
            opacity: 0.65,
          }}>
            {deck.slides} SLIDES · {deck.template.toUpperCase()}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ minHeight: '100vh', background: T.bg, fontFamily: qxType.body, color: T.ink, padding: '40px 48px 80px' }}>
      {/* Header */}
      <div style={{ ...qxMotion.fadeUp(0), marginBottom: 32, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: qxType.mono, fontSize: 11, letterSpacing: '0.30em', textTransform: 'uppercase', color: T.inkMute, marginBottom: 12 }}>
            Library
          </div>
          <h1 style={{ fontFamily: qxType.display, fontSize: 'clamp(40px, 5vw, 56px)', fontWeight: 500, color: T.ink, margin: '0 0 6px', letterSpacing: '-0.030em', lineHeight: 1 }}>
            Everything <span style={{ color: T.primary, fontStyle: 'italic', fontWeight: 400 }}>you've made</span>.
          </h1>
        </div>

        {/* Stats strip */}
        <div style={{ display: 'flex', gap: 32 }}>
          {[
            ['Decks', decks.length],
            ['Slides', totalSlides],
            ['Favourites', favCount],
          ].map(([k, v]) => (
            <div key={k}>
              <div style={{ fontFamily: qxType.mono, fontSize: 9.5, letterSpacing: '0.22em', textTransform: 'uppercase', color: T.inkMute, marginBottom: 6 }}>{k}</div>
              <div style={{ fontFamily: qxType.display, fontSize: 28, fontWeight: 500, color: T.ink, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
                {String(v).padStart(2, '0')}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ ...qxMotion.fadeUp(80), display: 'flex', gap: 12, alignItems: 'center', marginBottom: 36, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 240 }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: T.inkMute }}>
            <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.4"/>
            <path d="M9.5 9.5L13 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search the library…"
            style={{
              width: '100%', padding: '12px 16px 12px 40px',
              borderRadius: qxRadius.full, border: `1px solid ${T.border}`,
              background: T.surface, color: T.ink,
              fontFamily: qxType.body, fontSize: 14, outline: 'none',
              transition: `border-color 140ms ${qxEase}`,
            }}
            onFocus={e => e.target.style.borderColor = T.primary}
            onBlur={e => e.target.style.borderColor = T.border} />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {templates.map(t => (
            <button key={t} onClick={() => setFilter(t)} style={{
              padding: '8px 14px', borderRadius: qxRadius.full,
              border: `1px solid ${filter === t ? T.primary : T.border}`,
              background: filter === t ? T.ghostBg : 'transparent',
              color: filter === t ? T.primary : T.inkDim,
              fontFamily: qxType.body, fontSize: 12.5, fontWeight: filter === t ? 600 : 500,
              cursor: 'pointer', transition: `all 140ms ${qxEase}`,
            }}>{t}</button>
          ))}
        </div>
        <div style={{ display: 'inline-flex', background: T.ghostBg, borderRadius: qxRadius.full, padding: 3, border: `1px solid ${T.border}` }}>
          {[
            { k: 'shelf', label: 'Shelf' },
            { k: 'list',  label: 'List' },
          ].map(o => (
            <button key={o.k} onClick={() => setView(o.k)} style={{
              padding: '6px 14px', borderRadius: qxRadius.full, border: 'none',
              background: view === o.k ? T.bgElev : 'transparent',
              color: view === o.k ? T.ink : T.inkDim,
              fontFamily: qxType.body, fontSize: 12.5, fontWeight: view === o.k ? 600 : 500,
              cursor: 'pointer',
            }}>{o.label}</button>
          ))}
        </div>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '80px 0', color: T.inkMute, fontSize: 14 }}>
          Loading your library…
        </div>
      )}

      {!loading && decks.length === 0 && (
        <div style={{ textAlign: 'center', padding: '80px 0', color: T.inkMute, fontSize: 14 }}>
          No decks yet — generate your first one to see it here.
        </div>
      )}

      {!loading && decks.length > 0 && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '80px 0', color: T.inkMute, fontSize: 14 }}>
          Nothing in the library matches.
        </div>
      )}

      {/* Featured + Shelf view */}
      {view === 'shelf' && activeFeatured && (
        <>
          {/* Featured / Selected */}
          <div ref={detailPanelRef} style={{ ...qxMotion.fadeUp(140), marginBottom: 56 }}>
            <div style={{ fontFamily: qxType.mono, fontSize: 10.5, letterSpacing: '0.22em', textTransform: 'uppercase', color: T.inkMute, marginBottom: 16 }}>
              {selectedDeck ? 'Selected' : 'Most recent'}
            </div>
            <div style={{
              display: 'grid', gridTemplateColumns: '320px 1fr', gap: 40,
              alignItems: 'center',
            }}>
              <DeckCover deck={activeFeatured} size="lg" />
              <div>
                <div style={{ fontFamily: qxType.mono, fontSize: 10.5, letterSpacing: '0.22em', textTransform: 'uppercase', color: T.primary, marginBottom: 14 }}>
                  {activeFeatured.template} · {fmt(activeFeatured.date)}
                </div>
                <h2 style={{ fontFamily: qxType.display, fontSize: 'clamp(32px, 4vw, 48px)', fontWeight: 500, color: T.ink, margin: '0 0 12px', letterSpacing: '-0.025em', lineHeight: 1.05 }}>
                  {activeFeatured.title}
                </h2>
                <p style={{ fontSize: 16, color: T.inkDim, margin: '0 0 24px', lineHeight: 1.55, maxWidth: 540 }}>
                  {activeFeatured.slides}-slide {activeFeatured.template.toLowerCase()} deck by {activeFeatured.author}. Last edited {fmt(activeFeatured.date)}.
                </p>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => onOpenDeck?.(activeFeatured)} style={{
                    padding: '12px 22px', borderRadius: qxRadius.full,
                    border: 'none', background: QX.lime, color: '#1A0530',
                    fontFamily: qxType.body, fontSize: 14, fontWeight: 600,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                    boxShadow: '0 8px 30px rgba(212,255,63,0.42)',
                    transition: `all 180ms ${qxEase}`,
                  }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}>
                    <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><polygon points="3,2 12,7 3,12" fill="currentColor"/></svg>
                    Open
                  </button>
                  <button onClick={() => onOpenDeck?.(activeFeatured)} style={{
                    padding: '12px 18px', borderRadius: qxRadius.full,
                    border: `1px solid ${T.border}`, background: 'transparent', color: T.inkDim,
                    fontFamily: qxType.body, fontSize: 13.5, fontWeight: 500,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M7 1v9M3 6l4 4 4-4M1 12h12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    Download
                  </button>
                  <button onClick={() => toggleFav(activeFeatured.id)} style={{
                    width: 42, height: 42, borderRadius: '50%',
                    border: `1px solid ${T.border}`, background: 'transparent',
                    color: activeFeatured.favourite ? '#F5A623' : T.inkMute,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill={activeFeatured.favourite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.4">
                      <path d="M7 1l1.8 4 4.2.4-3.2 2.8 1 4.2L7 10.2 3.2 12.4l1-4.2L1 5.4 5.2 5z"/>
                    </svg>
                  </button>
                </div>

                {/* Mini meta strip */}
                <div style={{ display: 'flex', gap: 32, marginTop: 32, paddingTop: 24, borderTop: `1px solid ${T.border}` }}>
                  {[
                    ['Slides', String(activeFeatured.slides).padStart(2, '0')],
                    ['Size', activeFeatured.size],
                    ['Author', activeFeatured.author],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <div style={{ fontFamily: qxType.mono, fontSize: 9.5, letterSpacing: '0.22em', textTransform: 'uppercase', color: T.inkMute, marginBottom: 4 }}>{k}</div>
                      <div style={{ fontSize: 14, color: T.ink, fontWeight: 500 }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Shelf — masonry of all decks */}
          {filtered.length > 0 && (
            <div>
              <div style={{ fontFamily: qxType.mono, fontSize: 10.5, letterSpacing: '0.22em', textTransform: 'uppercase', color: T.inkMute, marginBottom: 16 }}>
                The shelf · {filtered.length} deck{filtered.length === 1 ? '' : 's'}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 24 }}>
                {filtered.map((d, i) => {
                  const isSelected = activeFeatured.id === d.id;
                  return (
                    <div key={d.id} style={{ ...qxMotion.fadeUp(160 + i * 40), cursor: 'pointer' }} onClick={() => selectDeck(d)}>
                      <div style={{
                        outline: isSelected ? `2px solid ${T.primary}` : '2px solid transparent',
                        borderRadius: qxRadius.md,
                        transition: `outline 140ms ${qxEase}`,
                      }}>
                        <DeckCover deck={d} />
                      </div>
                      <div style={{ marginTop: 12 }}>
                        <div style={{ fontFamily: qxType.display, fontSize: 14, fontWeight: 500, color: isSelected ? T.primary : T.ink, letterSpacing: '-0.01em', marginBottom: 4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.25 }}>
                          {d.title}
                        </div>
                        <div style={{ fontFamily: qxType.mono, fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase', color: T.inkMute }}>
                          {fmt(d.date)} · {d.author}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* List view */}
      {view === 'list' && (
        <div style={{ display: 'flex', flexDirection: 'column', borderTop: `1px solid ${T.border}` }}>
          {filtered.map((d, i) => (
            <div key={d.id} style={{
              display: 'grid', gridTemplateColumns: '60px 1fr 100px 120px 140px auto',
              alignItems: 'center', gap: 16,
              padding: '18px 8px', borderBottom: `1px solid ${T.border}`,
              cursor: 'pointer', transition: `background 140ms ${qxEase}`,
              ...qxMotion.fadeUp(40 + i * 20),
            }}
              onClick={() => selectDeck(d)}
              onMouseEnter={e => e.currentTarget.style.background = T.ghostBg}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <div style={{ fontFamily: qxType.display, fontSize: 28, fontWeight: 500, color: T.inkFaint, letterSpacing: '-0.03em', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                {String(i + 1).padStart(2, '0')}
              </div>
              <div>
                <div style={{ fontFamily: qxType.display, fontSize: 17, fontWeight: 500, color: T.ink, letterSpacing: '-0.015em', marginBottom: 4 }}>
                  {d.title}
                </div>
                <div style={{ fontFamily: qxType.mono, fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase', color: T.inkMute }}>
                  By {d.author}
                </div>
              </div>
              <div style={{ fontFamily: qxType.mono, fontSize: 11, color: T.inkDim, letterSpacing: '0.06em' }}>{d.template}</div>
              <div style={{ fontFamily: qxType.mono, fontSize: 11, color: T.inkDim, letterSpacing: '0.06em' }}>{d.slides} slides</div>
              <div style={{ fontFamily: qxType.mono, fontSize: 11, color: T.inkDim, letterSpacing: '0.06em' }}>{fmt(d.date)}</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={(e) => { e.stopPropagation(); toggleFav(d.id); }} style={{
                  width: 32, height: 32, borderRadius: '50%',
                  border: `1px solid ${T.border}`, background: 'transparent',
                  color: d.favourite ? '#F5A623' : T.inkMute,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="12" height="12" viewBox="0 0 14 14" fill={d.favourite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.4">
                    <path d="M7 1l1.8 4 4.2.4-3.2 2.8 1 4.2L7 10.2 3.2 12.4l1-4.2L1 5.4 5.2 5z"/>
                  </svg>
                </button>
                <button onClick={(e) => { e.stopPropagation(); handleDelete(d.id); }} style={{
                  width: 32, height: 32, borderRadius: '50%',
                  border: `1px solid ${T.border}`, background: 'transparent',
                  color: T.inkMute, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M2 3h10M5 3V2h4v1M4 3l.5 9h5L10 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
Object.assign(window, { HistoryScreen });
