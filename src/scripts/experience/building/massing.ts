import { BoxGeometry, BufferAttribute, Group, Mesh, type BufferGeometry } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createWaveMaterial, type SharedUniforms, type WaveMaterial } from './materialWave';
import { LAYERS, type Building, type LayerId, type MaterialKind, type Part } from './params';

/*
 * Turns the building's boxes into one merged mesh per layer and material:
 * at most twelve draw calls for the whole building. Each layer is its own
 * group so the exploded axonometric can lift it as a piece.
 */

export interface Massing {
  root: Group;
  layers: Record<LayerId, Group>;
  materials: WaveMaterial[];
  /** The materials of each layer, to highlight the hovered one. */
  layerMaterials: Record<LayerId, WaveMaterial[]>;
}

const KINDS: MaterialKind[] = ['concrete', 'wood', 'glass'];

function partGeometry(part: Part): BufferGeometry {
  const [x0, y0, z0] = part.box.min;
  const [x1, y1, z1] = part.box.max;
  const geometry = new BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
  geometry.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  // Every vertex knows where its part starts, so the extrusion can hide parts it has not reached.
  const base = new Float32Array(geometry.attributes.position.count).fill(y0);
  geometry.setAttribute('aBase', new BufferAttribute(base, 1));
  return geometry;
}

export function createMassing(
  building: Building,
  colors: Record<MaterialKind, string>,
  shared: SharedUniforms,
  options: { lowDetail: boolean; shadows: boolean },
): Massing {
  const root = new Group();
  const materials: WaveMaterial[] = [];
  const layers = {} as Record<LayerId, Group>;
  const layerMaterials = {} as Record<LayerId, WaveMaterial[]>;

  for (const layer of LAYERS) {
    const group = new Group();
    group.name = layer;
    layers[layer] = group;
    layerMaterials[layer] = [];
    root.add(group);

    for (const kind of KINDS) {
      const parts = building.parts.filter((part) => part.layer === layer && part.kind === kind);
      if (!parts.length) continue;
      const pieces = parts.map(partGeometry);
      const geometry = mergeGeometries(pieces);
      for (const piece of pieces) piece.dispose();

      const wave = createWaveMaterial(kind, colors[kind], shared, options.lowDetail);
      const mesh = new Mesh(geometry, wave.material);
      mesh.customDepthMaterial = wave.depth;
      mesh.renderOrder = wave.kindIndex;
      mesh.castShadow = options.shadows && kind !== 'glass';
      mesh.receiveShadow = options.shadows;
      group.add(mesh);
      materials.push(wave);
      layerMaterials[layer].push(wave);
    }
  }

  return { root, layers, materials, layerMaterials };
}
