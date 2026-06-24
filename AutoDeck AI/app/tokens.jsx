// ============================================================
// QUIDAX DESIGN TOKENS — aligned to design system V1.0 (2026-06-19)
// ============================================================
// Source of truth: design.md + tokens.json (Figma Token-system file)
// DESIGN GAPS (pending design owner review):
//   • QX.lime / CTA accent — no Button/accent token yet; using Lemon/500 (#D5F953)
//   • qxShadow — no system shadow tokens defined yet; keeping product values
//   • Uncut Sans — not on Google Fonts; falls back to Inter until self-hosted

const QX = {
  // Official Colours/Brand ramp
  purple: {
    50:  '#F1E9FF',   // Brand/50
    100: '#DECBFF',   // Brand/100
    200: '#CBADFF',   // Brand/200
    300: '#B890FE',   // Brand/300
    400: '#8D48D1',   // Brand/400
    500: '#6100A5',   // Brand/500
    600: '#540096',   // Brand/600
    700: '#480086',   // Brand/700
    800: '#3C0076',   // Brand/800
    900: '#320067',   // Brand/900
    950: '#280058',   // Brand/950
  },
  // Accent — Lemon/500 (closest system value to previous #D4FF3F)
  // DESIGN GAP: no Button/accent token exists yet — use sparingly, one per screen
  lime:    '#D5F953',
  limeInk: '#232126',  // Text/uniform = Neutral/975

  // Semantic feedback colors
  ok:   '#04C786',   // Green/700  = Border/success
  warn: '#FAC83D',   // Yellow/500 = Text/warning
  bad:  '#BC3B23',   // Red/800    = Text/danger
};

// theme objects — call qxTheme(dark) to get the active set
const qxTheme = (dark) => dark ? ({
  // ── Dark mode ── purple-atmospheric base (DESIGN GAP: system bg dark = #17151B has no purple equivalent)
  bg:        '#0F031F',
  bgElev:    '#170729',
  surface:   '#1E0B36',
  surfaceHi: '#291149',
  border:    '#36343A',
  borderHi:  '#59585C',
  ink:       '#FFFFFF',
  inkDim:    '#CDCDCE',
  inkMute:   '#ACABAE',
  inkFaint:  '#59585C',
  primary:   '#B890FE',      // Button/primary dark
  primaryHover: '#CBADFF',   // Button/primary-hover dark
  ghostBg:   'rgba(184,144,254,0.10)',
  ghostHi:   'rgba(184,144,254,0.16)',
  scrim:     'rgba(23,21,27,0.7)',
  // ambient blobs
  blob1:     'rgba(141,72,209,0.25)',
  blob2:     'rgba(184,144,254,0.08)',
}) : ({
  // ── Light mode ── Brand/25 tint (system value, closest to warm off-white)
  bg:        '#FAF7FF',
  bgElev:    '#FFFFFF',
  surface:   '#FFFFFF',
  surfaceHi: '#F4F4F4',
  border:    '#E6E6E7',
  borderHi:  '#BDBCBE',
  ink:       '#232126',
  inkDim:    '#4A484D',
  inkMute:   '#6A696C',
  inkFaint:  '#BDBCBE',
  primary:   '#540096',      // Button/primary light
  primaryHover: '#480086',   // Button/primary-hover light
  ghostBg:   'rgba(97,0,165,0.06)',
  ghostHi:   'rgba(97,0,165,0.10)',
  scrim:     'rgba(23,21,27,0.5)',
  // ambient blobs
  blob1:     'rgba(97,0,165,0.10)',
  blob2:     'rgba(184,144,254,0.20)',
});

// type system — Uncut Sans only per design system (Inter as web fallback until self-hosted)
const qxType = {
  display: '"Uncut Sans", "Inter", system-ui, sans-serif',
  body:    '"Uncut Sans", "Inter", system-ui, sans-serif',
  mono:    '"JetBrains Mono", "SF Mono", Menlo, monospace',
};

// motion
const qxEase = 'cubic-bezier(0.22, 1, 0.36, 1)';

// shape — aligned to Radius/* tokens
const qxRadius = {
  xs: 4,    // radius-xsmall
  sm: 8,    // radius-small
  md: 12,   // radius-medium
  lg: 16,   // radius-large
  xl: 24,   // radius-xlarge
  full: 999, // radius-full
};

// shadow — no system tokens defined yet; product values retained
const qxShadow = (dark) => dark ? ({
  sm:  '0 1px 2px rgba(0,0,0,0.4)',
  md:  '0 4px 16px rgba(0,0,0,0.32)',
  lg:  '0 12px 40px rgba(0,0,0,0.48)',
  ring:'0 0 0 1px rgba(184,144,254,0.16)',
}) : ({
  sm:  '0 1px 2px rgba(23,21,27,0.04)',
  md:  '0 2px 12px rgba(23,21,27,0.06)',
  lg:  '0 12px 40px rgba(23,21,27,0.10)',
  ring:'0 0 0 1px rgba(23,21,27,0.04)',
});

Object.assign(window, { QX, qxTheme, qxType, qxEase, qxRadius, qxShadow });
