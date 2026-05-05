// Sidebar Navigation Component
const Sidebar = ({ currentScreen, onNavigate, currentUser }) => {
  const navItems = [
    {
      id: 'home',
      label: 'Generate',
      icon: (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M9 1L11.5 6.5H17L12.5 10L14.5 16L9 12.5L3.5 16L5.5 10L1 6.5H6.5L9 1Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="none"/>
        </svg>
      )
    },
    {
      id: 'history',
      label: 'History',
      icon: (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <circle cx="9" cy="9" r="7.5" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M9 5V9.5L12 11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      )
    },
    {
      id: 'admin',
      label: 'Admin',
      icon: (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M9 2L10.8 6.5L16 7L12 10.5L13.5 16L9 13L4.5 16L6 10.5L2 7L7.2 6.5L9 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="none"/>
        </svg>
      ),
      adminOnly: true
    }
  ];

  return (
    <div style={{
      width: '220px',
      minWidth: '220px',
      background: '#2D0A4E',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      position: 'fixed',
      left: 0,
      top: 0,
      zIndex: 100,
      boxShadow: '4px 0 24px rgba(0,0,0,0.25)'
    }}>
      {/* Logo area */}
      <div style={{
        padding: '28px 24px 24px',
        borderBottom: '1px solid rgba(255,255,255,0.08)'
      }}>
        {/* Gem icon */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
          <div style={{ position: 'relative', width: '32px', height: '32px' }}>
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <polygon points="16,2 30,10 30,22 16,30 2,22 2,10" fill="none" stroke="#D946A8" strokeWidth="1.5"/>
              <polygon points="16,2 30,10 16,16 2,10" fill="#7B2FBE" opacity="0.7"/>
              <polygon points="16,16 30,10 30,22 16,30" fill="#D946A8" opacity="0.5"/>
              <polygon points="16,16 16,30 2,22 2,10" fill="#7B2FBE" opacity="0.4"/>
            </svg>
          </div>
          <div>
            <div style={{ color: '#FFFFFF', fontFamily: '"Arial Black", sans-serif', fontSize: '15px', fontWeight: '900', letterSpacing: '-0.3px', lineHeight: 1.1 }}>AutoDeck</div>
            <div style={{ color: '#D946A8', fontFamily: '"Arial Black", sans-serif', fontSize: '11px', fontWeight: '700', letterSpacing: '2px', textTransform: 'uppercase' }}>AI</div>
          </div>
        </div>
        <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', fontFamily: 'Calibri, sans-serif', letterSpacing: '0.3px', marginTop: '4px' }}>Quidax Internal Tool</div>
      </div>

      {/* Nav Items */}
      <nav style={{ flex: 1, padding: '16px 12px' }}>
        {navItems.map(item => {
          const isActive = currentScreen === item.id || (currentScreen === 'processing' && item.id === 'home') || (currentScreen === 'preview' && item.id === 'home');
          if (item.adminOnly && currentUser !== 'admin') return null;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '11px 14px',
                borderRadius: '10px',
                border: 'none',
                background: isActive ? 'rgba(217,70,168,0.18)' : 'transparent',
                color: isActive ? '#D946A8' : 'rgba(255,255,255,0.55)',
                fontSize: '14px',
                fontFamily: 'Calibri, sans-serif',
                fontWeight: isActive ? '700' : '500',
                cursor: 'pointer',
                marginBottom: '4px',
                textAlign: 'left',
                transition: 'all 0.15s ease',
                position: 'relative',
                letterSpacing: '0.1px'
              }}
              onMouseEnter={e => {
                if (!isActive) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                  e.currentTarget.style.color = 'rgba(255,255,255,0.85)';
                }
              }}
              onMouseLeave={e => {
                if (!isActive) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'rgba(255,255,255,0.55)';
                }
              }}
            >
              {isActive && (
                <div style={{
                  position: 'absolute',
                  left: 0,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '3px',
                  height: '22px',
                  background: '#D946A8',
                  borderRadius: '0 3px 3px 0'
                }} />
              )}
              <span style={{ opacity: isActive ? 1 : 0.7 }}>{item.icon}</span>
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* User area */}
      <div style={{
        padding: '16px 20px',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        alignItems: 'center',
        gap: '10px'
      }}>
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #7B2FBE, #D946A8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontSize: '13px',
          fontFamily: '"Arial Black", sans-serif',
          fontWeight: '900',
          flexShrink: 0
        }}>
          {currentUser === 'admin' ? 'AD' : 'AO'}
        </div>
        <div>
          <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: '13px', fontFamily: 'Calibri, sans-serif', fontWeight: '600' }}>
            {currentUser === 'admin' ? 'Ada Okafor' : 'Ayo Osei'}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', fontFamily: 'Calibri, sans-serif' }}>
            {currentUser === 'admin' ? 'Design Lead' : 'Sales Rep'}
          </div>
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { Sidebar });
