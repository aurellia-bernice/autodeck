// ============================================================
// QUIDAX DESIGN TOKENS — quieter brand-aligned system
// ============================================================
// Core palette: deep purple primary, lime accent reserved for THE
// single most important CTA on a screen. Everything else is purple
// ghost / outline / surface.

const QX = {
  // brand
  purple: {
    50:  '#F6F1FB',
    100: '#EDE3F7',
    200: '#D9C2EE',
    300: '#B891DC',
    400: '#9461C7',
    500: '#7A3FB0',   // primary purple
    600: '#5F2A91',
    700: '#451B6E',
    800: '#2D0F4E',
    900: '#1A0530',
    950: '#0F031F',
  },
  // accent — used SPARINGLY (one per screen)
  lime: '#D4FF3F',
  limeInk: '#1A0530',  // text color on lime

  // semantic
  ok:    '#34C77B',
  warn:  '#F5A623',
  bad:   '#E03E6B',
};

// theme objects — call qxTheme(dark) to get the active set
const qxTheme = (dark) => dark ? ({
  bg:        '#0F031F',
  bgElev:    '#170729',
  surface:   '#1E0B36',
  surfaceHi: '#291149',
  border:    'rgba(184,145,220,0.14)',
  borderHi:  'rgba(184,145,220,0.28)',
  ink:       '#F6F1FB',
  inkDim:    'rgba(246,241,251,0.66)',
  inkMute:   'rgba(246,241,251,0.40)',
  inkFaint:  'rgba(246,241,251,0.22)',
  primary:   '#B891DC',   // brighter on dark
  primaryHover: '#D9C2EE',
  ghostBg:   'rgba(184,145,220,0.10)',
  ghostHi:   'rgba(184,145,220,0.16)',
  scrim:     'rgba(15,3,31,0.72)',
  // ambient blob
  blob1:     'rgba(122,63,176,0.30)',
  blob2:     'rgba(217,194,238,0.10)',
}) : ({
  bg:        '#FAF8FC',
  bgElev:    '#FFFFFF',
  surface:   '#FFFFFF',
  surfaceHi: '#F6F1FB',
  border:    'rgba(45,15,78,0.08)',
  borderHi:  'rgba(45,15,78,0.16)',
  ink:       '#1A0530',
  inkDim:    '#5A4B6E',
  inkMute:   '#8A7B9E',
  inkFaint:  '#B8AAC8',
  primary:   '#5F2A91',
  primaryHover: '#451B6E',
  ghostBg:   'rgba(95,42,145,0.06)',
  ghostHi:   'rgba(95,42,145,0.10)',
  scrim:     'rgba(26,5,48,0.40)',
  blob1:     'rgba(122,63,176,0.10)',
  blob2:     'rgba(217,194,238,0.50)',
});

// type system — Space Grotesk display, Inter UI/body, JetBrains Mono for hints
const qxType = {
  display: '"Space Grotesk", "Inter", system-ui, sans-serif',
  body:    '"Inter", system-ui, sans-serif',
  mono:    '"JetBrains Mono", "SF Mono", Menlo, monospace',
};

// motion
const qxEase = 'cubic-bezier(0.22, 1, 0.36, 1)';

// shape
const qxRadius = {
  xs: 6, sm: 8, md: 12, lg: 16, xl: 20, full: 999,
};

// shadow — subtle, never dramatic
const qxShadow = (dark) => dark ? ({
  sm:  '0 1px 2px rgba(0,0,0,0.4)',
  md:  '0 4px 16px rgba(0,0,0,0.32)',
  lg:  '0 12px 40px rgba(0,0,0,0.48)',
  ring:'0 0 0 1px rgba(184,145,220,0.16)',
}) : ({
  sm:  '0 1px 2px rgba(45,15,78,0.04)',
  md:  '0 2px 12px rgba(45,15,78,0.06)',
  lg:  '0 12px 40px rgba(45,15,78,0.10)',
  ring:'0 0 0 1px rgba(45,15,78,0.04)',
});

Object.assign(window, { QX, qxTheme, qxType, qxEase, qxRadius, qxShadow });
