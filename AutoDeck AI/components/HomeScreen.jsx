// HomeScreen — Variation A (committed). Re-exports HomeScreenA.
const HomeScreen = (props) => <HomeScreenA {...props} />;
Object.assign(window, { HomeScreen });

// ============================================================
// BELOW: legacy full implementation kept for reference only.
// Not used — HomeScreenA.jsx is the active implementation.
// ============================================================
/*
const HomeScreen_LEGACY = ({ onGenerate, tweaks }) => {
  const [inputText, setInputText] = React.useState('');
  const [slideCount, setSlideCount] = React.useState('Auto');
  const [templateStyle, setTemplateStyle] = React.useState('Professional');
  const [dragOver, setDragOver] = React.useState(false);
  const [uploadedFile, setUploadedFile] = React.useState(null);
  const [charCount, setCharCount] = React.useState(0);

  const slideOptions = ['5', '8', '10', '15', 'Auto'];
  const templates = [
    {
      id: 'Professional',
      label: 'Professional',
      desc: 'Clean & structured',
      accent: '#7B2FBE',
      preview: (
        <svg width="36" height="26" viewBox="0 0 36 26" fill="none">
          <rect width="36" height="26" rx="3" fill="#F0EBF7"/>
          <rect x="2" y="2" width="14" height="22" rx="2" fill="#2D0A4E"/>
          <rect x="18" y="4" width="16" height="2" rx="1" fill="#7B2FBE"/>
          <rect x="18" y="8" width="12" height="1.5" rx="0.75" fill="#ccc"/>
          <rect x="18" y="11" width="14" height="1.5" rx="0.75" fill="#ccc"/>
          <rect x="18" y="14" width="10" height="1.5" rx="0.75" fill="#ccc"/>
        </svg>
      )
    },
    {
      id: 'Minimal',
      label: 'Minimal',
      desc: 'Lots of white space',
      accent: '#555',
      preview: (
        <svg width="36" height="26" viewBox="0 0 36 26" fill="none">
          <rect width="36" height="26" rx="3" fill="#FAFAFA"/>
          <rect x="4" y="5" width="20" height="3" rx="1" fill="#222"/>
          <rect x="4" y="11" width="28" height="1.5" rx="0.75" fill="#ddd"/>
          <rect x="4" y="14" width="22" height="1.5" rx="0.75" fill="#ddd"/>
          <rect x="4" y="17" width="26" height="1.5" rx="0.75" fill="#ddd"/>
          <rect x="4" y="20" width="18" height="1.5" rx="0.75" fill="#ddd"/>
        </svg>
      )
    },
    {
      id: 'Bold',
      label: 'Bold',
      desc: 'High impact visuals',
      accent: '#D946A8',
      preview: (
        <svg width="36" height="26" viewBox="0 0 36 26" fill="none">
          <rect width="36" height="26" rx="3" fill="#1A0530"/>
          <rect x="0" y="0" width="36" height="10" rx="3" fill="url(#boldGrad)"/>
          <defs>
            <linearGradient id="boldGrad" x1="0" y1="0" x2="36" y2="0">
              <stop stopColor="#7B2FBE"/>
              <stop offset="1" stopColor="#D946A8"/>
            </linearGradient>
          </defs>
          <rect x="4" y="3" width="18" height="3" rx="1" fill="white"/>
          <rect x="4" y="13" width="28" height="1.5" rx="0.75" fill="rgba(255,255,255,0.3)"/>
          <rect x="4" y="16" width="22" height="1.5" rx="0.75" fill="rgba(255,255,255,0.3)"/>
          <rect x="4" y="19" width="26" height="1.5" rx="0.75" fill="rgba(255,255,255,0.3)"/>
        </svg>
      )
    },
    {
      id: 'Corporate',
      label: 'Corporate',
      desc: 'Traditional & formal',
      accent: '#F5A623',
      preview: (
        <svg width="36" height="26" viewBox="0 0 36 26" fill="none">
          <rect width="36" height="26" rx="3" fill="#F5F5F5"/>
          <rect x="0" y="0" width="36" height="6" rx="3" fill="#2D0A4E"/>
          <rect x="28" y="0" width="8" height="6" fill="#F5A623"/>
          <rect x="4" y="9" width="28" height="2" rx="1" fill="#2D0A4E"/>
          <rect x="4" y="14" width="28" height="1.5" rx="0.75" fill="#ccc"/>
          <rect x="4" y="17" width="22" height="1.5" rx="0.75" fill="#ccc"/>
          <rect x="4" y="20" width="26" height="1.5" rx="0.75" fill="#ccc"/>
        </svg>
      )
    }
  ];

  const handleTextChange = (e) => {
    setInputText(e.target.value);
    setCharCount(e.target.value.length);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) setUploadedFile(file);
  };

  const handleFileInput = (e) => {
    const file = e.target.files[0];
    if (file) setUploadedFile(file);
  };

  const canGenerate = inputText.trim().length > 10 || uploadedFile;

  return (
    <div style={{
      minHeight: '100vh',
      background: tweaks?.darkMode ? '#0F0318' : '#F4F1F9',
      padding: '40px 48px',
      fontFamily: 'Calibri, sans-serif',
      overflowY: 'auto'
    }}>
      {/* Header */}
      <div style={{ marginBottom: '36px' }}>
        <h1 style={{
          fontFamily: '"Arial Black", sans-serif',
          fontSize: '26px',
          fontWeight: '900',
          color: tweaks?.darkMode ? '#FFFFFF' : '#1A0530',
          margin: 0,
          letterSpacing: '-0.5px'
        }}>Generate a Deck</h1>
        <p style={{
          color: tweaks?.darkMode ? 'rgba(255,255,255,0.45)' : '#7A6B8A',
          fontSize: '15px',
          margin: '6px 0 0',
          fontFamily: 'Calibri, sans-serif'
        }}>Paste your notes or upload a document — we'll handle the rest.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '28px', alignItems: 'start' }}>
        {/* Left: Main input */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Text input */}
          <div style={{
            background: tweaks?.darkMode ? '#1E0635' : '#FFFFFF',
            borderRadius: '16px',
            border: `1.5px solid ${tweaks?.darkMode ? 'rgba(123,47,190,0.3)' : 'rgba(123,47,190,0.15)'}`,
            overflow: 'hidden',
            boxShadow: tweaks?.darkMode ? 'none' : '0 2px 16px rgba(45,10,78,0.06)'
          }}>
            <div style={{
              padding: '16px 20px 4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <span style={{
                fontSize: '12px',
                fontWeight: '700',
                letterSpacing: '1.2px',
                textTransform: 'uppercase',
                color: tweaks?.darkMode ? 'rgba(255,255,255,0.4)' : '#9080A0',
                fontFamily: 'Calibri, sans-serif'
              }}>Your Content</span>
              {charCount > 0 && (
                <span style={{ fontSize: '11px', color: '#9080A0', fontFamily: 'Calibri, sans-serif' }}>
                  {charCount.toLocaleString()} characters
                </span>
              )}
            </div>
            <textarea
              value={inputText}
              onChange={handleTextChange}
              placeholder="Paste your notes, meeting summary, bullet points, or any raw text here…&#10;&#10;AutoDeck AI will structure this into a polished Quidax presentation."
              style={{
                width: '100%',
                minHeight: '300px',
                border: 'none',
                outline: 'none',
                resize: 'vertical',
                padding: '12px 20px 20px',
                fontSize: '15px',
                fontFamily: 'Calibri, sans-serif',
                lineHeight: '1.65',
                color: tweaks?.darkMode ? 'rgba(255,255,255,0.85)' : '#1A0530',
                background: 'transparent',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* File Upload */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            style={{
              border: `2px dashed ${dragOver ? '#D946A8' : (tweaks?.darkMode ? 'rgba(123,47,190,0.35)' : 'rgba(123,47,190,0.25)')}`,
              borderRadius: '12px',
              padding: '22px',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              background: dragOver
                ? (tweaks?.darkMode ? 'rgba(217,70,168,0.08)' : 'rgba(217,70,168,0.04)')
                : (tweaks?.darkMode ? 'rgba(123,47,190,0.07)' : 'rgba(123,47,190,0.03)'),
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onClick={() => document.getElementById('fileInput').click()}
          >
            <input
              id="fileInput"
              type="file"
              accept=".pdf,.docx,.txt,.pptx"
              style={{ display: 'none' }}
              onChange={handleFileInput}
            />
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              background: uploadedFile ? 'rgba(217,70,168,0.15)' : (tweaks?.darkMode ? 'rgba(123,47,190,0.2)' : 'rgba(123,47,190,0.1)'),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              color: uploadedFile ? '#D946A8' : '#7B2FBE'
            }}>
              {uploadedFile ? (
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M4 10l4 4 8-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M10 13V7M7 10l3-3 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M5 16h10M3 13.5A4.5 4.5 0 017.5 9a5 5 0 019.5 1.5A3.5 3.5 0 0117 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              )}
            </div>
            <div>
              {uploadedFile ? (
                <>
                  <div style={{ fontWeight: '600', color: '#D946A8', fontSize: '14px' }}>{uploadedFile.name}</div>
                  <div style={{ fontSize: '12px', color: tweaks?.darkMode ? 'rgba(255,255,255,0.4)' : '#9080A0', marginTop: '2px' }}>
                    Click to replace
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontWeight: '600', color: tweaks?.darkMode ? 'rgba(255,255,255,0.7)' : '#4A3560', fontSize: '14px' }}>
                    Drag & drop a file, or <span style={{ color: '#7B2FBE' }}>browse</span>
                  </div>
                  <div style={{ fontSize: '12px', color: tweaks?.darkMode ? 'rgba(255,255,255,0.35)' : '#9080A0', marginTop: '2px' }}>
                    PDF, DOCX, TXT, or PPTX — up to 20 MB
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right: Config panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', position: 'sticky', top: '40px' }}>

          {/* Slide count */}
          <div style={{
            background: tweaks?.darkMode ? '#1E0635' : '#FFFFFF',
            borderRadius: '16px',
            border: `1.5px solid ${tweaks?.darkMode ? 'rgba(123,47,190,0.3)' : 'rgba(123,47,190,0.12)'}`,
            padding: '20px',
            boxShadow: tweaks?.darkMode ? 'none' : '0 2px 16px rgba(45,10,78,0.06)'
          }}>
            <div style={{
              fontSize: '12px',
              fontWeight: '700',
              letterSpacing: '1.2px',
              textTransform: 'uppercase',
              color: tweaks?.darkMode ? 'rgba(255,255,255,0.4)' : '#9080A0',
              marginBottom: '14px'
            }}>Slide Count</div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {slideOptions.map(opt => (
                <button
                  key={opt}
                  onClick={() => setSlideCount(opt)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: `1.5px solid ${slideCount === opt ? '#7B2FBE' : (tweaks?.darkMode ? 'rgba(255,255,255,0.1)' : '#E8E0F0')}`,
                    background: slideCount === opt ? '#7B2FBE' : 'transparent',
                    color: slideCount === opt ? '#FFFFFF' : (tweaks?.darkMode ? 'rgba(255,255,255,0.6)' : '#4A3560'),
                    fontSize: '14px',
                    fontFamily: 'Calibri, sans-serif',
                    fontWeight: slideCount === opt ? '700' : '500',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {/* Template style */}
          <div style={{
            background: tweaks?.darkMode ? '#1E0635' : '#FFFFFF',
            borderRadius: '16px',
            border: `1.5px solid ${tweaks?.darkMode ? 'rgba(123,47,190,0.3)' : 'rgba(123,47,190,0.12)'}`,
            padding: '20px',
            boxShadow: tweaks?.darkMode ? 'none' : '0 2px 16px rgba(45,10,78,0.06)'
          }}>
            <div style={{
              fontSize: '12px',
              fontWeight: '700',
              letterSpacing: '1.2px',
              textTransform: 'uppercase',
              color: tweaks?.darkMode ? 'rgba(255,255,255,0.4)' : '#9080A0',
              marginBottom: '14px'
            }}>Template Style</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {templates.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTemplateStyle(t.id)}
                  style={{
                    padding: '12px',
                    borderRadius: '10px',
                    border: `2px solid ${templateStyle === t.id ? t.accent : (tweaks?.darkMode ? 'rgba(255,255,255,0.08)' : '#EDE7F5')}`,
                    background: templateStyle === t.id
                      ? (tweaks?.darkMode ? `${t.accent}18` : `${t.accent}0F`)
                      : (tweaks?.darkMode ? 'rgba(255,255,255,0.03)' : '#FAFAFA'),
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}
                >
                  {t.preview}
                  <div>
                    <div style={{
                      fontSize: '13px',
                      fontWeight: '700',
                      color: templateStyle === t.id ? t.accent : (tweaks?.darkMode ? 'rgba(255,255,255,0.8)' : '#2D0A4E'),
                      fontFamily: 'Calibri, sans-serif'
                    }}>{t.label}</div>
                    <div style={{
                      fontSize: '11px',
                      color: tweaks?.darkMode ? 'rgba(255,255,255,0.35)' : '#9080A0',
                      marginTop: '2px',
                      fontFamily: 'Calibri, sans-serif'
                    }}>{t.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Generate button */}
          <button
            onClick={() => canGenerate && onGenerate({ inputText, slideCount, templateStyle, uploadedFile })}
            disabled={!canGenerate}
            style={{
              width: '100%',
              padding: '18px',
              borderRadius: '14px',
              border: 'none',
              background: canGenerate
                ? 'linear-gradient(135deg, #7B2FBE 0%, #D946A8 100%)'
                : (tweaks?.darkMode ? 'rgba(255,255,255,0.07)' : '#EDE7F5'),
              color: canGenerate ? '#FFFFFF' : (tweaks?.darkMode ? 'rgba(255,255,255,0.2)' : '#C0A8D8'),
              fontSize: '16px',
              fontFamily: '"Arial Black", sans-serif',
              fontWeight: '900',
              cursor: canGenerate ? 'pointer' : 'not-allowed',
              letterSpacing: '0.3px',
              transition: 'all 0.2s ease',
              boxShadow: canGenerate ? '0 6px 28px rgba(217,70,168,0.35)' : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              transform: 'translateY(0)',
            }}
            onMouseEnter={e => {
              if (canGenerate) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 10px 36px rgba(217,70,168,0.45)';
              }
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = canGenerate ? '0 6px 28px rgba(217,70,168,0.35)' : 'none';
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <polygon points="9,1 17,9 9,17 1,9" fill="none" stroke="currentColor" strokeWidth="1.5"/>
              <polygon points="9,4 14,9 9,14 4,9" fill="currentColor" opacity="0.7"/>
            </svg>
            Generate Deck
          </button>

          {!canGenerate && (
            <p style={{
              textAlign: 'center',
              fontSize: '12px',
              color: tweaks?.darkMode ? 'rgba(255,255,255,0.3)' : '#B0A0C0',
              margin: '-8px 0 0',
              fontFamily: 'Calibri, sans-serif'
            }}>
              Paste some text or upload a file to get started
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
*/
