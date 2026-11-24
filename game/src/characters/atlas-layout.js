// Where each body part samples its colours in a character's 512×512 texture atlas. Every
// person gets one atlas (painted from their seed) and one skinned mesh, so a whole human is
// two draw calls: matte (skin, cloth, hair) and glossy (eyes, lenses, visors, leather).
export const ATLAS_SIZE = 512;

// Rectangles in pixels: [x, y, w, h] (y down, as on the canvas).
export const REGIONS = {
  head: [0, 0, 256, 256],      // face, scalp and ears
  torso: [256, 0, 256, 256],   // shirt / dress body, neck skin above the neckline
  arm: [0, 256, 128, 256],     // sleeve then skin down to the wrist
  leg: [128, 256, 128, 256],   // trousers / shorts / skirt-legs then skin
  skin: [256, 256, 64, 64],    // hands, nose, ears, eyelids
  shoe: [320, 256, 64, 64],
  hair: [384, 256, 64, 64],
  eye: [448, 256, 64, 64],
  outer: [256, 320, 128, 192], // jackets, vests, skirts, scarves, aprons
  hat: [384, 320, 128, 64],
  bag: [384, 384, 64, 64],
  trim: [448, 384, 64, 64],    // collars and cuffs in the shirt colour
  dark: [384, 448, 64, 64],    // mouth inside, glasses frames, straps
  lens: [448, 448, 64, 64],
};

const PAD = 3;

// Map a 0..1 (u, v) inside a region (v = 0 at the region's bottom) to atlas UVs (flipY texture).
export function regionUV(name, u, v) {
  const [x, y, w, h] = REGIONS[name];
  const px = x + PAD + Math.min(1, Math.max(0, u)) * (w - 2 * PAD);
  const py = y + PAD + (1 - Math.min(1, Math.max(0, v))) * (h - 2 * PAD);
  return [px / ATLAS_SIZE, 1 - py / ATLAS_SIZE];
}

// Same mapping in canvas pixels, for the painter.
export function regionPx(name, u, v) {
  const [x, y, w, h] = REGIONS[name];
  return [x + PAD + u * (w - 2 * PAD), y + PAD + (1 - v) * (h - 2 * PAD)];
}

// Horizontal angle around the head → u. The face (front half) gets 70 % of the width so the
// eyes, brows and lips keep detail; the back of the head is squeezed.
export function headU(angle) {
  const a = Math.abs(angle), s = Math.sign(angle) || 1;
  const k = a < Math.PI / 2 ? (a / (Math.PI / 2)) * 0.35 : 0.35 + ((a - Math.PI / 2) / (Math.PI / 2)) * 0.15;
  return 0.5 + s * k;
}

export const HEAD_V0 = -0.13, HEAD_V1 = 0.13; // head-local y range mapped to v 0..1
export function headV(y) { return (y - HEAD_V0) / (HEAD_V1 - HEAD_V0); }

// Around a body tube: front of the body at u = 0.5.
export function aroundU(x, z) { return 0.5 + Math.atan2(x, z) / (Math.PI * 2); }
