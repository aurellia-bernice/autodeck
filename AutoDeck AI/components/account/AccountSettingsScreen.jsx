// ============================================================
// AccountSettingsScreen — profile editing, account info, security
// ============================================================
const AccountSettingsScreen = ({ tweaks, currentUser, onNavigate, onLogout, onUserUpdated }) => {
  const dark = tweaks?.darkMode;
  const T = qxTheme(dark);

  const [displayName,  setDisplayName]  = React.useState(currentUser?.displayName || '');
  const [editingName,  setEditingName]  = React.useState(false);
  const [nameInput,    setNameInput]    = React.useState(currentUser?.displayName || '');
  const [savingName,   setSavingName]   = React.useState(false);
  const [nameSuccess,  setNameSuccess]  = React.useState(false);
  const [nameError,    setNameError]    = React.useState('');
  const [focused,      setFocused]      = React.useState(false);

  const user        = window.firebaseAuth?.currentUser;
  const email       = currentUser?.email || user?.email || '';
  const initials    = (displayName || email || '?').charAt(0).toUpperCase();
  const memberSince = React.useMemo(() => {
    const t = user?.metadata?.creationTime;
    if (!t) return null;
    return new Date(t).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, [user]);

  const handleSaveName = async () => {
    const trimmed = nameInput.trim();
    if (!trimmed) return setNameError('Name cannot be empty.');
    if (trimmed === displayName) { setEditingName(false); return; }
    setNameError('');
    setSavingName(true);
    try {
      await window.firebaseAuth.currentUser.updateProfile({ displayName: trimmed });
      setDisplayName(trimmed);
      setEditingName(false);
      setNameSuccess(true);
      onUserUpdated && onUserUpdated({ ...currentUser, displayName: trimmed });
      setTimeout(() => setNameSuccess(false), 3000);
    } catch {
      setNameError('Could not update name. Try again.');
    }
    setSavingName(false);
  };

  const handleCancelEdit = () => {
    setNameInput(displayName);
    setEditingName(false);
    setNameError('');
  };

  const inputStyle = {
    flex: 1, padding: '10px 12px', borderRadius: qxRadius.sm,
    border: `1px solid ${focused ? T.primary : T.borderHi}`,
    background: T.bg, fontFamily: qxType.body, fontSize: 14.5, color: T.ink,
    outline: 'none', transition: `all 140ms ${qxEase}`,
    boxShadow: focused ? '0 0 0 3px rgba(95,42,145,0.10)' : 'none',
    boxSizing: 'border-box',
  };

  return (
    <div style={{
      minHeight: '100vh', background: T.bg,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '48px 24px', position: 'relative', overflow: 'hidden',
      fontFamily: qxType.body,
    }}>
      {/* blobs */}
      <div aria-hidden style={{ position: 'absolute', top: '-12%', right: '-8%', width: 520, height: 520, borderRadius: '50%', background: `radial-gradient(circle, ${T.blob1} 0%, transparent 65%)`, filter: 'blur(64px)', pointerEvents: 'none' }} />
      <div aria-hidden style={{ position: 'absolute', bottom: '-8%', left: '-10%', width: 420, height: 420, borderRadius: '50%', background: `radial-gradient(circle, ${T.blob2} 0%, transparent 65%)`, filter: 'blur(52px)', pointerEvents: 'none' }} />

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 480 }}>

        {/* Page title */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontFamily: qxType.mono, fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: T.inkMute, marginBottom: 6 }}>
            Quidax · Internal
          </div>
          <h1 style={{ fontFamily: qxType.display, fontSize: 28, fontWeight: 600, color: T.ink, margin: 0, letterSpacing: '-0.02em' }}>
            Account settings
          </h1>
        </div>

        {/* ── Profile card ── */}
        <div style={{ background: T.surface, borderRadius: qxRadius.xl, border: `1px solid ${T.border}`, boxShadow: qxShadow(dark).md, marginBottom: 12, overflow: 'hidden' }}>

          {/* Avatar + identity */}
          <div style={{ padding: '28px 28px 24px', display: 'flex', alignItems: 'center', gap: 20, borderBottom: `1px solid ${T.border}` }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(135deg, #5F2A91, #B891DC)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: qxType.display, fontSize: 26, fontWeight: 600, color: '#F6F1FB',
              boxShadow: '0 4px 16px rgba(95,42,145,0.25)',
            }}>{initials}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 18, fontWeight: 600, fontFamily: qxType.display, color: T.ink, letterSpacing: '-0.01em', marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {displayName || 'No name set'}
              </div>
              <div style={{ fontSize: 13, color: T.inkDim, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{email}</div>
            </div>
            {nameSuccess && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: qxRadius.full, background: 'rgba(52,199,123,0.10)', border: '1px solid rgba(52,199,123,0.22)', color: QX.ok, fontSize: 12, fontWeight: 500, flexShrink: 0 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                Saved
              </div>
            )}
          </div>

          {/* Display name row */}
          <div style={{ padding: '20px 28px' }}>
            <label style={{ display: 'block', fontFamily: qxType.mono, fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: T.inkMute, marginBottom: 8 }}>
              Display name
            </label>
            {editingName ? (
              <div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    autoFocus
                    value={nameInput}
                    onChange={e => setNameInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') handleCancelEdit(); }}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    style={inputStyle}
                    placeholder="Your display name"
                  />
                  <button onClick={handleSaveName} disabled={savingName} style={{
                    padding: '10px 18px', borderRadius: qxRadius.full, border: 'none',
                    background: savingName ? 'rgba(212,255,63,0.5)' : QX.lime, color: QX.limeInk,
                    fontFamily: qxType.body, fontSize: 13, fontWeight: 600,
                    cursor: savingName ? 'wait' : 'pointer', flexShrink: 0,
                    transition: `all 160ms ${qxEase}`,
                  }}>{savingName ? 'Saving…' : 'Save'}</button>
                  <button onClick={handleCancelEdit} style={{
                    padding: '10px 14px', borderRadius: qxRadius.full,
                    border: `1px solid ${T.borderHi}`, background: 'transparent',
                    color: T.inkDim, fontFamily: qxType.body, fontSize: 13, fontWeight: 500,
                    cursor: 'pointer', flexShrink: 0, transition: `all 140ms ${qxEase}`,
                  }}>Cancel</button>
                </div>
                {nameError && (
                  <div style={{ marginTop: 8, fontSize: 12, color: '#B22456', fontWeight: 500 }}>{nameError}</div>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <span style={{ fontSize: 14.5, color: displayName ? T.ink : T.inkFaint }}>
                  {displayName || 'Not set'}
                </span>
                <button onClick={() => { setNameInput(displayName); setEditingName(true); }} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '7px 14px', borderRadius: qxRadius.full,
                  border: `1px solid ${T.borderHi}`, background: 'transparent',
                  color: T.inkDim, fontFamily: qxType.body, fontSize: 12, fontWeight: 500,
                  cursor: 'pointer', transition: `all 140ms ${qxEase}`, flexShrink: 0,
                }}
                  onMouseEnter={e => { e.currentTarget.style.background = T.ghostBg; e.currentTarget.style.color = T.ink; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = T.inkDim; }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                  Edit
                </button>
              </div>
            )}
          </div>

          {/* Email row */}
          <div style={{ padding: '0 28px 20px', borderTop: `1px solid ${T.border}`, paddingTop: 20 }}>
            <label style={{ display: 'block', fontFamily: qxType.mono, fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: T.inkMute, marginBottom: 8 }}>
              Work email
            </label>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 14.5, color: T.ink }}>{email}</span>
              <span style={{ fontFamily: qxType.mono, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.inkMute, padding: '4px 8px', borderRadius: qxRadius.full, border: `1px solid ${T.border}` }}>
                Read-only
              </span>
            </div>
          </div>
        </div>

        {/* ── Account info card ── */}
        <div style={{ background: T.surface, borderRadius: qxRadius.xl, border: `1px solid ${T.border}`, boxShadow: qxShadow(dark).md, marginBottom: 12, overflow: 'hidden' }}>
          <div style={{ padding: '18px 28px', borderBottom: `1px solid ${T.border}` }}>
            <div style={{ fontFamily: qxType.mono, fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: T.inkMute, marginBottom: 14 }}>Account</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <AcRow label="Role" T={T}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: qxRadius.full, background: dark ? 'rgba(184,145,220,0.12)' : 'rgba(95,42,145,0.07)', color: T.primary, fontSize: 12, fontWeight: 600, fontFamily: qxType.mono, letterSpacing: '0.08em', textTransform: 'capitalize' }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: T.primary }} />
                  {currentUser?.role || 'employee'}
                </span>
              </AcRow>
              {memberSince && (
                <AcRow label="Member since" T={T}>
                  <span style={{ fontSize: 14, color: T.ink }}>{memberSince}</span>
                </AcRow>
              )}
              <AcRow label="User ID" T={T}>
                <span style={{ fontFamily: qxType.mono, fontSize: 11, color: T.inkMute, letterSpacing: '0.04em' }}>
                  {(currentUser?.uid || '').slice(0, 16)}…
                </span>
              </AcRow>
            </div>
          </div>
        </div>

        {/* ── Security card ── */}
        <div style={{ background: T.surface, borderRadius: qxRadius.xl, border: `1px solid ${T.border}`, boxShadow: qxShadow(dark).md, marginBottom: 12, overflow: 'hidden' }}>
          <div style={{ padding: '18px 28px' }}>
            <div style={{ fontFamily: qxType.mono, fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: T.inkMute, marginBottom: 14 }}>Security</div>
            <AcAction
              icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>}
              label="Change password"
              description="Update your Quidax account password"
              onClick={() => onNavigate('changePassword')}
              T={T} dark={dark}
            />
          </div>
        </div>

        {/* ── Sign out ── */}
        <button onClick={onLogout} style={{
          width: '100%', padding: '13px', borderRadius: qxRadius.full,
          border: `1px solid ${T.borderHi}`, background: 'transparent',
          color: T.inkDim, fontFamily: qxType.body, fontSize: 14, fontWeight: 500,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          transition: `all 140ms ${qxEase}`,
        }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#E03E6B'; e.currentTarget.style.color = '#E03E6B'; e.currentTarget.style.background = 'rgba(224,62,107,0.05)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = T.borderHi; e.currentTarget.style.color = T.inkDim; e.currentTarget.style.background = 'transparent'; }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12H3a1 1 0 01-1-1V3a1 1 0 011-1h2"/><path d="M9 10l3-3-3-3M12 7H6"/>
          </svg>
          Sign out
        </button>

        <p style={{ textAlign: 'center', marginTop: 20, fontFamily: qxType.mono, fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: T.inkFaint }}>
          Quidax · Internal tool
        </p>
      </div>
    </div>
  );
};

const AcRow = ({ label, children, T }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
    <span style={{ fontSize: 13, color: T.inkDim, fontWeight: 500 }}>{label}</span>
    {children}
  </div>
);

const AcAction = ({ icon, label, description, onClick, T, dark }) => (
  <button onClick={onClick} style={{
    width: '100%', display: 'flex', alignItems: 'center', gap: 14,
    padding: '12px 14px', borderRadius: qxRadius.md,
    border: `1px solid ${T.border}`, background: 'transparent',
    cursor: 'pointer', transition: `all 140ms ${qxEase}`, textAlign: 'left',
  }}
    onMouseEnter={e => { e.currentTarget.style.background = T.ghostBg; e.currentTarget.style.borderColor = T.borderHi; }}
    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = T.border; }}
  >
    <div style={{ width: 36, height: 36, borderRadius: qxRadius.sm, flexShrink: 0, background: dark ? 'rgba(184,145,220,0.10)' : 'rgba(95,42,145,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.primary }}>
      {icon}
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 14, fontWeight: 500, color: T.ink, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 12, color: T.inkMute }}>{description}</div>
    </div>
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke={T.inkFaint} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 3l4 4-4 4"/>
    </svg>
  </button>
);

Object.assign(window, { AccountSettingsScreen });
