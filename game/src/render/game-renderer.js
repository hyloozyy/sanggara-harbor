// Owns the WebGL renderer, the scene, the main camera, the dusk lighting rig, the sky and the
// post-processing chain, and applies the graphics quality settings.
import * as THREE from 'three';
import { PostProcessPipeline } from './post-process-pipeline.js';
import { createSkyDome, bakeSkyEnvironment } from './sky-dome.js';
import { DuskLighting, SUN_DIRECTION } from './dusk-lighting.js';
import { assets } from '../assets/asset-library.js';

export const QUALITY_PRESETS = {
  rendah: { scale: 0.6, shadows: false, shadowSize: 1024, bloom: false, samples: 0 },
  sedang: { scale: 0.85, shadows: true, shadowSize: 1024, bloom: true, samples: 0 },
  tinggi: { scale: 1.0, shadows: true, shadowSize: 2048, bloom: true, samples: 4 },
};

export class GameRenderer {
  constructor(canvas, quality = 'tinggi') {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, 16 / 9, 0.3, 3200);
    this.camera.position.set(0, 60, 200);
    this.lighting = new DuskLighting(this.scene);
    this.sky = createSkyDome(SUN_DIRECTION);
    this.scene.add(this.sky);
    this.environment = bakeSkyEnvironment(this.renderer, SUN_DIRECTION);
    this.scene.environment = this.environment;
    this.scene.environmentIntensity = 0.85;
    assets.setEnvironment(this.environment);
    this.post = new PostProcessPipeline(this.renderer, { samples: QUALITY_PRESETS[quality].samples });
    this.setQuality(quality);
    addEventListener('resize', () => this.resize());
  }

  setQuality(name) {
    const q = QUALITY_PRESETS[name] || QUALITY_PRESETS.tinggi;
    this.quality = name;
    this.scale = q.scale;
    this.post.enabled = q.bloom;
    this.post.samples = q.samples;
    this.lighting.setShadowQuality(q.shadowSize, q.shadows);
    this.renderer.shadowMap.enabled = q.shadows;
    this.resize();
  }

  resize() {
    const w = this.canvas.clientWidth || innerWidth, h = this.canvas.clientHeight || innerHeight;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2) * this.scale);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    this.post.setSize(size.x, size.y);
  }

  render(time) {
    this.sky.position.copy(this.camera.position);
    this.sky.material.uniforms.time.value = time;
    this.post.render(this.scene, this.camera, time);
  }
}
