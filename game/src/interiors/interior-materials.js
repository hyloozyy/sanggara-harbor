// Shared PBR materials for the interiors, made once on first use. Wood is varnished (low
// roughness, grain normal maps), metals reflect the room's own baked environment, glass and
// bottles are thin transparent shells with strong reflections, neon and bulbs are emissive so
// the bloom pass makes them glow.
import * as THREE from 'three';
import {
  grainTextures, plankTextures, tegelTextures, glazedTileTextures, terrazzoTextures, plasterTextures, brickTextures,
  feltTextures, fabricTextures, batikTexture, labelAtlas, goodsAtlas,
} from './interior-textures.js';

let M = null;

const std = (o) => new THREE.MeshStandardMaterial(o);
function tex(t, repeat = 1) { if (t && repeat !== 1) { t = t.clone(); t.repeat.set(repeat, repeat); t.needsUpdate = true; } return t; }

// A textured material whose UVs are in metres: `scale` metres per texture tile.
function tiled(textures, scale, o = {}) {
  const r = 1 / scale;
  const m = std({ map: tex(textures.map, r), normalMap: textures.normalMap ? tex(textures.normalMap, r) : null, roughnessMap: textures.roughnessMap ? tex(textures.roughnessMap, r) : null, roughness: 1, metalness: 0, ...o });
  return m;
}

export function interiorMaterials() {
  if (M) return M;
  const grainDark = grainTextures(0x4a2412, 11), grainMid = grainTextures(0x8a5a32, 12), grainTeak = grainTextures(0x7a4422, 13), grainPale = grainTextures(0xc89a68, 14);
  M = {
    // Woods.
    woodDark: tiled(grainDark, 1.2, { roughness: 0.32, normalScale: new THREE.Vector2(0.6, 0.6) }),
    woodMid: tiled(grainMid, 1.0, { roughness: 0.42, normalScale: new THREE.Vector2(0.6, 0.6) }),
    woodTeak: tiled(grainTeak, 1.0, { roughness: 0.38 }),
    woodPale: tiled(grainPale, 1.0, { roughness: 0.5 }),
    floorPlank: tiled(plankTextures(0x7a4a2a, { boards: 6, seed: 3 }), 1.8, { roughness: 1, envMapIntensity: 0.8 }),
    floorPlankPale: tiled(plankTextures(0xa87a4a, { boards: 5, seed: 6 }), 1.6, { roughness: 1 }),
    tegelRed: tiled(tegelTextures(0x7a3424, 0xb8a888, 0x2a3a40), 0.8, { roughness: 1 }),
    tegelGreen: tiled(tegelTextures(0x2a5a4a, 0xe0d6b8, 0x8a5a2a), 0.8, { roughness: 1 }),
    tileWhite: tiled(glazedTileTextures(0xeef0ec, 4), 0.6, { roughness: 1 }),
    tileMint: tiled(glazedTileTextures(0xb8dcd0, 4, 0xe8e8e0), 0.6, { roughness: 1 }),
    tileBlue: tiled(glazedTileTextures(0x6a9ac0, 6, 0xe0e4e8), 0.6, { roughness: 1 }),
    terrazzo: tiled(terrazzoTextures(0xd8d0c0), 2.0, { roughness: 0.6 }),
    // Walls.
    plasterCream: tiled(plasterTextures(0xe8dcc4), 2.0),
    plasterTeal: tiled(plasterTextures(0x2f6a66, 5), 2.0),
    plasterOchre: tiled(plasterTextures(0xd8a860, 6), 2.0),
    plasterWhite: tiled(plasterTextures(0xf0eee8, 7), 2.0),
    plasterSky: tiled(plasterTextures(0xb8d4e0, 8), 2.0),
    brick: tiled(brickTextures(), 2.2, { roughness: 0.95 }),
    ceiling: tiled(plasterTextures(0xf4efe4, 9), 2.5, { roughness: 1 }),
    // Fabrics.
    leatherRed: tiled(fabricTextures(0x7a1a18, 'leather'), 0.5, { roughness: 0.42, envMapIntensity: 0.7 }),
    leatherBrown: tiled(fabricTextures(0x5a3220, 'leather', 3), 0.5, { roughness: 0.5 }),
    clothGreen: tiled(fabricTextures(0x3a5a4a, 'weave'), 0.25, { roughness: 0.95 }),
    clothBlue: tiled(fabricTextures(0x2a3a5a, 'weave', 4), 0.25, { roughness: 0.95 }),
    clothCream: tiled(fabricTextures(0xe8e0d0, 'cotton', 5), 0.3, { roughness: 0.95 }),
    clothMustard: tiled(fabricTextures(0xc08a2a, 'weave', 6), 0.25, { roughness: 0.95 }),
    batik: std({ map: tex(batikTexture(0x6a3a1a, 0xe8c890), 2), roughness: 0.9 }),
    batikBlue: std({ map: tex(batikTexture(0x1a2a4a, 0xd8c8a0, 3), 2), roughness: 0.9 }),
    felt: tiled(feltTextures(0x1f6a3a), 0.6, { roughness: 0.95 }),
    feltRed: tiled(feltTextures(0x7a1a22), 0.6, { roughness: 0.95 }),
    // Metals.
    chrome: std({ color: 0xe8e8ec, metalness: 1, roughness: 0.12 }),
    steel: std({ color: 0xb0b4b8, metalness: 1, roughness: 0.32 }),
    brass: std({ color: 0xd0a050, metalness: 1, roughness: 0.28 }),
    copper: std({ color: 0xc8704a, metalness: 1, roughness: 0.3 }),
    blackMetal: std({ color: 0x1c1c1e, metalness: 0.7, roughness: 0.45 }),
    iron: std({ color: 0x2a2826, metalness: 0.8, roughness: 0.6 }),
    // Plastics, ceramics, paint.
    white: std({ color: 0xf2f0ea, roughness: 0.4 }),
    ceramic: std({ color: 0xf4f4f0, roughness: 0.12 }),
    black: std({ color: 0x141416, roughness: 0.35 }),
    rubber: std({ color: 0x18181a, roughness: 0.85 }),
    redPaint: std({ color: 0xa81e22, roughness: 0.35 }),
    greenPaint: std({ color: 0x2a6a4a, roughness: 0.4 }),
    bluePaint: std({ color: 0x2a4a7a, roughness: 0.4 }),
    creamPaint: std({ color: 0xe8dcc0, roughness: 0.45 }),
    mint: std({ color: 0x9ad0c0, roughness: 0.35 }),
    fridgeWhite: std({ color: 0xe8ece8, roughness: 0.25 }),
    plasticRed: std({ color: 0xc82a2a, roughness: 0.45 }),
    plasticBlue: std({ color: 0x2a6ac8, roughness: 0.45 }),
    plasticGreen: std({ color: 0x3aa85a, roughness: 0.45 }),
    rattan: std({ color: 0xc89a5a, roughness: 0.8 }),
    paper: std({ color: 0xf0ece0, roughness: 0.9 }),
    cork: std({ color: 0xa87a4a, roughness: 0.95 }),
    pillow: std({ color: 0xf0ece4, roughness: 0.9 }),
    mattress: std({ color: 0xe8e4f0, roughness: 0.9 }),
    leaf: std({ color: 0x2a6a2a, roughness: 0.7, side: THREE.DoubleSide }),
    soil: std({ color: 0x3a2618, roughness: 1 }),
    terracotta: std({ color: 0xb05a34, roughness: 0.85 }),
    // Glass and liquids (thin transparent shells that mostly reflect).
    glass: std({ color: 0xe8f4f4, metalness: 0.1, roughness: 0.03, transparent: true, opacity: 0.22, envMapIntensity: 2.2, depthWrite: false }),
    glassGreen: std({ color: 0x2a7a3a, metalness: 0.1, roughness: 0.04, transparent: true, opacity: 0.72, envMapIntensity: 2.0 }),
    glassBrown: std({ color: 0x6a3a10, metalness: 0.1, roughness: 0.04, transparent: true, opacity: 0.8, envMapIntensity: 2.0 }),
    glassClear: std({ color: 0xd8e8e8, metalness: 0.1, roughness: 0.03, transparent: true, opacity: 0.4, envMapIntensity: 2.4 }),
    glassBlue: std({ color: 0x3a5aa8, metalness: 0.1, roughness: 0.04, transparent: true, opacity: 0.7, envMapIntensity: 2.0 }),
    mirror: std({ color: 0xc8ccd0, metalness: 1, roughness: 0.03, envMapIntensity: 1.6 }),
    beer: std({ color: 0xd88a1a, roughness: 0.1, transparent: true, opacity: 0.85, emissive: 0x3a1a00, emissiveIntensity: 0.6 }),
    foam: std({ color: 0xfff8e8, roughness: 0.8 }),
    tea: std({ color: 0x8a3a10, roughness: 0.1, transparent: true, opacity: 0.88 }),
    coffee: std({ color: 0x1a0c06, roughness: 0.15 }),
    labels: std({ map: labelAtlas(), roughness: 0.6 }),
    goods: std({ map: goodsAtlas(), roughness: 0.6 }),
    // Light sources.
    bulb: std({ color: 0xfff0c8, emissive: 0xffd890, emissiveIntensity: 6 }),
    bulbCool: std({ color: 0xf0f8ff, emissive: 0xe8f4ff, emissiveIntensity: 4 }),
    ledWarm: std({ color: 0xffe0a0, emissive: 0xffb050, emissiveIntensity: 4 }),
    lampShade: std({ color: 0x1a3a2a, metalness: 0.4, roughness: 0.4, side: THREE.DoubleSide }),
    shadeInner: std({ color: 0xfff0d0, emissive: 0xffd8a0, emissiveIntensity: 1.2, side: THREE.DoubleSide }),
    balls: std({ vertexColors: true, roughness: 0.08, envMapIntensity: 1.5 }),
    paperShade: std({ color: 0xf8ecd0, emissive: 0xffc880, emissiveIntensity: 1.6, side: THREE.DoubleSide, roughness: 0.9 }),
    windowDusk: std({ color: 0x000000, emissive: 0xffa868, emissiveIntensity: 1.4, roughness: 1 }),
    screenGlow: std({ color: 0x0a0a0a, emissive: 0x6a9aff, emissiveIntensity: 1.2, roughness: 0.2 }),
  };
  return M;
}

// Neon sign material (additive glow on a transparent texture).
export function neonMaterial(texture, color = 0xffffff, intensity = 3) {
  return new THREE.MeshBasicMaterial({ map: texture, color: new THREE.Color(color).multiplyScalar(intensity), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
}
