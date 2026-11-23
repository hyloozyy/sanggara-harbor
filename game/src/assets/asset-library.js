// The one registry every system asks for textures, materials and geometries, so each procedural
// asset is generated once and reused everywhere (and tinted variants are cached by key).
import * as THREE from 'three';
import * as surfaces from './surface-textures.js';
import { facadeTextures, FACADE_PALETTES } from './facade-textures.js';
import { shopfrontTextures, billboardTextures, neonSignTexture } from './signage-textures.js';

const textureCache = new Map();
const materialCache = new Map();
const geometryCache = new Map();

let environmentMap = null;

function cached(map, key, make) {
  if (!map.has(key)) map.set(key, make());
  return map.get(key);
}

export const assets = {
  setEnvironment(env) { environmentMap = env; },
  get environment() { return environmentMap; },

  texture(name) {
    return cached(textureCache, name, () => {
      switch (name) {
        case 'road': return surfaces.roadTextures();
        case 'asphalt': return surfaces.asphaltTextures();
        case 'crosswalk': return surfaces.crosswalkTexture();
        case 'pavers': return surfaces.paverTextures();
        case 'concrete': return surfaces.concreteTexture();
        case 'concrete-dark': return surfaces.concreteTexture(42, [120, 118, 114]);
        case 'sand': return surfaces.sandTexture();
        case 'grass': return surfaces.grassTexture();
        case 'corrugated': return surfaces.corrugatedTextures();
        case 'clay-tiles': return surfaces.clayTileTexture();
        case 'roof': return surfaces.roofTexture();
        case 'wood': return surfaces.woodPlankTexture();
        case 'water-normal': return surfaces.waterNormalTexture();
        case 'shopfronts': return shopfrontTextures();
        case 'billboards': return billboardTextures();
        case 'glow': return surfaces.radialSpriteTexture();
        default: throw new Error('unknown texture ' + name);
      }
    });
  },

  facadeMaterial(style, paletteIndex) {
    const count = FACADE_PALETTES[style].length;
    const p = paletteIndex % count;
    return cached(materialCache, `facade:${style}:${p}`, () => {
      const t = facadeTextures(style, p, 7 + p);
      return new THREE.MeshStandardMaterial({
        map: t.map, emissiveMap: t.emissiveMap, emissive: new THREE.Color(1.0, 0.82, 0.6), emissiveIntensity: 1.05,
        roughnessMap: t.ormMap, metalnessMap: t.ormMap, normalMap: t.normalMap, normalScale: new THREE.Vector2(1.2, 1.2), roughness: 1, metalness: style === 'glass' ? 0.9 : 0.6,
        envMapIntensity: 1.0,
      });
    });
  },

  neonMaterial(text, color) {
    return cached(materialCache, `neon:${text}:${color}`, () => {
      const t = neonSignTexture(text, color);
      return new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 3.2, roughness: 0.5 });
    });
  },

  // Plain PBR materials by name.
  material(name) {
    return cached(materialCache, name, () => {
      const T = (n) => this.texture(n);
      const std = (o) => new THREE.MeshStandardMaterial(o);
      switch (name) {
        case 'road': { const t = T('road'); return std({ map: t.map, roughnessMap: t.roughnessMap, roughness: 1, metalness: 0.05, envMapIntensity: 1.3 }); }
        case 'asphalt': { const t = T('asphalt'); return std({ map: t.map, roughnessMap: t.roughnessMap, roughness: 1, metalness: 0.05, envMapIntensity: 1.2 }); }
        case 'crosswalk': return std({ map: T('crosswalk'), transparent: true, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false });
        case 'sidewalk': { const t = T('pavers'); return std({ map: t.map, normalMap: t.normalMap, roughness: 0.85 }); }
        case 'curb': return std({ color: 0xb8b2a6, roughness: 0.8 });
        case 'concrete': return std({ map: T('concrete'), roughness: 0.9 });
        case 'concrete-dark': return std({ map: T('concrete-dark'), roughness: 0.9 });
        case 'roof': return std({ map: T('roof'), roughness: 0.95 });
        case 'clay-roof': return std({ map: T('clay-tiles'), roughness: 0.75 });
        case 'sand': return std({ map: T('sand'), roughness: 0.95 });
        case 'grass': return std({ map: T('grass'), roughness: 0.95 });
        case 'hill': return std({ map: T('grass'), color: 0x9aa070, roughness: 1 });
        case 'wood': return std({ map: T('wood'), roughness: 0.8 });
        case 'corrugated': { const t = T('corrugated'); return std({ map: t.map, normalMap: t.normalMap, roughness: 0.55, metalness: 0.5 }); }
        case 'shopfront': { const t = T('shopfronts'); return std({ map: t.map, emissiveMap: t.emissiveMap, emissive: 0xffffff, emissiveIntensity: 1.5, roughness: 0.4 }); }
        case 'billboard': { const t = T('billboards'); return std({ map: t.map, emissiveMap: t.emissiveMap, emissive: 0xffffff, emissiveIntensity: 1.3, roughness: 0.5 }); }
        case 'glass-dark': return new THREE.MeshPhysicalMaterial({ color: 0x0d1418, roughness: 0.05, metalness: 0.2, clearcoat: 1, envMapIntensity: 1.6 });
        case 'chrome': return std({ color: 0xdddddd, roughness: 0.15, metalness: 1 });
        case 'rubber': return std({ color: 0x151515, roughness: 0.9 });
        case 'rim': return std({ color: 0xb8bcc2, roughness: 0.25, metalness: 1 });
        case 'metal-dark': return std({ color: 0x33363b, roughness: 0.5, metalness: 0.7 });
        case 'metal-paint-white': return std({ color: 0xe8e8e2, roughness: 0.45, metalness: 0.3 });
        case 'crane-red': return std({ color: 0xc8361f, roughness: 0.5, metalness: 0.4 });
        case 'crane-yellow': return std({ color: 0xe3a21a, roughness: 0.5, metalness: 0.4 });
        case 'lamp-pole': return std({ color: 0x3b4046, roughness: 0.5, metalness: 0.8 });
        case 'lamp-glow': return std({ color: 0xffe2b0, emissive: 0xffc27a, emissiveIntensity: 9 });
        case 'headlight': return std({ color: 0xffffff, emissive: 0xfff2d0, emissiveIntensity: 7 });
        case 'taillight': return std({ color: 0x550000, emissive: 0xff1a10, emissiveIntensity: 4 });
        case 'brakelight': return std({ color: 0x550000, emissive: 0xff2010, emissiveIntensity: 12 });
        case 'siren-red': return std({ color: 0x330000, emissive: 0xff1020, emissiveIntensity: 0 });
        case 'siren-blue': return std({ color: 0x000033, emissive: 0x1050ff, emissiveIntensity: 0 });
        case 'trunk': return std({ color: 0x6b5340, roughness: 0.95 });
        case 'palm-trunk': return std({ color: 0x8a7258, roughness: 0.95 });
        case 'leaves': return std({ color: 0x3f7a30, roughness: 0.8, side: THREE.DoubleSide });
        case 'palm-leaves': return std({ color: 0x4d8a34, roughness: 0.75, side: THREE.DoubleSide });
        case 'water': return new THREE.MeshPhysicalMaterial({
          color: 0x1a5566, roughness: 0.08, metalness: 0.1, normalMap: T('water-normal'), ior: 1.33,
          normalScale: new THREE.Vector2(0.45, 0.45), envMapIntensity: 2.6, clearcoat: 0.6, clearcoatRoughness: 0.15,
        });
        case 'pool': return std({ color: 0x2ab6d0, emissive: 0x0a5a70, emissiveIntensity: 0.6, roughness: 0.05 });
        case 'skin-shadow': return std({ color: 0x222222 });
        case 'traffic-red': return std({ color: 0x330000, emissive: 0xff2010, emissiveIntensity: 6 });
        case 'traffic-green': return std({ color: 0x003300, emissive: 0x20ff60, emissiveIntensity: 5 });
        case 'traffic-off': return std({ color: 0x111111, roughness: 0.4 });
        case 'dome-gold': return std({ color: 0xd4a640, roughness: 0.3, metalness: 1 });
        case 'dome-green': return std({ color: 0x2e7a5a, roughness: 0.35, metalness: 0.6 });
        case 'white-plaster': return std({ color: 0xf0ebe0, roughness: 0.85 });
        case 'umbrella': return std({ color: 0xffffff, vertexColors: true, roughness: 0.7, side: THREE.DoubleSide });
        default: throw new Error('unknown material ' + name);
      }
    });
  },

  // Metallic car paint with clearcoat, cached per colour.
  carPaint(hex) {
    return cached(materialCache, `paint:${hex}`, () => {
      const m = new THREE.MeshPhysicalMaterial({ color: hex, metalness: 0.55, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.3 });
      m.userData.paint = true;
      return m;
    });
  },

  // Matte cloth/skin colours for people, cached per colour.
  cloth(hex) {
    return cached(materialCache, `cloth:${hex}`, () => new THREE.MeshStandardMaterial({ color: hex, roughness: 0.85 }));
  },

  emissive(hex, intensity = 4) {
    return cached(materialCache, `emissive:${hex}:${intensity}`, () => new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: intensity }));
  },

  geometry(key, make) { return cached(geometryCache, key, make); },

  // Assign the baked sky to every standard material that wants reflections.
  applyEnvironment(root) {
    if (!environmentMap) return;
    root.traverse((o) => {
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of mats) if (m.isMeshStandardMaterial && !m.envMap) { m.envMap = environmentMap; m.needsUpdate = true; }
    });
  },
};
