
// History Screen
const HistoryScreen = ({ tweaks }) => {
  const [search, setSearch] = React.useState('');
  const [filter, setFilter] = React.useState('All');
  const [deletingId, setDeletingId] = React.useState(null);

  const [decks, setDecks] = React.useState([
    { id: 1, title: 'Q2 Sales Strategy Overview', slides: 10, template: 'Professional', date: '2026-05-03', size: '2.4 MB' },
    { id: 2, title: 'Product Roadmap H2 2026', slides: 8, template: 'Bold', date: '2026-05-02', size: '1.8 MB' },
    { id: 3, title: 'HR Onboarding Deck — New Hires', slides: 15, template: 'Minimal', date: '2026-04-30', size: '3.1 MB' },
    { id: 4, title: 'Engineering All Hands April', slides: 12, template: 'Corporate', date: '2026-04-28', size: '2.0 MB' },
    { id: 5, title: 'Investor Update — Series B', slides: 10, template: 'Professional', date: '2026-04-22', size: '2.7 MB' },
    { id: 6, title: 'Brand Guidelines 2026', slides: 20, template: 'Bold', date: '2026-04-18', size: '4.2 MB' },
    { id: 7, title: 'Customer Success Stories Q1', slides: 8, template: 'Minimal', date: '2026-04-10', size: '1.5 MB' },
    { id: 8, title: 'Operations Review March', slides: 10, template: 'Corporate', date: '2026-03-31', size: '2.2 MB' },
  ]);

  const templates = ['All', 'Professional', 'Minimal', 'Bold', 'Corporate'];

  const filtered = decks.filter(d => {
    const matchSearch = d.title.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'All' || d.template === filter;
    return matchSearch && matchFilter;
  });

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const handleDelete = (id) => {
    setDeletingId(id);
    setTimeout(() => {
      setDecks(prev => prev.filter(d => d.id !== id));
      setDeletingId(null);
    }, 400);
  };

  const templateColors = {
    Professional: '#7B2FBE',
    Minimal: '#555',
    Bold: '#D946A8',
    Corporate: '#F5A623'
  };

  const bg = tweaks?.darkMode ? '#0F0318' : '#F4F1F9';
  const cardBg = tweaks?.darkMode ? '#1E0635' : '#FFFFFF';
  const textColor = tweaks?.darkMode ? '#FFFFFF' : '#1A0530';
  const subColor = tweaks?.darkMode ? 'rgba(255,255,255,0.45)' : '#7A6B8A';
  const borderColor = tweaks?.darkMode ? 'rgba(123,47,190,0.25)' : 'rgba(123,47,190,0.12)';
  const inputBg = tweaks?.darkMode ? '#2A0E4A' : '#FFFFFF';

  return (
    <div style={{
      minHeight: '100vh',
      background: bg,
      padding: '40px 48px',
      fontFamily: 'Calibri, sans-serif',
      overflowY: 'auto'
    }}>
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{
          fontFamily: '"Arial Black", sans-serif',
          fontSize: '26px',
          fontWeight: '900',
          color: textColor,
          margin: '0 0 6px',
          letterSpacing: '-0.5px'
        }}>History</h1>
        <p style={{ color: subColor, fontSize: '15px', margin: 0 }}>
          {decks.length} deck{decks.length !== 1 ? 's' : ''} generated
        </p>
      </div>

      {/* Search + filters */}
      <div style={{
        display: 'flex',
        gap: '12px',
        marginBottom: '24px',
        alignItems: 'center',
        flexWrap: 'wrap'
      }}>
        {/* Search */}
        <div style={{
          position: 'relative',
          flex: '1',
          minWidth: '220px'
        }}>
          <div style={{
            position: 'absolute',
            left: '14px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: subColor,
            pointerEvents: 'none'
          }}>
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search decks…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '11px 16px 11px 38px',
              borderRadius: '10px',
              border: `1.5px solid ${borderColor}`,
              background: inputBg,
              color: textColor,
              fontSize: '14px',
              fontFamily: 'Calibri, sans-serif',
              outline: 'none',
              boxSizing: 'border-box',
              transition: 'border-color 0.15s ease'
            }}
            onFocus={e => { e.target.style.borderColor = '#7B2FBE'; }}
            onBlur={e => { e.target.style.borderColor = borderColor; }}
          />
        </div>

        {/* Filter chips */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {templates.map(t => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              style={{
                padding: '9px 16px',
                borderRadius: '8px',
                border: `1.5px solid ${filter === t ? '#7B2FBE' : borderColor}`,
                background: filter === t ? '#7B2FBE' : 'transparent',
                color: filter === t ? '#fff' : subColor,
                fontSize: '13px',
                fontFamily: 'Calibri, sans-serif',
                fontWeight: filter === t ? '700' : '500',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >{t}</button>
          ))}
        </div>
      </div>

      {/* Deck list */}
      {filtered.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '80px 0',
          color: subColor
        }}>
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" style={{ marginBottom: '16px', opacity: 0.4 }}>
            <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="2"/>
            <path d="M24 16v8M24 30v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <div style={{ fontSize: '16px', fontWeight: '600' }}>No decks found</div>
          <div style={{ fontSize: '14px', marginTop: '6px' }}>Try adjusting your search or filter</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filtered.map(deck => (
            <div
              key={deck.id}
              style={{
                background: cardBg,
                borderRadius: '12px',
                border: `1.5px solid ${borderColor}`,
                padding: '18px 24px',
                display: 'flex',
                alignItems: 'center',
                gap: '20px',
                opacity: deletingId === deck.id ? 0 : 1,
                transition: 'opacity 0.3s ease, border-color 0.15s ease',
                boxShadow: tweaks?.darkMode ? 'none' : '0 1px 8px rgba(45,10,78,0.04)'
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(123,47,190,0.3)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = borderColor; }}
            >
              {/* Icon */}
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '10px',
                background: tweaks?.darkMode ? 'rgba(123,47,190,0.2)' : 'rgba(123,47,190,0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                color: '#7B2FBE'
              }}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M7 8h6M7 11h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>

              {/* Title + meta */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: '"Arial Black", sans-serif',
                  fontSize: '14px',
                  fontWeight: '900',
                  color: textColor,
                  marginBottom: '5px',
                  letterSpacing: '-0.2px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>{deck.title}</div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  fontSize: '12px',
                  color: subColor,
                  flexWrap: 'wrap'
                }}>
                  <span>{formatDate(deck.date)}</span>
                  <span>·</span>
                  <span>{deck.slides} slides</span>
                  <span>·</span>
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: `${templateColors[deck.template]}18`,
                    color: templateColors[deck.template],
                    fontWeight: '600',
                    fontSize: '11px'
                  }}>{deck.template}</span>
                  <span>·</span>
                  <span>{deck.size}</span>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                <button
                  style={{
                    padding: '9px 16px',
                    borderRadius: '8px',
                    border: `1.5px solid ${borderColor}`,
                    background: 'transparent',
                    color: '#7B2FBE',
                    fontSize: '13px',
                    fontFamily: 'Calibri, sans-serif',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(123,47,190,0.08)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                    <path d="M6.5 1v8M3.5 6l3 3 3-3M1 11h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Download
                </button>
                <button
                  onClick={() => handleDelete(deck.id)}
                  style={{
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: `1.5px solid ${borderColor}`,
                    background: 'transparent',
                    color: subColor,
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = '#E05A5A';
                    e.currentTarget.style.color = '#E05A5A';
                    e.currentTarget.style.background = 'rgba(224,90,90,0.06)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = borderColor;
                    e.currentTarget.style.color = subColor;
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                    <path d="M2 3h9M5 3V2h3v1M4 3l.5 8h4L9 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
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
