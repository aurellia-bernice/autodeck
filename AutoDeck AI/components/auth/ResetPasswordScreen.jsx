// ============================================================
// ResetPasswordScreen — handles Firebase oobCode from reset email
// ============================================================
const ResetPasswordScreen = () => {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
  const [dark, setDark] = React.useState(prefersDark.matches);

  React.useEffect(() => {
    const handler = e => setDark(e.matches);
    prefersDark.addEventListener('change', handler);
    return () => prefersDark.removeEventListener('change', handler);
  }, []);

  const T = qxTheme(dark);

  const [email,     setEmail]     = React.useState('');
  const [newPw,     setNewPw]     = React.useState('');
  const [confirmPw, setConfirmPw] = React.useState('');
  const [showPw,    setShowPw]    = React.useState(false);
  const [focused,   setFocused]   = React.useState(null);
  const [loading,   setLoading]   = React.useState(false);
  const [status,    setStatus]    = React.useState('verifying'); // verifying | ready | done | error
  const [oobCode,   setOobCode]   = React.useState('');
  const [errMsg,    setErrMsg]    = React.useState('');

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mode   = params.get('mode');
    const code   = params.get('oobCode');
    if (mode !== 'resetPassword' || !code) {
      setErrMsg('This link is invalid or has expired.');
      setStatus('error');
      return;
    }
    setOobCode(code);
    window.firebaseAuth.verifyPasswordResetCode(code)
      .then(email => { setEmail(email); setStatus('ready'); })
      .catch(() => { setErrMsg('This reset link has expired or already been used.'); setStatus('error'); });
  }, []);

  const strengthLevel = (pw) => {
    if (!pw.length)  return 0;
    if (pw.length < 8)  return 1;
    if (pw.length < 10) return 2;
    if (pw.length < 12) return 3;
    return 4;
  };
  const strengthColors = ['#E03E6B', '#F5A623', '#F5A623', QX.ok];
  const strengthLabels = ['Too short', 'Weak', 'Moderate', 'Strong'];
  const sl = strengthLevel(newPw);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrMsg('');
    if (newPw.length < 8)    return setErrMsg('Password must be at least 8 characters.');
    if (newPw !== confirmPw) return setErrMsg('Passwords do not match.');
    setLoading(true);
    try {
      await window.firebaseAuth.confirmPasswordReset(oobCode, newPw);
      setStatus('done');
    } catch (err) {
      const msgs = {
        'auth/expired-action-code':  'This reset link has expired. Request a new one.',
        'auth/invalid-action-code':  'This reset link is invalid or has already been used.',
        'auth/weak-password':        'Password is too weak. Use at least 8 characters.',
      };
      setErrMsg(msgs[err.code] || 'Could not reset password. Try again.');
    }
    setLoading(false);
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
      <div aria-hidden style={{
        position: 'absolute', top: '-10%', right: '-6%',
        width: 500, height: 500, borderRadius: '50%',
        background: `radial-gradient(circle, ${T.blob1} 0%, transparent 65%)`,
        filter: 'blur(64px)', pointerEvents: 'none',
      }} />
      <div aria-hidden style={{
        position: 'absolute', bottom: '-6%', left: '-8%',
        width: 420, height: 420, borderRadius: '50%',
        background: `radial-gradient(circle, ${T.blob2} 0%, transparent 65%)`,
        filter: 'blur(52px)', pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 440 }}>

        {/* Wordmark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 36, justifyContent: 'center' }}>
          <div style={{
            width: 30, height: 30, borderRadius: 9,
            background: 'linear-gradient(135deg, #5F2A91, #B891DC)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1L13 7L7 13L1 7L7 1Z" stroke="#F6F1FB" strokeWidth="1.3" fill="none"/>
              <circle cx="7" cy="7" r="1.6" fill="#F6F1FB"/>
            </svg>
          </div>
          <span style={{ fontFamily: qxType.display, fontSize: 17, fontWeight: 600, color: T.ink, letterSpacing: '-0.02em' }}>
            AutoDeck<span style={{ color: '#B891DC', fontStyle: 'italic', fontWeight: 400, marginLeft: 4 }}>AI</span>
          </span>
        </div>

        {/* Card */}
        <div style={{
          background: T.surface, borderRadius: qxRadius.xl,
          border: `1px solid ${T.border}`, boxShadow: qxShadow(dark).md, overflow: 'hidden',
        }}>

          {/* Header */}
          <div style={{ padding: '28px 32px 24px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'flex-start', gap: 16 }}>
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
              <h1 style={{ fontFamily: qxType.display, fontSize: 22, fontWeight: 600, color: T.ink, margin: '0 0 5px', letterSpacing: '-0.02em' }}>
                Reset your password
              </h1>
              {status === 'ready' && (
                <p style={{ fontSize: 13.5, color: T.inkDim, margin: 0, lineHeight: 1.55 }}>
                  for <strong style={{ color: T.ink }}>{email}</strong>
                </p>
              )}
              {status === 'verifying' && (
                <p style={{ fontSize: 13.5, color: T.inkMute, margin: 0 }}>Verifying your link…</p>
              )}
            </div>
          </div>

          {/* Body */}
          <div style={{ padding: '28px 32px 32px' }}>

            {status === 'verifying' && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" style={{ animation: 'rpSpin 0.9s linear infinite' }}>
                  <circle cx="12" cy="12" r="10" stroke={dark ? '#291149' : '#EDE3F7'} strokeWidth="2.5"/>
                  <path d="M12 2a10 10 0 0 1 10 10" stroke={T.primary} strokeWidth="2.5" strokeLinecap="round"/>
                </svg>
                <style>{`@keyframes rpSpin { to { transform: rotate(360deg); } }`}</style>
              </div>
            )}

            {status === 'error' && (
              <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
                <div style={{
                  width: 52, height: 52, borderRadius: '50%', margin: '0 auto 18px',
                  background: 'rgba(224,62,107,0.08)', border: '1px solid rgba(224,62,107,0.22)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#E03E6B" strokeWidth="2" strokeLinecap="round">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="16" r="0.5" fill="#E03E6B"/>
                  </svg>
                </div>
                <h2 style={{ fontFamily: qxType.display, fontSize: 18, fontWeight: 600, color: T.ink, margin: '0 0 8px', letterSpacing: '-0.02em' }}>Link expired</h2>
                <p style={{ fontSize: 13.5, color: T.inkDim, lineHeight: 1.55, margin: '0 0 24px' }}>{errMsg}</p>
                <a href="/" style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '12px 24px', borderRadius: qxRadius.full,
                  background: QX.lime, color: QX.limeInk, textDecoration: 'none',
                  fontFamily: qxType.body, fontSize: 14, fontWeight: 600,
                  boxShadow: '0 4px 20px rgba(212,255,63,0.28)',
                }}>
                  Back to sign in
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M3 7h8M8 4l3 3-3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </a>
              </div>
            )}

            {status === 'done' && (
              <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
                <div style={{
                  width: 56, height: 56, borderRadius: '50%', margin: '0 auto 20px',
                  background: 'rgba(52,199,123,0.10)', border: '1px solid rgba(52,199,123,0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={QX.ok} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5"/>
                  </svg>
                </div>
                <h2 style={{ fontFamily: qxType.display, fontSize: 20, fontWeight: 600, color: T.ink, margin: '0 0 8px', letterSpacing: '-0.02em' }}>
                  Password changed
                </h2>
                <p style={{ fontSize: 14, color: T.inkDim, margin: '0 0 28px', lineHeight: 1.55 }}>
                  You can now sign in with your new password.
                </p>
                <a href="/" style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '13px 28px', borderRadius: qxRadius.full,
                  background: QX.lime, color: QX.limeInk, textDecoration: 'none',
                  fontFamily: qxType.body, fontSize: 14, fontWeight: 600,
                  boxShadow: '0 4px 20px rgba(212,255,63,0.30)',
                }}>
                  Sign in now
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M3 7h8M8 4l3 3-3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </a>
              </div>
            )}

            {status === 'ready' && (
              <form onSubmit={handleSubmit}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                  <span style={{ flex: 1, height: 1, background: T.border }} />
                  <span style={{ fontFamily: qxType.mono, fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: T.inkMute }}>
                    New password
                  </span>
                  <span style={{ flex: 1, height: 1, background: T.border }} />
                </div>

                {/* New password */}
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontFamily: qxType.mono, fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: T.inkMute, marginBottom: 7 }}>
                    New password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={newPw}
                      onChange={e => setNewPw(e.target.value)}
                      placeholder="Min. 8 characters"
                      onFocus={() => setFocused('new')}
                      onBlur={() => setFocused(null)}
                      style={inputStyle('new')}
                      autoFocus
                    />
                    <button type="button" onClick={() => setShowPw(v => !v)} style={{
                      position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: T.inkMute, display: 'flex',
                    }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        {showPw
                          ? <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>
                          : <><path d="M17.94 17.94A10 10 0 0112 20c-7 0-11-8-11-8a18 18 0 015-5.94"/><path d="M9.9 4.24A9 9 0 0112 4c7 0 11 8 11 8a18 18 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></>
                        }
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Strength */}
                {newPw.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: -6, marginBottom: 14 }}>
                    {[0,1,2,3].map(i => (
                      <div key={i} style={{
                        flex: 1, height: 3, borderRadius: 99,
                        background: i < sl ? strengthColors[sl - 1] : T.border,
                        transition: `background 200ms ${qxEase}`,
                      }} />
                    ))}
                    <span style={{ fontFamily: qxType.mono, fontSize: 10, color: sl > 0 ? strengthColors[sl - 1] : '#8A7B9E', letterSpacing: '0.10em', whiteSpace: 'nowrap' }}>
                      {strengthLabels[sl - 1] || ''}
                    </span>
                  </div>
                )}

                {/* Confirm */}
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontFamily: qxType.mono, fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: T.inkMute, marginBottom: 7 }}>
                    Confirm password
                  </label>
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={confirmPw}
                    onChange={e => setConfirmPw(e.target.value)}
                    placeholder="Re-enter new password"
                    onFocus={() => setFocused('conf')}
                    onBlur={() => setFocused(null)}
                    style={inputStyle('conf')}
                  />
                </div>

                {errMsg && (
                  <div style={{
                    marginBottom: 14, padding: '10px 14px', borderRadius: qxRadius.sm,
                    background: 'rgba(224,62,107,0.08)', border: '1px solid rgba(224,62,107,0.20)',
                    color: '#B22456', fontSize: 13, fontWeight: 500, fontFamily: qxType.body,
                  }}>{errMsg}</div>
                )}

                <button type="submit" disabled={loading} style={{
                  width: '100%', padding: '14px', borderRadius: qxRadius.full, border: 'none',
                  background: loading ? 'rgba(212,255,63,0.50)' : QX.lime,
                  color: QX.limeInk,
                  fontFamily: qxType.body, fontSize: 14.5, fontWeight: 600,
                  cursor: loading ? 'wait' : 'pointer',
                  transition: `all 180ms ${qxEase}`,
                  boxShadow: loading ? 'none' : '0 4px 20px rgba(212,255,63,0.30)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
                  onMouseEnter={e => { if (!loading) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 26px rgba(212,255,63,0.40)'; } }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; if (!loading) e.currentTarget.style.boxShadow = '0 4px 20px rgba(212,255,63,0.30)'; }}
                >
                  {loading ? 'Saving…' : 'Save new password'}
                  {!loading && (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M3 7h8M8 4l3 3-3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>

        <p style={{
          textAlign: 'center', marginTop: 20,
          fontFamily: qxType.mono, fontSize: 10, letterSpacing: '0.16em',
          textTransform: 'uppercase', color: T.inkFaint,
        }}>Quidax · Internal tool · Secure password reset</p>
      </div>
    </div>
  );
};

Object.assign(window, { ResetPasswordScreen });
