// ============================================================
// LoginScreen — split screen, lime CTA, brand quiet
// ============================================================
const QUIDAX_EMAIL_DOMAIN = '@quidax.com';

const isQuidaxEmail = (value = '') => value.toLowerCase().endsWith(QUIDAX_EMAIL_DOMAIN);

const createGoogleProvider = () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  provider.addScope('email');
  provider.addScope('profile');
  provider.setCustomParameters({ hd: 'quidax.com', prompt: 'select_account' });
  return provider;
};

const getFirebaseErrorCode = (err) => err?.code || '';
const getFirebaseErrorEmail = (err) => err?.email || err?.customData?.email || '';
const getGoogleCredentialFromError = (err) => {
  try {
    return firebase.auth.GoogleAuthProvider.credentialFromError(err);
  } catch {
    return null;
  }
};

const shouldFallbackToGoogleRedirect = (err) => [
  'auth/popup-blocked',
  'auth/operation-not-supported-in-this-environment',
].includes(getFirebaseErrorCode(err));

const localGoogleSignInMessage = () => {
  const { hostname = '', port = '' } = window.location || {};
  if (hostname === '127.0.0.1' || hostname === '::1') {
    const localUrl = `http://localhost${port ? `:${port}` : ''}/`;
    return `Local Google sign-in uses localhost. Open ${localUrl} instead of ${hostname}, or add ${hostname} in Firebase Auth settings.`;
  }
  return `Google sign-in is not authorized for ${hostname || 'this domain'}. Add this domain in Firebase Auth settings.`;
};

const googleSignInErrorMessage = (err) => {
  const code = getFirebaseErrorCode(err);
  const email = getFirebaseErrorEmail(err);
  const emailSuffix = email ? ` for ${email}` : '';
  const messages = {
    'auth/account-exists-with-different-credential': `A password account already exists${emailSuffix}. Sign in with your password, or reset it if needed.`,
    'auth/credential-already-in-use': 'That Google account is already connected to another AutoDeck account.',
    'auth/email-already-in-use': `An account already exists${emailSuffix}. Sign in with your password, or reset it if needed.`,
    'auth/operation-not-allowed': 'Google sign-in is not enabled in Firebase Auth.',
    'auth/popup-blocked': 'Your browser blocked the Google sign-in popup. Allow popups and try again.',
    'auth/unauthorized-domain': localGoogleSignInMessage(),
    'auth/network-request-failed': 'Network error during Google sign-in. Check your connection and try again.',
    'auth/web-storage-unsupported': 'Your browser is blocking storage needed for Google sign-in.',
  };
  return messages[code] || 'Google sign-in failed. Try again or use email and password.';
};

const logGoogleSignInError = (err, context = 'popup') => {
  console.warn('Google sign-in failed', {
    context,
    code: getFirebaseErrorCode(err),
    email: getFirebaseErrorEmail(err),
    message: err?.message,
  });
};

const LoginScreen = ({ onLogin, authError, onClearAuthError }) => {
  const [mode, setMode] = React.useState('signin');
  const [fullName, setFullName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [showPw, setShowPw] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState('');
  const [focused, setFocused] = React.useState(null);
  const [pendingGoogleCredential, setPendingGoogleCredential] = React.useState(null);
  const [pendingGoogleEmail, setPendingGoogleEmail] = React.useState('');

  React.useEffect(() => { if (authError) { setError(authError); setLoading(false); onClearAuthError && onClearAuthError(); } }, [authError]);

  React.useEffect(() => {
    let active = true;
    if (!window.firebaseAuth?.getRedirectResult) return () => { active = false; };
    window.firebaseAuth.getRedirectResult()
      .then(async (result) => {
        if (!active || !result?.user) return;
        const signedInUser = result.user;
        if (!isQuidaxEmail(signedInUser.email || '')) {
          await window.firebaseAuth.signOut();
          if (active) setError('Only @quidax.com accounts are allowed.');
          return;
        }
        onLogin && onLogin({
          email: signedInUser.email,
          uid: signedInUser.uid,
          displayName: signedInUser.displayName,
        });
      })
      .catch((err) => {
        if (!active || getFirebaseErrorCode(err) === 'auth/no-auth-event') return;
        logGoogleSignInError(err, 'redirect');
        setLoading(false);
        setError(googleSignInErrorMessage(err));
      });
    return () => { active = false; };
  }, []);

  const handleSignIn = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!email || !password) return setError('Enter your email and password.');
    if (!isQuidaxEmail(email))     return setError('Only @quidax.com emails are allowed.');
    setLoading(true);
    try {
      const r = await window.firebaseAuth.signInWithEmailAndPassword(email, password);
      if (
        pendingGoogleCredential &&
        (!pendingGoogleEmail || r.user.email?.toLowerCase() === pendingGoogleEmail.toLowerCase())
      ) {
        try {
          await r.user.linkWithCredential(pendingGoogleCredential);
          setPendingGoogleCredential(null);
          setPendingGoogleEmail('');
        } catch (linkErr) {
          logGoogleSignInError(linkErr, 'link-after-password');
        }
      }
      onLogin && onLogin({ email: r.user.email, uid: r.user.uid, displayName: r.user.displayName });
    } catch (err) {
      setLoading(false);
      const m = { 'auth/user-not-found':'No account found.','auth/wrong-password':'Incorrect password.','auth/invalid-credential':'Incorrect email or password.','auth/too-many-requests':'Too many attempts. Try later.' };
      setError(m[err.code] || 'Sign in failed.');
    }
  };
  const handleSignUp = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!fullName.trim()) return setError('Enter your name.');
    if (!isQuidaxEmail(email))  return setError('Only @quidax.com emails are allowed.');
    if (password.length < 8) return setError('Password must be 8+ characters.');
    if (password !== confirmPassword) return setError('Passwords do not match.');
    setLoading(true);
    try {
      const r = await window.firebaseAuth.createUserWithEmailAndPassword(email, password);
      await r.user.updateProfile({ displayName: fullName.trim() });
      onLogin && onLogin({ email: r.user.email, uid: r.user.uid, displayName: fullName.trim() });
    } catch (err) {
      setLoading(false);
      setError(err.message || 'Registration failed.');
    }
  };
  const handleForgot = async (e) => {
    e.preventDefault();
    if (!email || !isQuidaxEmail(email)) return setError('Enter your @quidax.com email above first.');
    try { await window.firebaseAuth.sendPasswordResetEmail(email); setSuccess(`Reset email sent to ${email}`); }
    catch { setError('Could not send reset email.'); }
  };
  const handleGoogle = async () => {
    setError(''); setSuccess(''); setLoading(true);
    const provider = createGoogleProvider();
    try {
      const result = await window.firebaseAuth.signInWithPopup(provider);
      const signedInUser = result?.user;
      if (!signedInUser) return;
      if (!isQuidaxEmail(signedInUser.email || '')) {
        await window.firebaseAuth.signOut();
        setLoading(false);
        setError('Only @quidax.com accounts are allowed.');
        return;
      }
      onLogin && onLogin({
        email: signedInUser.email,
        uid: signedInUser.uid,
        displayName: signedInUser.displayName,
      });
    } catch (err) {
      if (getFirebaseErrorCode(err) === 'auth/popup-closed-by-user' || getFirebaseErrorCode(err) === 'auth/cancelled-popup-request') {
        setLoading(false);
        return;
      }
      logGoogleSignInError(err);
      if (getFirebaseErrorCode(err) === 'auth/account-exists-with-different-credential') {
        const credential = getGoogleCredentialFromError(err);
        const credentialEmail = getFirebaseErrorEmail(err);
        if (credential) {
          setPendingGoogleCredential(credential);
          setPendingGoogleEmail(credentialEmail);
        }
        if (credentialEmail) setEmail(credentialEmail);
        setLoading(false);
        setError(
          credential
            ? 'A password account already exists for this email. Enter your password and sign in once to connect Google.'
            : googleSignInErrorMessage(err)
        );
        return;
      }
      if (shouldFallbackToGoogleRedirect(err) && window.firebaseAuth?.signInWithRedirect) {
        try {
          await window.firebaseAuth.signInWithRedirect(provider);
          return;
        } catch (redirectErr) {
          logGoogleSignInError(redirectErr, 'redirect-start');
          setLoading(false);
          setError(googleSignInErrorMessage(redirectErr));
          return;
        }
      }
      setLoading(false);
      setError(googleSignInErrorMessage(err));
    }
  };

  const inputStyle = (id) => ({
    width: '100%', padding: '13px 14px', borderRadius: qxRadius.sm,
    border: `1px solid ${focused === id ? '#5F2A91' : 'rgba(45,15,78,0.14)'}`,
    background: '#FFFFFF',
    fontFamily: qxType.body, fontSize: 14.5, color: '#1A0530',
    outline: 'none', transition: `all 140ms ${qxEase}`,
    boxShadow: focused === id ? '0 0 0 3px rgba(95,42,145,0.10)' : 'none',
    boxSizing: 'border-box',
  });

  return (
    <div style={{ minHeight: '100vh', width: '100%', display: 'flex', fontFamily: qxType.body, background: '#FAF8FC' }}>
      {/* LEFT — narrative panel */}
      <div style={{ flex: '0 0 50%', background: '#0F031F', position: 'relative', padding: '64px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', overflow: 'hidden' }}>
        <div aria-hidden style={{ position: 'absolute', top: '-15%', right: '-20%', width: 600, height: 600, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(122,63,176,0.45) 0%, transparent 60%)', filter: 'blur(40px)' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg, #5F2A91, #B891DC)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
                <path d="M7 1L13 7L7 13L1 7L7 1Z" stroke="#F6F1FB" strokeWidth="1.3"/>
                <circle cx="7" cy="7" r="1.6" fill="#F6F1FB"/>
              </svg>
            </div>
            <div style={{ fontFamily: qxType.display, fontSize: 18, color: '#F6F1FB', fontWeight: 600, letterSpacing: '-0.02em' }}>
              AutoDeck<span style={{ color: '#B891DC', fontStyle: 'italic', fontWeight: 400, marginLeft: 4 }}>AI</span>
            </div>
          </div>
        </div>

        <div style={{ position: 'relative', zIndex: 1, maxWidth: 460 }}>
          <div style={{ fontFamily: qxType.mono, fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(246,241,251,0.55)', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: QX.lime, boxShadow: `0 0 12px ${QX.lime}` }} />
            Internal tool
          </div>
          <h1 style={{ fontFamily: qxType.display, fontSize: 56, fontWeight: 500, lineHeight: 1.02, letterSpacing: '-0.03em', color: '#F6F1FB', margin: '0 0 20px' }}>
            Branded decks,<br/>
            <span style={{ color: '#B891DC', fontStyle: 'italic', fontWeight: 400 }}>without the busywork.</span>
          </h1>
          <p style={{ fontSize: 16, lineHeight: 1.55, color: 'rgba(246,241,251,0.66)', margin: '0 0 32px', maxWidth: 380 }}>
            Paste your notes, upload a doc, or describe what you want. AutoDeck AI structures it into a Quidax-perfect presentation in seconds.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {['Brand-compliant', 'AI-powered', 'Secure'].map(t => (
              <span key={t} style={{ padding: '6px 12px', borderRadius: qxRadius.full, border: '1px solid rgba(184,145,220,0.18)', color: 'rgba(246,241,251,0.66)', fontSize: 12, fontFamily: qxType.body, fontWeight: 500 }}>{t}</span>
            ))}
          </div>
        </div>

        <div style={{ position: 'relative', zIndex: 1, fontFamily: qxType.mono, fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(246,241,251,0.32)' }}>
          Quidax · Lagos × Nigeria
        </div>
      </div>

      {/* RIGHT — form */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 64, background: '#FAF8FC' }}>
        <div style={{ width: '100%', maxWidth: 380 }}>
          <div style={{ display: 'inline-flex', background: 'rgba(95,42,145,0.06)', borderRadius: qxRadius.full, padding: 3, marginBottom: 32, border: '1px solid rgba(45,15,78,0.08)' }}>
            {[{ k: 'signin', l: 'Sign in' }, { k: 'signup', l: 'Create account' }].map(o => (
              <button key={o.k} onClick={() => { setMode(o.k); setError(''); setSuccess(''); setPassword(''); setConfirmPassword(''); }}
                style={{ padding: '7px 16px', borderRadius: qxRadius.full, border: 'none',
                  background: mode === o.k ? '#FFFFFF' : 'transparent',
                  color: mode === o.k ? '#1A0530' : '#8A7B9E',
                  fontFamily: qxType.body, fontSize: 13, fontWeight: mode === o.k ? 600 : 500,
                  cursor: 'pointer', transition: `all 140ms ${qxEase}`,
                  boxShadow: mode === o.k ? '0 1px 3px rgba(45,15,78,0.06)' : 'none' }}>
                {o.l}
              </button>
            ))}
          </div>

          <h2 style={{ fontFamily: qxType.display, fontSize: 32, fontWeight: 500, color: '#1A0530', margin: '0 0 6px', letterSpacing: '-0.02em' }}>
            {mode === 'signin' ? 'Welcome back' : 'Join AutoDeck AI'}
          </h2>
          <p style={{ fontSize: 14, color: '#5A4B6E', margin: '0 0 28px' }}>
            {mode === 'signin' ? 'Use your Quidax work email to continue.' : 'Register with your @quidax.com email.'}
          </p>

          <form onSubmit={mode === 'signin' ? handleSignIn : handleSignUp}>
            {mode === 'signup' && (
              <Field label="Full name">
                <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your full name"
                  onFocus={() => setFocused('name')} onBlur={() => setFocused(null)} style={inputStyle('name')} />
              </Field>
            )}
            <Field label="Work email">
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@quidax.com"
                onFocus={() => setFocused('email')} onBlur={() => setFocused(null)} style={inputStyle('email')} />
            </Field>
            <Field label="Password">
              <div style={{ position: 'relative' }}>
                <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                  placeholder={mode === 'signup' ? 'Min. 8 characters' : 'Enter your password'}
                  onFocus={() => setFocused('pw')} onBlur={() => setFocused(null)} style={{ ...inputStyle('pw'), paddingRight: 40 }} />
                <button type="button" onClick={() => setShowPw(!showPw)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#8A7B9E', display: 'flex' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    {showPw ? <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>
                            : <><path d="M17.94 17.94A10 10 0 0112 20c-7 0-11-8-11-8a18 18 0 015-5.94"/><path d="M9.9 4.24A9 9 0 0112 4c7 0 11 8 11 8a18 18 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></>}
                  </svg>
                </button>
              </div>
            </Field>
            {mode === 'signup' && (
              <Field label="Confirm password">
                <input type={showPw ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Re-enter your password"
                  onFocus={() => setFocused('cpw')} onBlur={() => setFocused(null)} style={inputStyle('cpw')} />
              </Field>
            )}

            {mode === 'signin' && (
              <div style={{ textAlign: 'right', marginBottom: error || success ? 14 : 24 }}>
                <a href="#" onClick={handleForgot} style={{ fontSize: 13, color: '#5F2A91', textDecoration: 'none', fontWeight: 500 }}>Forgot password?</a>
              </div>
            )}

            {error && <Notice tone="error">{error}</Notice>}
            {success && <Notice tone="ok">{success}</Notice>}

            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '14px', borderRadius: qxRadius.full, border: 'none',
              background: loading ? 'rgba(212,255,63,0.5)' : QX.lime,
              color: '#1A0530',
              fontFamily: qxType.body, fontSize: 14.5, fontWeight: 600, letterSpacing: '-0.005em',
              cursor: loading ? 'wait' : 'pointer',
              transition: `all 180ms ${qxEase}`,
              boxShadow: loading ? 'none' : '0 4px 20px rgba(212,255,63,0.30)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            }}
              onMouseEnter={e => { if (!loading) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 26px rgba(212,255,63,0.40)'; } }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; if (!loading) e.currentTarget.style.boxShadow = '0 4px 20px rgba(212,255,63,0.30)'; }}>
              {loading ? 'Working…' : (mode === 'signin' ? 'Sign in' : 'Create account')}
              {!loading && (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M3 7h8M8 4l3 3-3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </button>
          </form>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '24px 0' }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(45,15,78,0.10)' }} />
            <span style={{ fontFamily: qxType.mono, fontSize: 10, color: '#8A7B9E', letterSpacing: '0.18em', textTransform: 'uppercase' }}>or</span>
            <div style={{ flex: 1, height: 1, background: 'rgba(45,15,78,0.10)' }} />
          </div>

          <button onClick={handleGoogle} style={{
            width: '100%', padding: '13px', borderRadius: qxRadius.full,
            border: '1px solid rgba(45,15,78,0.14)', background: '#FFFFFF',
            color: '#1A0530', fontFamily: qxType.body, fontSize: 13.5, fontWeight: 500,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            transition: `all 140ms ${qxEase}`,
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#5F2A91'; e.currentTarget.style.background = '#F6F1FB'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(45,15,78,0.14)'; e.currentTarget.style.background = '#FFFFFF'; }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>
        </div>
      </div>
    </div>
  );
};

const Field = ({ label, children }) => (
  <div style={{ marginBottom: 14 }}>
    <label style={{ display: 'block', fontFamily: qxType.mono, fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#8A7B9E', marginBottom: 7 }}>{label}</label>
    {children}
  </div>
);

const Notice = ({ tone, children }) => (
  <div style={{
    marginBottom: 14, padding: '10px 14px', borderRadius: qxRadius.sm,
    background: tone === 'error' ? 'rgba(224,62,107,0.08)' : 'rgba(52,199,123,0.08)',
    border: `1px solid ${tone === 'error' ? 'rgba(224,62,107,0.20)' : 'rgba(52,199,123,0.20)'}`,
    color: tone === 'error' ? '#B22456' : '#1F8A5B',
    fontSize: 13, fontWeight: 500, fontFamily: qxType.body,
  }}>{children}</div>
);

Object.assign(window, { LoginScreen });
