// Processing Screen
const ProcessingScreen = ({ config, onComplete, tweaks }) => {
  const [phase, setPhase] = React.useState(0);
  const [progress, setProgress] = React.useState(0);
  const [dots, setDots] = React.useState('');

  const phases = [
    { label: 'Parsing your content', duration: 3000 },
    { label: 'Structuring slides', duration: 4000 },
    { label: 'Applying brand formatting', duration: 5000 },
    { label: 'Finalising your deck', duration: 3000 },
  ];

  React.useEffect(() => {
    let totalElapsed = 0;
    const totalDuration = phases.reduce((s, p) => s + p.duration, 0);
    const interval = setInterval(() => {
      totalElapsed += 80;
      setProgress(Math.min((totalElapsed / totalDuration) * 100, 98));
      const phaseStart = phases.slice(0, phase).reduce((s, p) => s + p.duration, 0);
      const phaseEnd = phaseStart + phases[phase].duration;
      if (totalElapsed >= phaseEnd && phase < phases.length - 1) {
        setPhase(p => p + 1);
      }
      if (totalElapsed >= totalDuration) {
        clearInterval(interval);
        setProgress(100);
        setTimeout(() => onComplete(), 500);
      }
    }, 80);
    return () => clearInterval(interval);
  }, []);

  React.useEffect(() => {
    const d = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 400);
    return () => clearInterval(d);
  }, []);

  const bg = tweaks?.darkMode ? '#0F0318' : '#F4F1F9';
  const cardBg = tweaks?.darkMode ? '#1E0635' : '#FFFFFF';
  const textColor = tweaks?.darkMode ? '#FFFFFF' : '#1A0530';
  const subColor = tweaks?.darkMode ? 'rgba(255,255,255,0.45)' : '#7A6B8A';

  return (
    <div style={{
      minHeight: '100vh',
      background: bg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Calibri, sans-serif',
      padding: '40px'
    }}>
      <div style={{ width: '100%', maxWidth: '540px', textAlign: 'center' }}>

        {/* Gem animation */}
        <div style={{ marginBottom: '40px', display: 'flex', justifyContent: 'center' }}>
          <div style={{
            position: 'relative',
            width: '96px',
            height: '96px',
            animation: 'gemSpin 3s linear infinite'
          }}>
            <style>{`
              @keyframes gemSpin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
              @keyframes gemPulse {
                0%, 100% { opacity: 0.6; transform: scale(1); }
                50% { opacity: 1; transform: scale(1.08); }
              }
            `}</style>
            <svg width="96" height="96" viewBox="0 0 96 96" fill="none">
              <polygon points="48,6 90,30 90,66 48,90 6,66 6,30"
                fill="none" stroke="url(#gemGrad)" strokeWidth="2"/>
              <polygon points="48,6 90,30 48,48 6,30"
                fill="url(#faceTop)" opacity="0.8"/>
              <polygon points="48,48 90,30 90,66 48,90"
                fill="url(#faceRight)" opacity="0.6"/>
              <polygon points="48,48 48,90 6,66 6,30"
                fill="url(#faceLeft)" opacity="0.5"/>
              <defs>
                <linearGradient id="gemGrad" x1="0" y1="0" x2="96" y2="96">
                  <stop stopColor="#7B2FBE"/>
                  <stop offset="1" stopColor="#D946A8"/>
                </linearGradient>
                <linearGradient id="faceTop" x1="6" y1="6" x2="90" y2="48">
                  <stop stopColor="#9B4FDE"/>
                  <stop offset="1" stopColor="#7B2FBE"/>
                </linearGradient>
                <linearGradient id="faceRight" x1="48" y1="30" x2="90" y2="90">
                  <stop stopColor="#D946A8"/>
                  <stop offset="1" stopColor="#7B2FBE"/>
                </linearGradient>
                <linearGradient id="faceLeft" x1="6" y1="30" x2="48" y2="90">
                  <stop stopColor="#7B2FBE"/>
                  <stop offset="1" stopColor="#4A1A8E"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>

        {/* Title */}
        <h2 style={{
          fontFamily: '"Arial Black", sans-serif',
          fontSize: '24px',
          fontWeight: '900',
          color: textColor,
          margin: '0 0 8px',
          letterSpacing: '-0.3px'
        }}>Building your deck{dots}</h2>
        <p style={{ color: subColor, fontSize: '15px', margin: '0 0 40px' }}>
          This usually takes 15–30 seconds
        </p>

        {/* Progress card */}
        <div style={{
          background: cardBg,
          borderRadius: '20px',
          padding: '32px',
          border: `1.5px solid ${tweaks?.darkMode ? 'rgba(123,47,190,0.25)' : 'rgba(123,47,190,0.12)'}`,
          boxShadow: tweaks?.darkMode ? 'none' : '0 4px 24px rgba(45,10,78,0.08)'
        }}>
          {/* Steps */}
          <div style={{ marginBottom: '28px' }}>
            {phases.map((p, i) => {
              const done = i < phase;
              const active = i === phase;
              return (
                <div key={i} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 0',
                  borderBottom: i < phases.length - 1 ? `1px solid ${tweaks?.darkMode ? 'rgba(255,255,255,0.05)' : '#F0EAF8'}` : 'none',
                  opacity: done ? 0.5 : active ? 1 : 0.3,
                  transition: 'opacity 0.4s ease'
                }}>
                  <div style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    flexShrink: 0,
                    background: done
                      ? 'rgba(217,70,168,0.15)'
                      : active
                        ? 'linear-gradient(135deg, #7B2FBE, #D946A8)'
                        : (tweaks?.darkMode ? 'rgba(255,255,255,0.06)' : '#F0EAF8'),
                    border: done ? '2px solid #D946A8' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {done ? (
                      <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                        <path d="M2 5.5l2.5 2.5 4.5-5" stroke="#D946A8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    ) : active ? (
                      <div style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: '#fff',
                        animation: 'gemPulse 1s ease-in-out infinite'
                      }} />
                    ) : null}
                  </div>
                  <span style={{
                    fontSize: '14px',
                    color: done ? '#D946A8' : (tweaks?.darkMode ? 'rgba(255,255,255,0.85)' : '#2D0A4E'),
                    fontWeight: active ? '600' : '400',
                    fontFamily: 'Calibri, sans-serif'
                  }}>{p.label}</span>
                  {active && <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#7B2FBE' }}>In progress</span>}
                  {done && <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#D946A8' }}>Done</span>}
                </div>
              );
            })}
          </div>

          {/* Progress bar */}
          <div style={{
            height: '6px',
            borderRadius: '3px',
            background: tweaks?.darkMode ? 'rgba(255,255,255,0.08)' : '#EDE7F5',
            overflow: 'hidden'
          }}>
            <div style={{
              height: '100%',
              width: `${progress}%`,
              borderRadius: '3px',
              background: 'linear-gradient(90deg, #7B2FBE, #D946A8)',
              transition: 'width 0.3s ease'
            }} />
          </div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: '8px'
          }}>
            <span style={{ fontSize: '12px', color: subColor }}>
              {config?.slideCount === 'Auto' ? 'Auto-detecting slides' : `${config?.slideCount} slides`} · {config?.templateStyle} template
            </span>
            <span style={{ fontSize: '12px', color: '#7B2FBE', fontWeight: '600' }}>
              {Math.round(progress)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { ProcessingScreen });
