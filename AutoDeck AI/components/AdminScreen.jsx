
// Admin Panel Screen
const AdminScreen = ({ tweaks }) => {
  const [activeTab, setActiveTab] = React.useState('brand');
  const [colors, setColors] = React.useState({
    primary: '#2D0A4E',
    secondary: '#7B2FBE',
    accent1: '#D946A8',
    accent2: '#F5A623',
    bgDark: '#1A0530',
    bgLight: '#F5F5F5',
  });
  const [savedColors, setSavedColors] = React.useState(false);
  const [activeTemplate, setActiveTemplate] = React.useState('Quidax Master v3.pptx');
  const [logoUploaded, setLogoUploaded] = React.useState(false);
  const [templateUploaded, setTemplateUploaded] = React.useState(false);
  const [brandVoice, setBrandVoice] = React.useState('professional');

  const bg = tweaks?.darkMode ? '#0F0318' : '#F4F1F9';
  const cardBg = tweaks?.darkMode ? '#1E0635' : '#FFFFFF';
  const textColor = tweaks?.darkMode ? '#FFFFFF' : '#1A0530';
  const subColor = tweaks?.darkMode ? 'rgba(255,255,255,0.45)' : '#7A6B8A';
  const borderColor = tweaks?.darkMode ? 'rgba(123,47,190,0.25)' : 'rgba(123,47,190,0.12)';

  const tabs = [
    { id: 'brand', label: 'Brand Colours' },
    { id: 'typography', label: 'Typography' },
    { id: 'templates', label: 'Templates' },
    { id: 'voice', label: 'Brand Voice' },
  ];

  const colorRows = [
    { key: 'primary', label: 'Primary — Deep Purple', role: 'Sidebar, headers, key UI' },
    { key: 'secondary', label: 'Secondary — Vibrant Purple', role: 'Interactive elements, links' },
    { key: 'accent1', label: 'Accent — Magenta Pink', role: 'CTAs, active states, highlights' },
    { key: 'accent2', label: 'Accent — Gold', role: 'Warm highlights, Corporate template' },
    { key: 'bgDark', label: 'Background — Dark', role: 'Dark mode canvas, slide backgrounds' },
    { key: 'bgLight', label: 'Background — Light', role: 'Light mode canvas, card backgrounds' },
  ];

  const Card = ({ children, style = {} }) => (
    <div style={{
      background: cardBg,
      borderRadius: '16px',
      border: `1.5px solid ${borderColor}`,
      padding: '28px',
      boxShadow: tweaks?.darkMode ? 'none' : '0 2px 16px rgba(45,10,78,0.06)',
      ...style
    }}>{children}</div>
  );

  const SectionLabel = ({ children }) => (
    <div style={{
      fontSize: '12px',
      fontWeight: '700',
      letterSpacing: '1.2px',
      textTransform: 'uppercase',
      color: tweaks?.darkMode ? 'rgba(255,255,255,0.4)' : '#9080A0',
      marginBottom: '16px',
      fontFamily: 'Calibri, sans-serif'
    }}>{children}</div>
  );

  return (
    <div style={{
      minHeight: '100vh',
      background: bg,
      padding: '40px 48px',
      fontFamily: 'Calibri, sans-serif',
      overflowY: 'auto'
    }}>
      {/* Header */}
      <div style={{ marginBottom: '28px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <div style={{
              padding: '3px 10px',
              borderRadius: '20px',
              background: 'rgba(245,166,35,0.15)',
              border: '1px solid rgba(245,166,35,0.3)',
              color: '#F5A623',
              fontSize: '11px',
              fontWeight: '700',
              letterSpacing: '1px',
              textTransform: 'uppercase'
            }}>Design Team Only</div>
          </div>
          <h1 style={{
            fontFamily: '"Arial Black", sans-serif',
            fontSize: '26px',
            fontWeight: '900',
            color: textColor,
            margin: '0 0 6px',
            letterSpacing: '-0.5px'
          }}>Brand Admin</h1>
          <p style={{ color: subColor, fontSize: '15px', margin: 0 }}>
            Manage Quidax brand configuration and slide templates
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: '4px',
        marginBottom: '28px',
        background: tweaks?.darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(123,47,190,0.06)',
        borderRadius: '12px',
        padding: '4px',
        width: 'fit-content'
      }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              padding: '10px 20px',
              borderRadius: '9px',
              border: 'none',
              background: activeTab === t.id ? (tweaks?.darkMode ? '#2D0A4E' : '#FFFFFF') : 'transparent',
              color: activeTab === t.id ? (tweaks?.darkMode ? '#D946A8' : '#7B2FBE') : subColor,
              fontSize: '14px',
              fontFamily: 'Calibri, sans-serif',
              fontWeight: activeTab === t.id ? '700' : '500',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: activeTab === t.id ? '0 2px 8px rgba(0,0,0,0.08)' : 'none'
            }}
          >{t.label}</button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'brand' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <Card>
            <SectionLabel>Colour Palette</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {colorRows.map(row => (
                <div key={row.key} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  padding: '14px 0',
                  borderBottom: `1px solid ${tweaks?.darkMode ? 'rgba(255,255,255,0.05)' : '#F0EAF8'}`
                }}>
                  {/* Swatch + input */}
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <div style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '10px',
                      background: colors[row.key],
                      border: `2px solid ${tweaks?.darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                      cursor: 'pointer',
                      overflow: 'hidden'
                    }}>
                      <input
                        type="color"
                        value={colors[row.key]}
                        onChange={e => setColors(prev => ({ ...prev, [row.key]: e.target.value }))}
                        style={{
                          width: '200%',
                          height: '200%',
                          margin: '-50%',
                          cursor: 'pointer',
                          border: 'none',
                          opacity: 0,
                          position: 'absolute',
                          top: 0,
                          left: 0
                        }}
                      />
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: textColor, marginBottom: '2px' }}>{row.label}</div>
                    <div style={{ fontSize: '12px', color: subColor }}>{row.role}</div>
                  </div>
                  <div style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    background: tweaks?.darkMode ? 'rgba(255,255,255,0.06)' : '#F5F0FB',
                    border: `1px solid ${borderColor}`,
                    fontFamily: 'monospace',
                    fontSize: '13px',
                    color: textColor,
                    letterSpacing: '0.5px'
                  }}>
                    {colors[row.key].toUpperCase()}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              {savedColors && (
                <span style={{ fontSize: '13px', color: '#3DB870', alignSelf: 'center' }}>✓ Saved</span>
              )}
              <button
                onClick={() => { setSavedColors(true); setTimeout(() => setSavedColors(false), 2500); }}
                style={{
                  padding: '11px 22px',
                  borderRadius: '10px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #7B2FBE, #D946A8)',
                  color: '#fff',
                  fontSize: '14px',
                  fontFamily: 'Calibri, sans-serif',
                  fontWeight: '700',
                  cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(217,70,168,0.25)'
                }}
              >Save Colours</button>
            </div>
          </Card>

          {/* Logo upload */}
          <Card>
            <SectionLabel>Logo</SectionLabel>
            <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
              <div style={{
                width: '120px',
                height: '60px',
                borderRadius: '10px',
                background: '#2D0A4E',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                border: `1.5px solid ${borderColor}`
              }}>
                {logoUploaded ? (
                  <span style={{ color: '#D946A8', fontSize: '12px', fontWeight: '700' }}>NEW LOGO</span>
                ) : (
                  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                    <polygon points="14,2 26,8 26,20 14,26 2,20 2,8" fill="none" stroke="#D946A8" strokeWidth="1.5"/>
                    <polygon points="14,2 26,8 14,14 2,8" fill="#7B2FBE" opacity="0.8"/>
                    <polygon points="14,14 26,8 26,20 14,26" fill="#D946A8" opacity="0.5"/>
                    <polygon points="14,14 14,26 2,20 2,8" fill="#7B2FBE" opacity="0.5"/>
                  </svg>
                )}
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: textColor, marginBottom: '4px' }}>
                  {logoUploaded ? 'Logo updated' : 'Quidax Logo (current)'}
                </div>
                <div style={{ fontSize: '12px', color: subColor, marginBottom: '12px' }}>
                  PNG or SVG · Transparent background · Min 400px wide
                </div>
                <button
                  onClick={() => setLogoUploaded(true)}
                  style={{
                    padding: '9px 18px',
                    borderRadius: '8px',
                    border: `1.5px solid ${borderColor}`,
                    background: 'transparent',
                    color: '#7B2FBE',
                    fontSize: '13px',
                    fontFamily: 'Calibri, sans-serif',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  {logoUploaded ? 'Replace Logo' : 'Upload New Logo'}
                </button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'typography' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <Card>
            <SectionLabel>Heading Font</SectionLabel>
            <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
              <div style={{
                flex: 1,
                padding: '24px',
                background: tweaks?.darkMode ? 'rgba(123,47,190,0.1)' : '#F5F0FB',
                borderRadius: '12px',
                border: `1.5px solid ${borderColor}`
              }}>
                <div style={{
                  fontFamily: '"Arial Black", sans-serif',
                  fontSize: '36px',
                  fontWeight: '900',
                  color: textColor,
                  letterSpacing: '-1px',
                  lineHeight: 1.1,
                  marginBottom: '8px'
                }}>Mabry Pro</div>
                <div style={{
                  fontFamily: '"Arial Black", sans-serif',
                  fontSize: '18px',
                  color: subColor,
                  fontWeight: '400'
                }}>The quick brown fox jumps</div>
              </div>
              <div style={{ width: '200px' }}>
                <div style={{ fontSize: '13px', color: subColor, marginBottom: '8px' }}>Fallback stack</div>
                <div style={{
                  padding: '12px 14px',
                  borderRadius: '8px',
                  background: tweaks?.darkMode ? 'rgba(255,255,255,0.05)' : '#F5F5F5',
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  color: textColor,
                  lineHeight: 1.6
                }}>
                  "Mabry Pro",<br/>
                  "Arial Black",<br/>
                  sans-serif
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <SectionLabel>Body Font</SectionLabel>
            <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
              <div style={{
                flex: 1,
                padding: '24px',
                background: tweaks?.darkMode ? 'rgba(123,47,190,0.1)' : '#F5F0FB',
                borderRadius: '12px',
                border: `1.5px solid ${borderColor}`
              }}>
                <div style={{
                  fontFamily: 'Calibri, "Segoe UI", sans-serif',
                  fontSize: '28px',
                  fontWeight: '400',
                  color: textColor,
                  marginBottom: '8px'
                }}>Mabry Pro Regular</div>
                <div style={{
                  fontFamily: 'Calibri, "Segoe UI", sans-serif',
                  fontSize: '15px',
                  color: subColor,
                  lineHeight: 1.65
                }}>
                  AutoDeck AI generates professional branded<br/>
                  presentations in seconds. Clean, readable, bold.
                </div>
              </div>
              <div style={{ width: '200px' }}>
                <div style={{ fontSize: '13px', color: subColor, marginBottom: '8px' }}>Fallback stack</div>
                <div style={{
                  padding: '12px 14px',
                  borderRadius: '8px',
                  background: tweaks?.darkMode ? 'rgba(255,255,255,0.05)' : '#F5F5F5',
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  color: textColor,
                  lineHeight: 1.6
                }}>
                  "Mabry Pro",<br/>
                  "Calibri",<br/>
                  "Segoe UI",<br/>
                  sans-serif
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'templates' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <Card>
            <SectionLabel>Active Master Template</SectionLabel>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '20px',
              padding: '20px',
              background: tweaks?.darkMode ? 'rgba(217,70,168,0.08)' : 'rgba(217,70,168,0.05)',
              borderRadius: '12px',
              border: '1.5px solid rgba(217,70,168,0.2)',
              marginBottom: '20px'
            }}>
              <div style={{
                width: '52px',
                height: '52px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #7B2FBE, #D946A8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                  <rect x="3" y="3" width="16" height="16" rx="2" stroke="white" strokeWidth="1.5"/>
                  <path d="M3 8h16M8 8v12" stroke="white" strokeWidth="1.5"/>
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '15px', fontWeight: '700', color: textColor, marginBottom: '3px' }}>
                  {activeTemplate}
                </div>
                <div style={{ fontSize: '12px', color: subColor }}>
                  Uploaded 12 Apr 2026 · 4 layouts · All templates use this master
                </div>
              </div>
              <div style={{
                padding: '5px 12px',
                borderRadius: '20px',
                background: 'rgba(80,200,120,0.15)',
                border: '1px solid rgba(80,200,120,0.3)',
                color: '#3DB870',
                fontSize: '12px',
                fontWeight: '700'
              }}>Active</div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => { setTemplateUploaded(true); setActiveTemplate('Quidax Master v4.pptx'); }}
                style={{
                  padding: '11px 20px',
                  borderRadius: '10px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #7B2FBE, #D946A8)',
                  color: '#fff',
                  fontSize: '14px',
                  fontFamily: 'Calibri, sans-serif',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '7px',
                  boxShadow: '0 4px 16px rgba(217,70,168,0.25)'
                }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M7 11V3M4 6l3-3 3 3M2 11h10" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Upload New Template
              </button>
              <button
                style={{
                  padding: '11px 20px',
                  borderRadius: '10px',
                  border: `1.5px solid ${borderColor}`,
                  background: 'transparent',
                  color: subColor,
                  fontSize: '14px',
                  fontFamily: 'Calibri, sans-serif',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >Remove</button>
            </div>
            {templateUploaded && (
              <div style={{
                marginTop: '16px',
                padding: '12px 16px',
                borderRadius: '8px',
                background: 'rgba(80,200,120,0.1)',
                border: '1px solid rgba(80,200,120,0.25)',
                color: '#3DB870',
                fontSize: '13px',
                fontFamily: 'Calibri, sans-serif'
              }}>
                ✓ New template uploaded and set as active. All new decks will use this master.
              </div>
            )}
          </Card>
        </div>
      )}

      {activeTab === 'voice' && (
        <Card>
          <SectionLabel>Brand Voice & AI Persona</SectionLabel>
          <p style={{ color: subColor, fontSize: '14px', margin: '0 0 24px', lineHeight: 1.6 }}>
            These settings shape how AutoDeck AI writes slide content — headlines, bullets, summaries.
            Choose a tone that matches Quidax's communication style.
          </p>
          {[
            { id: 'professional', label: 'Professional', desc: 'Clear, confident, business-appropriate. No jargon.' },
            { id: 'bold', label: 'Bold & Direct', desc: 'Punchy, assertive, energetic. Short sentences. Big impact.' },
            { id: 'approachable', label: 'Approachable', desc: 'Warm and conversational. Human-first language.' },
            { id: 'data', label: 'Data-Led', desc: 'Numbers front and centre. Evidence-based. Precise.' },
          ].map(v => (
            <div
              key={v.id}
              onClick={() => setBrandVoice(v.id)}
              style={{
                padding: '18px',
                borderRadius: '12px',
                border: `2px solid ${brandVoice === v.id ? '#7B2FBE' : borderColor}`,
                background: brandVoice === v.id ? (tweaks?.darkMode ? 'rgba(123,47,190,0.12)' : 'rgba(123,47,190,0.06)') : 'transparent',
                marginBottom: '10px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                border: `2px solid ${brandVoice === v.id ? '#7B2FBE' : borderColor}`,
                background: brandVoice === v.id ? '#7B2FBE' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                {brandVoice === v.id && (
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#fff' }} />
                )}
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '700', color: textColor, marginBottom: '3px' }}>{v.label}</div>
                <div style={{ fontSize: '13px', color: subColor }}>{v.desc}</div>
              </div>
            </div>
          ))}
          <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              style={{
                padding: '11px 22px',
                borderRadius: '10px',
                border: 'none',
                background: 'linear-gradient(135deg, #7B2FBE, #D946A8)',
                color: '#fff',
                fontSize: '14px',
                fontFamily: 'Calibri, sans-serif',
                fontWeight: '700',
                cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(217,70,168,0.25)'
              }}
            >Save Voice Settings</button>
          </div>
        </Card>
      )}
    </div>
  );
};

Object.assign(window, { AdminScreen });
