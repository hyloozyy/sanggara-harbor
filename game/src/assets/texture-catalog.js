// Registers every procedural texture generator with the asset library under its name.
import { assets } from './asset-library.js';
import * as surfaces from './surface-textures.js';
import { facadeTextures, FACADE_PALETTES } from './facade-textures.js';
import { shopfrontTextures, billboardTextures, neonSignTexture } from './signage-textures.js';

export function registerProceduralTextures() {
  assets.registerTextures({
    road: surfaces.roadTextures,
    asphalt: surfaces.asphaltTextures,
    crosswalk: surfaces.crosswalkTexture,
    pavers: surfaces.paverTextures,
    concrete: () => surfaces.concreteTexture(),
    'concrete-dark': () => surfaces.concreteTexture(42, [120, 118, 114]),
    sand: surfaces.sandTexture,
    grass: surfaces.grassTexture,
    corrugated: surfaces.corrugatedTextures,
    'clay-tiles': surfaces.clayTileTexture,
    roof: surfaces.roofTexture,
    wood: surfaces.woodPlankTexture,
    'water-normal': surfaces.waterNormalTexture,
    shopfronts: shopfrontTextures,
    billboards: billboardTextures,
    glow: () => surfaces.radialSpriteTexture(),
    facade: facadeTextures,
    facadePaletteCount: (style) => FACADE_PALETTES[style].length,
    neon: neonSignTexture,
  });
}
