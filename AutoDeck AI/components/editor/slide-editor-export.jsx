// Pure export helpers for SlideGenerator.

const AutoDeckSlideEditorExport = (() => {
  const toHex = (value, fallback = 'FFFFFF') => {
    const longHex = String(value || '').match(/#([0-9a-f]{6})/i)?.[1];
    return (longHex || fallback).replace('#', '').toUpperCase();
  };

  const pptBox = (obj) => ({
    x: (obj.x / 100) * 13.333,
    y: (obj.y / 56.25) * 7.5,
    w: (obj.w / 100) * 13.333,
    h: (obj.h / 56.25) * 7.5,
  });

  return {
    pptBox,
    toHex,
  };
})();

window.AutoDeckSlideEditorExport = AutoDeckSlideEditorExport;
