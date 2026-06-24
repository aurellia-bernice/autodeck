// ============================================================
// SourceConflictScreen — shown when uploaded doc doesn't match
// the user's brief. Lets them re-upload, proceed anyway, or edit.
// ============================================================
const SourceConflictScreen = ({
  conflictData,   // { hasConflict, docSummary, briefSummary, missingItems, recommendations, sourceDocumentName }
  config,         // original generate config
  tweaks,
  isRechecking,   // true while parsing + re-checking a new file
  onProceed,      // (config) => void — proceed to generation
  onReupload,     // (file) => void — user picked a new file to replace the source
  onBack,         // () => void — return to home with input preserved
}) => {
  const T = qxTheme(tweaks?.darkMode);
  const [showUpload, setShowUpload] = React.useState(false);
  const [dragOver, setDragOver] = React.useState(false);

  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && !isRechecking) onReupload(file);
  };

  const handleFileInput = (e) => {
    const file = e.target.files[0];
    if (file && !isRechecking) onReupload(file);
    e.target.value = '';
  };

  const triggerUpload = () => {
    setShowUpload(true);
    document.getElementById('conflictFileReplace').click();
  };

  const doc = conflictData?.sourceDocumentName || 'uploaded file';
  const title = conflictData?.title || 'Source mismatch detected';
  const message = conflictData?.message || "The uploaded document doesn't appear to support what your brief is asking for. Generating from mismatched content risks producing inaccurate or unusable slides.";
  const uploadLabel = conflictData?.uploadLabel || 'Upload correct document';
  const dark = tweaks?.darkMode;

  return (
    <div style={{
      minHeight: '100vh', background: T.bg,
      fontFamily: qxType.body, color: T.ink, overflowY: 'auto',
    }}>

      {/* Top bar */}
      <div style={{
        padding: '16px 32px',
        borderBottom: `1px solid ${T.border}`,
        display: 'flex', alignItems: 'center', gap: 12,
        background: dark ? 'rgba(0,0,0,0.18)' : T.surface,
      }}>
        <button
          onClick={onBack}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 13px', borderRadius: qxRadius.sm,
            border: 'none', background: T.ghostBg, color: T.ink,
            fontFamily: qxType.body, fontSize: 13, fontWeight: 500,
            cursor: 'pointer', transition: `background 140ms ${qxEase}`,
          }}
          onMouseEnter={e => e.currentTarget.style.background = T.ghostHi}
          onMouseLeave={e => e.currentTarget.style.background = T.ghostBg}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back to edit
        </button>
        <div style={{ flex: 1 }} />
        <span style={{
          fontFamily: qxType.mono, fontSize: 10,
          letterSpacing: '0.20em', textTransform: 'uppercase', color: T.inkMute,
        }}>Source review</span>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 820, margin: '0 auto', padding: '52px 32px 96px' }}>

        {/* Loading state — while cloud function is running */}
        {!conflictData && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '80px 0 40px' }}>
            <svg width="30" height="30" viewBox="0 0 30 30" fill="none" style={{ animation: 'qxSpin 0.9s linear infinite' }}>
              <circle cx="15" cy="15" r="12" stroke={T.primary} strokeWidth="2.2" opacity="0.22"/>
              <path d="M15 3a12 12 0 0 1 12 12" stroke={T.primary} strokeWidth="2.2" strokeLinecap="round"/>
            </svg>
            <span style={{ fontFamily: qxType.body, fontSize: 14, color: T.inkDim }}>
              Analyzing source document…
            </span>
          </div>
        )}

        {/* Warning header */}
        {conflictData && <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18, marginBottom: 44 }}>
          <div style={{
            width: 48, height: 48, borderRadius: qxRadius.md, flexShrink: 0,
            background: dark ? 'rgba(245,166,35,0.15)' : '#FEF3C7',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <path d="M11 2L1 20h20L11 2Z" stroke="#F5A623" strokeWidth="1.8" strokeLinejoin="round"/>
              <line x1="11" y1="9" x2="11" y2="14" stroke="#F5A623" strokeWidth="1.8" strokeLinecap="round"/>
              <circle cx="11" cy="17" r="0.9" fill="#F5A623"/>
            </svg>
          </div>
          <div>
            <h1 style={{
              fontFamily: qxType.display, fontSize: 26, fontWeight: 600,
              letterSpacing: '-0.025em', margin: '0 0 10px', color: T.ink,
            }}>
              {title}
            </h1>
            <p style={{ fontSize: 15.5, lineHeight: 1.65, color: T.inkDim, margin: 0, maxWidth: 560 }}>
              {message}
            </p>
          </div>
        </div>}

        {/* Comparison grid + details — shown once conflict data arrives */}
        {conflictData && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 24 }}>
          <div style={{
            padding: '20px 22px', borderRadius: qxRadius.md,
            border: `1px solid ${T.primary}30`,
            background: dark ? `${T.primary}12` : `${T.primary}07`,
          }}>
            <div style={{
              fontFamily: qxType.mono, fontSize: 10, letterSpacing: '0.18em',
              textTransform: 'uppercase', color: T.primary, marginBottom: 10,
            }}>You requested</div>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: T.ink, margin: 0 }}>
              {conflictData?.briefSummary || String(config?.inputText || '').slice(0, 200)}
            </p>
          </div>

          <div style={{
            padding: '20px 22px', borderRadius: qxRadius.md,
            border: `1px solid ${T.borderHi}`,
            background: dark ? T.surfaceHi : '#F9F7FC',
          }}>
            <div style={{
              fontFamily: qxType.mono, fontSize: 10, letterSpacing: '0.18em',
              textTransform: 'uppercase', color: T.inkMute, marginBottom: 10,
            }}>
              {conflictData?.issueType === 'insufficient_context' ? 'Available source' : `"${doc}" contains`}
            </div>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: T.ink, margin: 0 }}>
              {conflictData?.docSummary || 'Content unrelated to the requested brief.'}
            </p>
          </div>
        </div>}

        {/* Missing items */}
        {conflictData?.missingItems?.length > 0 && (
          <div style={{
            marginBottom: 24, padding: '20px 22px', borderRadius: qxRadius.md,
            border: `1px solid ${T.border}`, background: T.surface,
          }}>
            <div style={{
              fontFamily: qxType.mono, fontSize: 10, letterSpacing: '0.18em',
              textTransform: 'uppercase', color: T.inkMute, marginBottom: 14,
            }}>Missing from this document</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {conflictData.missingItems.map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14, color: T.ink }}>
                  <span style={{ color: QX.bad, fontWeight: 700, flexShrink: 0, lineHeight: '22px' }}>✕</span>
                  <span style={{ lineHeight: 1.5 }}>{item}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommendations */}
        {conflictData?.recommendations?.length > 0 && (
          <div style={{
            marginBottom: 44, padding: '20px 22px', borderRadius: qxRadius.md,
            border: `1px solid ${dark ? 'rgba(212,255,63,0.20)' : 'rgba(212,255,63,0.50)'}`,
            background: dark ? 'rgba(212,255,63,0.06)' : 'rgba(212,255,63,0.08)',
          }}>
            <div style={{
              fontFamily: qxType.mono, fontSize: 10, letterSpacing: '0.18em',
              textTransform: 'uppercase', color: dark ? '#a8d400' : '#4a6800', marginBottom: 14,
            }}>What would help</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {conflictData.recommendations.map((rec, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14, color: T.ink }}>
                  <span style={{ color: dark ? '#a8d400' : '#4a6800', fontWeight: 600, flexShrink: 0, lineHeight: '22px' }}>→</span>
                  <span style={{ lineHeight: 1.5 }}>{rec}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Re-upload zone — visible when shown */}
        {showUpload && (
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => !isRechecking && document.getElementById('conflictFileReplace').click()}
            style={{
              marginBottom: 36, padding: '36px 28px',
              borderRadius: qxRadius.lg,
              border: `2px dashed ${dragOver ? T.primary : T.borderHi}`,
              background: dragOver ? `${T.primary}08` : T.surface,
              textAlign: 'center',
              cursor: isRechecking ? 'default' : 'pointer',
              transition: `all 200ms ${qxEase}`,
            }}
          >
            {isRechecking ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none" style={{ animation: 'qxSpin 0.9s linear infinite' }}>
                  <circle cx="11" cy="11" r="9" stroke={T.primary} strokeWidth="2" opacity="0.25"/>
                  <path d="M11 2a9 9 0 0 1 9 9" stroke={T.primary} strokeWidth="2" strokeLinecap="round"/>
                </svg>
                <span style={{ fontSize: 14, color: T.inkDim }}>Parsing and checking new file…</span>
              </div>
            ) : (
              <>
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none" style={{ marginBottom: 10, opacity: 0.45 }}>
                  <path d="M18 2H6v24h16V6L18 2Z" stroke={T.ink} strokeWidth="1.5" strokeLinejoin="round"/>
                  <path d="M18 2v4h4" stroke={T.ink} strokeWidth="1.5"/>
                  <path d="M14 12v8M11 15l3-3 3 3" stroke={T.ink} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <div style={{ fontSize: 15, fontWeight: 500, color: T.ink, marginBottom: 4 }}>
                  Drop your document here, or click to browse
                </div>
                <div style={{ fontSize: 13, color: T.inkMute }}>PDF, DOCX, PPTX, or TXT · max 20MB</div>
              </>
            )}
          </div>
        )}
        <input
          id="conflictFileReplace"
          type="file"
          accept=".pdf,.docx,.txt,.pptx"
          style={{ display: 'none' }}
          onChange={handleFileInput}
        />

        {/* Action buttons */}
        {conflictData && <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center',
          paddingTop: 36, borderTop: `1px solid ${T.border}`,
        }}>
          {/* Primary: upload correct doc */}
          <button
            onClick={triggerUpload}
            disabled={isRechecking}
            style={{
              padding: '15px 26px', borderRadius: qxRadius.full,
              border: `1.5px solid ${T.primary}`,
              background: 'transparent', color: T.primary,
              fontFamily: qxType.body, fontSize: 14.5, fontWeight: 600,
              cursor: isRechecking ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 9,
              transition: `all 160ms ${qxEase}`,
              opacity: isRechecking ? 0.5 : 1,
            }}
            onMouseEnter={e => { if (!isRechecking) { e.currentTarget.style.background = `${T.primary}10`; } }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <path d="M13 10v2a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              <path d="M7.5 1v8M4.5 4l3-3 3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {uploadLabel}
          </button>

          {/* Secondary: proceed anyway */}
          <button
            onClick={() => onProceed({ ...config, conflictAcknowledged: true })}
            disabled={isRechecking}
            style={{
              padding: '15px 26px', borderRadius: qxRadius.full,
              border: `1px solid ${T.border}`,
              background: T.surface, color: T.ink,
              fontFamily: qxType.body, fontSize: 14.5, fontWeight: 500,
              cursor: isRechecking ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 9,
              transition: `all 160ms ${qxEase}`,
              opacity: isRechecking ? 0.5 : 1,
            }}
            onMouseEnter={e => { if (!isRechecking) e.currentTarget.style.background = T.surfaceHi; }}
            onMouseLeave={e => { e.currentTarget.style.background = T.surface; }}
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <path d="M3 7.5h9M9 4.5l3 3-3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Proceed with available info
          </button>

          {/* Ghost: back to edit */}
          <button
            onClick={onBack}
            style={{
              padding: '15px 18px', borderRadius: qxRadius.full,
              border: 'none', background: 'transparent', color: T.inkMute,
              fontFamily: qxType.body, fontSize: 14,
              cursor: 'pointer', transition: `color 140ms ${qxEase}`,
            }}
            onMouseEnter={e => e.currentTarget.style.color = T.ink}
            onMouseLeave={e => e.currentTarget.style.color = T.inkMute}
          >
            ← Edit brief
          </button>
        </div>}
      </div>

      <style>{`@keyframes qxSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

Object.assign(window, { SourceConflictScreen });
