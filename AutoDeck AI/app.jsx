// ============================================================
// APP ROOT
// ============================================================
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "darkMode": false,
  "accentColor": "#D946A8"
}/*EDITMODE-END*/;

const ADMIN_EMAILS = ['admin@quidax.com'];

const isAdminUser = (user) => {
  const email = user?.email?.toLowerCase();
  return ADMIN_EMAILS.includes(email);
};

const App = () => {
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [screen, setScreen] = React.useState('login');
  const [deckConfig, setDeckConfig] = React.useState(null);
  const [currentUser, setCurrentUser] = React.useState(null);
  const [authReady, setAuthReady] = React.useState(false);
  const [authError, setAuthError] = React.useState("");
  const [slideshowSlides, setSlideshowSlides] = React.useState(null);

  const userRole = isAdminUser(currentUser) ? 'admin' : 'employee';

  React.useEffect(() => {
    const unsubscribe = window.firebaseAuth.onAuthStateChanged(async (user) => {
      setAuthReady(true);
      if (user) {
        if (!user.email.toLowerCase().endsWith('@quidax.com')) {
          await window.firebaseAuth.signOut();
          setAuthError("Only @quidax.com accounts are allowed.");
          return;
        }
        const signedInUser = { email: user.email, uid: user.uid, displayName: user.displayName };
        setCurrentUser(signedInUser);
        setAuthError("");
        setScreen(prev => prev === 'login' ? (isAdminUser(signedInUser) ? 'admin' : 'home') : prev);
      } else {
        setCurrentUser(null);
        setScreen('login');
      }
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = (userData) => {
    setCurrentUser(userData);
    setScreen(isAdminUser(userData) ? 'admin' : 'home');
  };

  const handleLogout = async () => {
    await window.firebaseAuth.signOut();
  };

  if (!authReady) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: '#1A0530' }}>
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" style={{ animation: 'lgSpin 1s linear infinite' }}>
          <circle cx="12" cy="12" r="10" stroke="#7B2FBE" strokeWidth="2.5" opacity="0.3" />
          <path d="M12 2a10 10 0 0 1 10 10" stroke="#D946A8" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
        <style>{`@keyframes lgSpin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const handleGenerate = (config) => {
    setDeckConfig(config);
    setScreen('processing');
  };

  const handleProcessingComplete = () => {
    setScreen('preview');
  };

  const handleGenerateAgain = () => {
    setScreen('home');
  };

  const handleNavigate = (dest) => {
    setScreen(dest);
  };

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      overflow: 'hidden',
      background: tweaks?.darkMode ? '#0F031F' : '#FAF8FC'
    }}>
      {screen === 'login' && (
        <LoginScreen onLogin={handleLogin} authError={authError} onClearAuthError={() => setAuthError("")} />
      )}
      {screen !== 'login' && screen !== 'processing' && screen !== 'slideshow' && (
        <Sidebar
          currentScreen={screen}
          onNavigate={handleNavigate}
          currentUser={currentUser}
          userRole={userRole}
          onLogout={handleLogout}
          onChangePassword={() => setScreen('changePassword')}
          onSettings={() => setScreen('settings')}
          darkMode={tweaks?.darkMode}
          onToggleDark={() => setTweak('darkMode', !tweaks?.darkMode)}
        />
      )}

      {screen !== 'login' && <div style={{
        flex: 1,
        marginLeft: (screen !== 'processing' && screen !== 'slideshow') ? '224px' : 0,
        overflowY: 'auto',
        overflowX: 'hidden',
        height: '100vh'
      }}>
        {screen === 'home' && (
          <HomeScreenA onGenerate={handleGenerate} tweaks={tweaks} />
        )}
        {screen === 'processing' && (
          <ProcessingScreen
            config={deckConfig}
            onComplete={handleProcessingComplete}
            tweaks={tweaks}
          />
        )}
        {screen === 'preview' && (
          <PreviewScreen
            config={deckConfig}
            onGenerateAgain={handleGenerateAgain}
            onViewSlideshow={(slides) => { setSlideshowSlides(slides); setScreen('slideshow'); }}
            tweaks={tweaks}
          />
        )}
        {screen === 'slideshow' && (
          <SlideGenerator
            slides={slideshowSlides || []}
            config={deckConfig}
            tweaks={tweaks}
            onBack={() => setScreen('preview')}
          />
        )}
        {screen === 'history' && (
          <HistoryScreen tweaks={tweaks} />
        )}
        {screen === 'changePassword' && (
          <ChangePasswordScreen tweaks={tweaks} onBack={() => setScreen('settings')} />
        )}
        {screen === 'settings' && (
          <AccountSettingsScreen
            tweaks={tweaks}
            currentUser={currentUser}
            onNavigate={handleNavigate}
            onLogout={handleLogout}
            onUserUpdated={(updated) => setCurrentUser(updated)}
          />
        )}
        {screen === 'admin' && userRole === 'admin' && (
          <AdminScreen tweaks={tweaks} />
        )}
        {screen === 'admin' && userRole !== 'admin' && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            color: tweaks?.darkMode ? 'rgba(255,255,255,0.4)' : '#9080A0',
            gap: '12px'
          }}>
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" style={{ opacity: 0.4 }}>
              <rect x="10" y="22" width="28" height="20" rx="3" stroke="currentColor" strokeWidth="2"/>
              <path d="M16 22v-6a8 8 0 0116 0v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <circle cx="24" cy="33" r="2" fill="currentColor"/>
            </svg>
            <div style={{ fontSize: '16px', fontWeight: '600' }}>Admin access only</div>
            <div style={{ fontSize: '14px' }}>Sign in with an admin account to view this panel</div>
          </div>
        )}
      </div>}

      <TweaksPanel title="Tweaks">
        <TweakSection title="Appearance">
          <TweakToggle
            label="Dark Mode"
            value={tweaks?.darkMode}
            onChange={v => setTweak('darkMode', v)}
          />
        </TweakSection>
        <TweakSection title="Navigation">
          <TweakSelect
            label="Go to Screen"
            value={screen}
            options={[
              { label: 'Login', value: 'login' },
              { label: 'Home / Generate', value: 'home' },
              { label: 'Processing', value: 'processing' },
              { label: 'Preview & Download', value: 'preview' },
              { label: 'Slideshow', value: 'slideshow' },
              { label: 'History', value: 'history' },
              { label: 'Admin Panel', value: 'admin' },
              { label: 'Change Password', value: 'changePassword' },
              { label: 'Account Settings', value: 'settings' },
            ]}
            onChange={v => {
              if (v === 'processing') {
                setDeckConfig({ inputText: 'Sample content for demo preview', slideCount: '10', templateStyle: 'Professional' });
              }
              if (v === 'preview' && !deckConfig) {
                setDeckConfig({ inputText: 'Q2 Sales Strategy and market expansion plan for Quidax', slideCount: '10', templateStyle: 'Professional' });
              }
              setScreen(v);
            }}
          />
        </TweakSection>
      </TweaksPanel>
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
