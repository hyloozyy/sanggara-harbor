// Font stacks for canvas text (the CSS side lives in css/fonts.css). The faces are local files;
// loadFonts() asks the browser to load them up front so canvases never draw in a fallback.
export const FONT = {
  display: "'Bebas Neue', 'Barlow Condensed', Impact, sans-serif",
  ui: "'Barlow', 'Segoe UI', Arial, sans-serif",
  cond: "'Barlow Condensed', 'Barlow', 'Arial Narrow', sans-serif",
  num: "'Saira Stencil One', 'Barlow Condensed', Impact, sans-serif",
};

export function loadFonts() {
  if (!document.fonts?.load) return Promise.resolve();
  const faces = ['40px "Bebas Neue"', '16px "Barlow"', 'italic 16px "Barlow"', '600 16px "Barlow"', 'italic 600 16px "Barlow"', '700 16px "Barlow"',
    '600 16px "Barlow Condensed"', '700 16px "Barlow Condensed"', '16px "Saira Stencil One"'];
  return Promise.all(faces.map((f) => document.fonts.load(f).catch(() => null))).then(() => null);
}
