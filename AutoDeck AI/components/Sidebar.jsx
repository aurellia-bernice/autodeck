// ============================================================
// Sidebar — quiet purple rail, single lime dot for active item
// ============================================================
const Sidebar = ({ currentScreen, onNavigate, currentUser, userRole, onLogout, tweaks }) => {
  const T = qxTheme(true); // sidebar is always dark — anchors the layout
  const items = [
    { id: 'home',    label: 'Generate', icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M3 8.5L7 3v3.5h6L9 13V9.5H3z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" fill="none"/>
      </svg>) },
    { id: 'history', label: 'History',  icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4"/>
        <path d="M8 4.5V8L10.5 9.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      </svg>) },
    { id: 'admin',   label: 'Admin',    adminOnly: true, icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="3" y="6.5" width="10" height="7.5" rx="1.2" stroke="currentColor" strokeWidth="1.4"/>
        <path d="M5.5 6.5V4.5a2.5 2.5 0 015 0v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      </svg>) },
  ];

  const initial = currentUser
    ? ((currentUser.displayName || currentUser.email || '?').charAt(0).toUpperCase())
    : '?';

  return (
    <div style={{
      width: 224, minWidth: 224,
      background: '#0F031F',
      borderRight: `1px solid rgba(184,145,220,0.10)`,
      height: '100vh', position: 'fixed', left: 0, top: 0, zIndex: 100,
      display: 'flex', flexDirection: 'column',
      fontFamily: qxType.body,
    }}>
      {/* Brand */}
      <div style={{ padding: '24px 20px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: 'linear-gradient(135deg, #5F2A91, #B891DC)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1L13 7L7 13L1 7L7 1Z" stroke="#F6F1FB" strokeWidth="1.3" fill="none"/>
              <circle cx="7" cy="7" r="1.6" fill="#F6F1FB"/>
            </svg>
          </div>
          <div style={{ fontFamily: qxType.display, fontSize: 16, fontWeight: 600, color: T.ink, letterSpacing: '-0.02em' }}>
            AutoDeck<span style={{ color: '#B891DC', fontStyle: 'italic', fontWeight: 400, marginLeft: 4 }}>AI</span>
          </div>
        </div>
        <div style={{ fontFamily: qxType.mono, fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(246,241,251,0.34)', marginTop: 10, paddingLeft: 2 }}>
          Quidax · Internal
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '8px 12px' }}>
        <div style={{ fontFamily: qxType.mono, fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(246,241,251,0.30)', padding: '0 8px 8px' }}>
          Workspace
        </div>
        {items.map(item => {
          if (item.adminOnly && userRole !== 'admin') return null;
          const isActive = currentScreen === item.id
            || (item.id === 'home' && (currentScreen === 'processing' || currentScreen === 'preview' || currentScreen === 'slideshow'));
          return (
            <button key={item.id} onClick={() => onNavigate(item.id)} style={{
              width: '100%',
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 12px', marginBottom: 2,
              borderRadius: 8, border: 'none',
              background: isActive ? 'rgba(184,145,220,0.10)' : 'transparent',
              color: isActive ? '#F6F1FB' : 'rgba(246,241,251,0.62)',
              fontFamily: qxType.body, fontSize: 13.5, fontWeight: isActive ? 500 : 400,
              cursor: 'pointer', textAlign: 'left',
              transition: `all 140ms ${qxEase}`,
              position: 'relative',
            }}
              onMouseEnter={e => { if (!isActive) { e.currentTarget.style.color = '#F6F1FB'; e.currentTarget.style.background = 'rgba(184,145,220,0.06)'; } }}
              onMouseLeave={e => { if (!isActive) { e.currentTarget.style.color = 'rgba(246,241,251,0.62)'; e.currentTarget.style.background = 'transparent'; } }}>
              {isActive && <span style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', width: 3, height: 16, background: QX.lime, borderRadius: '0 2px 2px 0', boxShadow: `0 0 8px ${QX.lime}` }} />}
              <span style={{ opacity: isActive ? 1 : 0.7, display: 'flex' }}>{item.icon}</span>
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* User */}
      <div style={{ padding: 12, borderTop: '1px solid rgba(184,145,220,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 8, borderRadius: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: 'linear-gradient(135deg, #5F2A91, #B891DC)',
            color: '#F6F1FB', fontSize: 12, fontWeight: 600,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            fontFamily: qxType.display,
          }}>{initial}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, color: 'rgba(246,241,251,0.85)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {currentUser ? (currentUser.displayName || currentUser.email || 'User') : 'Demo User'}
            </div>
            <div style={{ fontFamily: qxType.mono, fontSize: 10, color: 'rgba(246,241,251,0.40)', textTransform: 'capitalize', letterSpacing: '0.06em' }}>
              {userRole || 'employee'}
            </div>
          </div>
          {onLogout && (
            <button onClick={onLogout} title="Sign out" style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: 4,
              color: 'rgba(246,241,251,0.40)', display: 'flex', borderRadius: 6,
            }}
              onMouseEnter={e => e.currentTarget.style.color = '#F6F1FB'}
              onMouseLeave={e => e.currentTarget.style.color = 'rgba(246,241,251,0.40)'}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12H3a1 1 0 01-1-1V3a1 1 0 011-1h2"/>
                <path d="M9 10l3-3-3-3M12 7H6"/>
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
Object.assign(window, { Sidebar });
