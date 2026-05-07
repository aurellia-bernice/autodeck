// ============================================================
// ChangePasswordScreen — security form, Quidax brand identity
// ============================================================
const ChangePasswordScreen = ({ tweaks, onBack }) => {
  const dark = tweaks?.darkMode;
  const T = qxTheme(dark);

  const [currentPw, setCurrentPw]     = React.useState('');
  const [newPw, setNewPw]             = React.useState('');
  const [confirmPw, setConfirmPw]     = React.useState('');
  const [showCurrent, setShowCurrent] = React.useState(false);
  const [showNew, setShowNew]         = React.useState(false);
  const [focused, setFocused]         = React.useState(null);
  const [loading, setLoading]         = React.useState(false);
  const [error, setError]             = React.useState('');
  const [done, setDone]               = React.useState(false);

  const inputStyle = (id) => ({
    width: '100%', padding: '13px 14px', paddingRight: 42,
    borderRadius: qxRadius.sm,
    border: `1px solid ${focused === id ? T.primary : T.borderHi}`,
    background: T.surface,
    fontFamily: qxType.body, fontSize: 14.5, color: T.ink,
    outline: 'none', transition: `all 140ms ${qxEase}`,
    boxShadow: focused === id ? '0 0 0 3px rgba(95,42,145,0.10)' : 'none',
    boxSizing: 'border-box',
  });

  const strengthLevel = (pw) => {
    if (pw.length === 0) return 0;
    if (pw.length < 8)  return 1;
    if (pw.length < 10) return 2;
    if (pw.length < 12) return 3;
    return 4;
  };
  const strengthColors = ['#E03E6B', '#F5A623', '#F5A623', QX.ok];
  const strengthLabels = ['Too short', 'Weak', 'Moderate', 'Strong'];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!currentPw)           return setError('Enter your current password.');
    if (newPw.length < 8)     return setError('New password must be at least 8 characters.');
    if (newPw !== confirmPw)  return setError('Passwords do not match.');
    setLoading(true);
    try {
      const user = window.firebaseAuth.currentUser;
      const credential = firebase.auth.EmailAuthProvider.credential(user.email, currentPw);
      await user.reauthenticateWithCredential(credential);
      await user.updatePassword(newPw);
      setDone(true);
    } catch (err) {
      const msgs = {
        'auth/wrong-password':        'Current password is incorrect.',
        'auth/too-many-requests':     'Too many attempts. Try again later.',
        'auth/requires-recent-login': 'Please sign out and sign back in first.',
      };
      setError(msgs[err.code] || 'Could not update password. Try again.');
    }
    setLoading(false);
  };

  const sl = strengthLevel(newPw);

  return (
    <div style={{
      minHeight: '100vh',
      background: T.bg,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '48px 24px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* ambient blobs */}
      <div aria-hidden style={{
        position: 'absolute', top: '-12%', right: '-8%',
        width: 540, height: 540, borderRadius: '50%',
        background: `radial-gradient(circle, ${T.blob1} 0%, transparent 65%)`,
        filter: 'blur(64px)', pointerEvents: 'none',
      }} />
      <div aria-hidden style={{
        position: 'absolute', bottom: '-8%', left: '-10%',
        width: 420, height: 420, borderRadius: '50%',
        background: `radial-gradient(circle, ${T.blob2} 0%, transparent 65%)`,
        filter: 'blur(52px)', pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 460 }}>

        {/* Back */}
        <button onClick={onBack} style={{
          display: 'flex', alignItems: 'center', gap: 7,
          background: 'none', border: 'none', cursor: 'pointer',
          color: T.inkMute, fontFamily: qxType.body, fontSize: 13, fontWeight: 500,
          marginBottom: 28, padding: 0, transition: `color 140ms ${qxEase}`,
        }}
          onMouseEnter={e => e.currentTarget.style.color = T.primary}
          onMouseLeave={e => e.currentTarget.style.color = T.inkMute}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M11 7H3M6 4L3 7l3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back to dashboard
        </button>

        {/* Card */}
        <div style={{
          background: T.surface,
          borderRadius: qxRadius.xl,
          border: `1px solid ${T.border}`,
          boxShadow: qxShadow(dark).md,
          overflow: 'hidden',
        }}>

          {/* Card header */}
          <div style={{
            padding: '28px 32px 24px',
            borderBottom: `1px solid ${T.border}`,
            display: 'flex', alignItems: 'flex-start', gap: 16,
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: qxRadius.md, flexShrink: 0,
              background: dark ? 'rgba(184,145,220,0.12)' : 'rgba(95,42,145,0.07)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={T.primary} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2"/>
                <path d="M7 11V7a5 5 0 0110 0v4"/>
              </svg>
            </div>
            <div>
              <h1 style={{
                fontFamily: qxType.display, fontSize: 22, fontWeight: 600,
                color: T.ink, margin: '0 0 5px', letterSpacing: '-0.02em',
              }}>Change password</h1>
              <p style={{ fontSize: 13.5, color: T.inkDim, margin: 0, lineHeight: 1.55 }}>
                Update your Quidax account password. You'll need your current password to confirm.
              </p>
            </div>
          </div>

          {/* Body */}
          <div style={{ padding: '28px 32px 32px' }}>
            {done ? (
              /* ── Success state ── */
              <div style={{ textAlign: 'center', padding: '12px 0 8px' }}>
                <div style={{
                  width: 56, height: 56, borderRadius: '50%', margin: '0 auto 20px',
                  background: 'rgba(52,199,123,0.10)',
                  border: '1px solid rgba(52,199,123,0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={QX.ok} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5"/>
                  </svg>
                </div>
                <h2 style={{
                  fontFamily: qxType.display, fontSize: 20, fontWeight: 600,
                  color: T.ink, margin: '0 0 8px', letterSpacing: '-0.02em',
                }}>Password changed</h2>
                <p style={{ fontSize: 14, color: T.inkDim, margin: '0 0 28px', lineHeight: 1.55 }}>
                  Your password has been updated. Use it the next time you sign in.
                </p>
                <button onClick={onBack} style={{
                  padding: '12px 28px', borderRadius: qxRadius.full, border: 'none',
                  background: QX.lime, color: QX.limeInk,
                  fontFamily: qxType.body, fontSize: 14, fontWeight: 600,
                  cursor: 'pointer', transition: `all 180ms ${qxEase}`,
                  boxShadow: '0 4px 20px rgba(212,255,63,0.30)',
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 26px rgba(212,255,63,0.40)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(212,255,63,0.30)'; }}
                >
                  Back to dashboard
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M3 7h8M8 4l3 3-3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            ) : (
              /* ── Form ── */
              <form onSubmit={handleSubmit}>
                {/* Divider label */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20,
                }}>
                  <span style={{ flex: 1, height: 1, background: T.border }} />
                  <span style={{ fontFamily: qxType.mono, fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: T.inkMute }}>
                    Security credentials
                  </span>
                  <span style={{ flex: 1, height: 1, background: T.border }} />
                </div>

                <CpwField
                  label="Current password" id="curr"
                  value={currentPw} onChange={setCurrentPw}
                  show={showCurrent} onToggle={() => setShowCurrent(v => !v)}
                  focused={focused} setFocused={setFocused}
                  inputStyle={inputStyle} placeholder="Your current password"
                />

                <div style={{ height: 1, background: T.border, margin: '2px 0 16px' }} />

                <CpwField
                  label="New password" id="newpw"
                  value={newPw} onChange={setNewPw}
                  show={showNew} onToggle={() => setShowNew(v => !v)}
                  focused={focused} setFocused={setFocused}
                  inputStyle={inputStyle} placeholder="Min. 8 characters"
                />

                {/* Strength bar */}
                {newPw.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: -6, marginBottom: 14 }}>
                    {[0,1,2,3].map(i => (
                      <div key={i} style={{
                        flex: 1, height: 3, borderRadius: 99,
                        background: i < sl ? strengthColors[sl - 1] : T.border,
                        transition: `background 200ms ${qxEase}`,
                      }} />
                    ))}
                    <span style={{ fontFamily: qxType.mono, fontSize: 10, color: sl > 0 ? strengthColors[sl - 1] : T.inkMute, letterSpacing: '0.10em', whiteSpace: 'nowrap' }}>
                      {strengthLabels[sl - 1] || ''}
                    </span>
                  </div>
                )}

                <CpwField
                  label="Confirm new password" id="cpw"
                  value={confirmPw} onChange={setConfirmPw}
                  show={showNew} onToggle={() => setShowNew(v => !v)}
                  focused={focused} setFocused={setFocused}
                  inputStyle={inputStyle} placeholder="Re-enter new password"
                />

                {error && (
                  <div style={{
                    marginBottom: 14, padding: '10px 14px', borderRadius: qxRadius.sm,
                    background: 'rgba(224,62,107,0.08)', border: '1px solid rgba(224,62,107,0.20)',
                    color: '#B22456', fontSize: 13, fontWeight: 500, fontFamily: qxType.body,
                  }}>{error}</div>
                )}

                <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                  <button type="button" onClick={onBack} style={{
                    padding: '13px 22px', borderRadius: qxRadius.full,
                    border: `1px solid ${T.borderHi}`, background: 'transparent',
                    color: T.inkDim, fontFamily: qxType.body, fontSize: 14, fontWeight: 500,
                    cursor: 'pointer', transition: `all 140ms ${qxEase}`, flexShrink: 0,
                  }}
                    onMouseEnter={e => { e.currentTarget.style.background = T.ghostBg; e.currentTarget.style.color = T.ink; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = T.inkDim; }}
                  >Cancel</button>

                  <button type="submit" disabled={loading} style={{
                    flex: 1, padding: '13px', borderRadius: qxRadius.full, border: 'none',
                    background: loading ? 'rgba(212,255,63,0.50)' : QX.lime,
                    color: QX.limeInk,
                    fontFamily: qxType.body, fontSize: 14, fontWeight: 600,
                    cursor: loading ? 'wait' : 'pointer',
                    transition: `all 180ms ${qxEase}`,
                    boxShadow: loading ? 'none' : '0 4px 20px rgba(212,255,63,0.30)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}
                    onMouseEnter={e => { if (!loading) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 26px rgba(212,255,63,0.40)'; } }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; if (!loading) e.currentTarget.style.boxShadow = '0 4px 20px rgba(212,255,63,0.30)'; }}
                  >
                    {loading ? 'Updating…' : 'Update password'}
                    {!loading && (
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M3 7h8M8 4l3 3-3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        <p style={{
          textAlign: 'center', marginTop: 20,
          fontFamily: qxType.mono, fontSize: 10, letterSpacing: '0.16em',
          textTransform: 'uppercase', color: T.inkFaint,
        }}>Quidax · Internal tool · Changes are immediate</p>
      </div>
    </div>
  );
};

const CpwField = ({ label, id, value, onChange, show, onToggle, focused, setFocused, inputStyle, placeholder }) => (
  <div style={{ marginBottom: 14 }}>
    <label style={{
      display: 'block', fontFamily: qxType.mono, fontSize: 10,
      letterSpacing: '0.16em', textTransform: 'uppercase', color: '#8A7B9E', marginBottom: 7,
    }}>{label}</label>
    <div style={{ position: 'relative' }}>
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        onFocus={() => setFocused(id)}
        onBlur={() => setFocused(null)}
        style={inputStyle(id)}
      />
      <button type="button" onClick={onToggle} style={{
        position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
        background: 'none', border: 'none', cursor: 'pointer', padding: 4,
        color: '#8A7B9E', display: 'flex',
      }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          {show
            ? <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>
            : <><path d="M17.94 17.94A10 10 0 0112 20c-7 0-11-8-11-8a18 18 0 015-5.94"/><path d="M9.9 4.24A9 9 0 0112 4c7 0 11 8 11 8a18 18 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></>
          }
        </svg>
      </button>
    </div>
  </div>
);

Object.assign(window, { ChangePasswordScreen });
