// Assembles the whole of Pelabuhan Sanggara from its parts and returns the systems that live on
// in the world: collision, traffic signals and the animated sea.
import * as THREE from 'three';
import { BLOCKS } from './city-layout.js';
import { CollisionWorld } from './collision-world.js';
import { buildRoads } from './road-builder.js';
import { buildBuildings } from './building-generator.js';
import { buildStreetProps } from './street-props.js';
import { buildCoast } from './coast-builder.js';
import { buildHarbor } from './harbor-builder.js';
import { buildAlunAlun } from './landmarks.js';
import { buildStreetLife } from './street-life-props.js';

export const ALUN_ALUN_BLOCK = '2,6';

function groundStyle(block) {
  if (`${block.i},${block.j}` === ALUN_ALUN_BLOCK) return 'grass';
  switch (block.district) {
    case 'bukit-hijau': return 'grass';
    case 'kota-lama': return 'grass';
    case 'kawasan-industri': return 'concrete-dark';
    case 'pantai-senja': return 'grass';
    default: return 'concrete';
  }
}

export function buildCity(onProgress = () => {}) {
  const collision = new CollisionWorld();
  const root = new THREE.Group();
  root.name = 'city';
  onProgress(0.1, 'Jalan dan trotoar');
  root.add(buildRoads(groundStyle));
  onProgress(0.3, 'Gedung dan toko');
  root.add(buildBuildings(BLOCKS, collision, new Set([ALUN_ALUN_BLOCK])));
  onProgress(0.55, 'Alun-alun');
  const square = BLOCKS.find((b) => `${b.i},${b.j}` === ALUN_ALUN_BLOCK);
  root.add(buildAlunAlun(square, collision));
  onProgress(0.65, 'Lampu jalan dan pohon kelapa');
  const props = buildStreetProps(collision);
  root.add(props.group);
  root.add(buildStreetLife(collision));
  onProgress(0.75, 'Pelabuhan');
  root.add(buildHarbor(collision));
  onProgress(0.85, 'Pantai dan bukit');
  const coast = buildCoast();
  root.add(coast.group);
  return { root, collision, signals: props.signals, sea: coast.sea };
}
