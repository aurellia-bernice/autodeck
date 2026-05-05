// ============================================================
// APP ROOT
// ============================================================
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "darkMode": false,
  "userRole": "employee",
  "accentColor": "#D946A8"
}/*EDITMODE-END*/;

const App = () => {
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [screen, setScreen] = React.useState('login');
  const [deckConfig, setDeckConfig] = React.useState(null);
  const [loggedIn, setLoggedIn] = React.useState(false);

  const currentUser = tweaks?.userRole === 'admin' ? 'admin' : 'employee';

  const handleLogin = (userData) => {
    setLoggedIn(true);
    setScreen('home');
  };

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
      background: tweaks?.darkMode ? '#0F0318' : '#F4F1F9'
    }}>
      {screen === 'login' && (
        <LoginScreen onLogin={handleLogin} />
      )}
      {screen !== 'login' && screen !== 'processing' && (
        <Sidebar
          currentScreen={screen}
          onNavigate={handleNavigate}
          currentUser={currentUser}
        />
      )}

      {screen !== 'login' && <div style={{
        flex: 1,
        marginLeft: screen !== 'processing' ? '220px' : 0,
        overflowY: 'auto',
        overflowX: 'hidden',
        height: '100vh'
      }}>
        {screen === 'home' && (
          <HomeScreen onGenerate={handleGenerate} tweaks={tweaks} />
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
            tweaks={tweaks}
          />
        )}
        {screen === 'history' && (
          <HistoryScreen tweaks={tweaks} />
        )}
        {screen === 'admin' && currentUser === 'admin' && (
          <AdminScreen tweaks={tweaks} />
        )}
        {screen === 'admin' && currentUser !== 'admin' && (
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
            <div style={{ fontSize: '14px' }}>Switch to Admin role in Tweaks to view this panel</div>
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
        <TweakSection title="User Role">
          <TweakRadio
            label="View As"
            value={tweaks?.userRole}
            options={[
              { label: 'Employee', value: 'employee' },
              { label: 'Admin', value: 'admin' }
            ]}
            onChange={v => setTweak('userRole', v)}
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
              { label: 'History', value: 'history' },
              { label: 'Admin Panel', value: 'admin' },
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
