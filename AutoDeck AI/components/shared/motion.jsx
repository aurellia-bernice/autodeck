// ============================================================
// Motion utilities — fadeUp, stagger, page transitions
// ============================================================
const qxMotion = {
  fadeUp: (delay = 0) => ({
    animation: `qxFadeUp 600ms ${qxEase} ${delay}ms both`,
  }),
  fadeIn: (delay = 0) => ({
    animation: `qxFadeIn 500ms ${qxEase} ${delay}ms both`,
  }),
  scaleIn: (delay = 0) => ({
    animation: `qxScaleIn 600ms ${qxEase} ${delay}ms both`,
  }),
  slideRight: (delay = 0) => ({
    animation: `qxSlideRight 700ms ${qxEase} ${delay}ms both`,
  }),
};

// Inject keyframes once
if (!document.getElementById('qx-motion-styles')) {
  const s = document.createElement('style');
  s.id = 'qx-motion-styles';
  s.textContent = `
    @keyframes qxFadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes qxFadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes qxScaleIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
    @keyframes qxSlideRight { from { opacity: 0; transform: translateX(-24px); } to { opacity: 1; transform: translateX(0); } }
    @keyframes qxMarquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
    @keyframes qxBreathe { 0%,100% { transform: scale(1); opacity: 0.85; } 50% { transform: scale(1.04); opacity: 1; } }
    @keyframes qxShimmer { from { background-position: -200% 0; } to { background-position: 200% 0; } }
    @keyframes qxFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
  `;
  document.head.appendChild(s);
}

Object.assign(window, { qxMotion });
