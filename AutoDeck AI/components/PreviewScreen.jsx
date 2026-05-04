
// Preview & Download Screen
const PreviewScreen = ({ config, onGenerateAgain, tweaks }) => {
  const [downloading, setDownloading] = React.useState(false);
  const [downloaded, setDownloaded] = React.useState(false);

  const deckTitle = config?.inputText
    ? config.inputText.trim().split(/\s+/).slice(0, 5).join(' ') + '…'
    : 'Q2 Sales Strategy Overview';

  const slideCount = config?.slideCount === 'Auto' ? 10 : parseInt(config?.slideCount) || 10;

  // Generate mock slide previews
  const slidePreviews = [
    { title: 'Executive Summary', bullets: ['Strong Q2 performance across all verticals', 'New markets entered: Ghana, Senegal', 'Revenue up 34% YoY'], type: 'title' },
    { title: 'Market Overview', bullets: ['Africa crypto market growing at 18% CAGR', 'Quidax positioned in top 3 exchanges', 'User base crossed 2M milestone'], type: 'content' },
    { title: 'Key Metrics', bullets: ['Monthly active users: 1.2M', 'Transaction volume: $280M', 'NPS score: 72'], type: 'metrics' },
    { title: 'Growth Initiatives', bullets: ['B2B partnerships with 12 new fintechs', 'Mobile app v4.0 launch', 'Merchant payment integration'], type: 'content' },
    { title: 'Challenges & Mitigations', bullets: ['Regulatory complexity in new markets', 'Liquidity management during volatility', 'Talent acquisition in competitive market'], type: 'content' },
    { title: 'Product Roadmap', bullets: ['Q3: Stablecoin savings product', 'Q4: Cross-border remittance beta', 'H1 2027: DeFi gateway'], type: 'roadmap' },
    { title: 'Team & Resources', bullets: ['Headcount grew from 120 to 180', 'New VP Engineering hired', 'Design team doubled'], type: 'content' },
    { title: 'Financial Projections', bullets: ['Q3 target: $95M transaction volume', '40% gross margin target', 'Cash runway: 28 months'], type: 'metrics' },
    { title: 'Partnerships', bullets: ['MTN Mobile Money integration live', 'Flutterwave API partnership signed', 'Binance liquidity pool access'], type: 'content' },
    { title: 'Next Steps & Asks', bullets: ['Board approval for Series B extension', 'Regulatory counsel in 3 new markets', 'Marketing budget increase for Q3'], type: 'cta' },
  ].slice(0, slideCount);

  const handleDownload = () => {
    setDownloading(true);
    setTimeout(() => {
      setDownloading(false);
      setDownloaded(true);
    }, 2000);
  };

  const bg = tweaks?.darkMode ? '#0F0318' : '#F4F1F9';
  const cardBg = tweaks?.darkMode ? '#1E0635' : '#FFFFFF';
  const textColor = tweaks?.darkMode ? '#FFFFFF' : '#1A0530';
  const subColor = tweaks?.darkMode ? 'rgba(255,255,255,0.45)' : '#7A6B8A';
  const borderColor = tweaks?.darkMode ? 'rgba(123,47,190,0.25)' : 'rgba(123,47,190,0.12)';

  return (
    <div style={{
      minHeight: '100vh',
      background: bg,
      padding: '40px 48px',
      fontFamily: 'Calibri, sans-serif',
      overflowY: 'auto'
    }}>
      {/* Header row */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: '32px',
        gap: '24px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <div style={{
              padding: '4px 10px',
              borderRadius: '20px',
              background: 'rgba(80,200,120,0.15)',
              border: '1px solid rgba(80,200,120,0.3)',
              color: '#3DB870',
              fontSize: '12px',
              fontWeight: '700',
              letterSpacing: '0.5px',
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#3DB870' }} />
              Ready
            </div>
          </div>
          <h1 style={{
            fontFamily: '"Arial Black", sans-serif',
            fontSize: '24px',
            fontWeight: '900',
            color: textColor,
            margin: '0 0 4px',
            letterSpacing: '-0.3px',
            maxWidth: '560px',
            wordBreak: 'break-word'
          }}>{deckTitle}</h1>
          <div style={{ display: 'flex', gap: '16px', color: subColor, fontSize: '13px' }}>
            <span>{slidePreviews.length} slides</span>
            <span>·</span>
            <span>{config?.templateStyle || 'Professional'} template</span>
            <span>·</span>
            <span>Generated just now</span>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '12px', flexShrink: 0 }}>
          <button
            onClick={onGenerateAgain}
            style={{
              padding: '12px 20px',
              borderRadius: '10px',
              border: `1.5px solid ${tweaks?.darkMode ? 'rgba(255,255,255,0.15)' : '#DDD4EC'}`,
              background: 'transparent',
              color: tweaks?.darkMode ? 'rgba(255,255,255,0.7)' : '#4A3560',
              fontSize: '14px',
              fontFamily: 'Calibri, sans-serif',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '7px',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#7B2FBE'; e.currentTarget.style.color = '#7B2FBE'; }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = tweaks?.darkMode ? 'rgba(255,255,255,0.15)' : '#DDD4EC';
              e.currentTarget.style.color = tweaks?.darkMode ? 'rgba(255,255,255,0.7)' : '#4A3560';
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 7A6 6 0 1112.5 4M1 1v3h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Generate Again
          </button>

          <button
            onClick={handleDownload}
            style={{
              padding: '12px 24px',
              borderRadius: '10px',
              border: 'none',
              background: downloaded
                ? 'rgba(80,200,120,0.15)'
                : downloading
                  ? 'linear-gradient(135deg, #6020A0, #C030A0)'
                  : 'linear-gradient(135deg, #7B2FBE 0%, #D946A8 100%)',
              color: downloaded ? '#3DB870' : '#FFFFFF',
              fontSize: '15px',
              fontFamily: '"Arial Black", sans-serif',
              fontWeight: '900',
              cursor: downloading ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s ease',
              boxShadow: downloaded ? 'none' : '0 4px 20px rgba(217,70,168,0.3)',
              border: downloaded ? '1.5px solid rgba(80,200,120,0.3)' : 'none',
              letterSpacing: '0.2px'
            }}
          >
            {downloading ? (
              <>
                <div style={{
                  width: '14px',
                  height: '14px',
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: '#fff',
                  borderRadius: '50%',
                  animation: 'spin 0.7s linear infinite'
                }} />
                Downloading…
              </>
            ) : downloaded ? (
              <>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2 7l3.5 3.5L12 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Downloaded
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M7 1v8M4 6l3 3 3-3M2 11h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Download .PPTX
              </>
            )}
          </button>
        </div>
      </div>

      {/* Slides preview */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {slidePreviews.map((slide, i) => (
          <div key={i} style={{
            background: cardBg,
            borderRadius: '12px',
            border: `1.5px solid ${borderColor}`,
            padding: '18px 24px',
            display: 'grid',
            gridTemplateColumns: '36px 1fr',
            gap: '16px',
            alignItems: 'start',
            boxShadow: tweaks?.darkMode ? 'none' : '0 1px 8px rgba(45,10,78,0.04)',
            transition: 'border-color 0.15s ease'
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(123,47,190,0.3)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = borderColor; }}
          >
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: i === 0
                ? 'linear-gradient(135deg, #7B2FBE, #D946A8)'
                : (tweaks?.darkMode ? 'rgba(123,47,190,0.2)' : 'rgba(123,47,190,0.08)'),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: i === 0 ? '#fff' : '#7B2FBE',
              fontSize: '13px',
              fontFamily: '"Arial Black", sans-serif',
              fontWeight: '900',
              flexShrink: 0
            }}>
              {String(i + 1).padStart(2, '0')}
            </div>
            <div>
              <div style={{
                fontFamily: '"Arial Black", sans-serif',
                fontSize: '15px',
                fontWeight: '900',
                color: textColor,
                marginBottom: '8px',
                letterSpacing: '-0.2px'
              }}>{slide.title}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {slide.bullets.map((b, j) => (
                  <div key={j} style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                    fontSize: '13px',
                    color: subColor,
                    fontFamily: 'Calibri, sans-serif'
                  }}>
                    <div style={{
                      width: '4px',
                      height: '4px',
                      borderRadius: '50%',
                      background: '#D946A8',
                      flexShrink: 0,
                      marginTop: '6px'
                    }} />
                    {b}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

Object.assign(window, { PreviewScreen });
