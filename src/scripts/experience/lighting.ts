import { AmbientLight, DirectionalLight, HemisphereLight, PointLight, Vector3, type Scene } from 'three';
import type { ExperienceState } from './state';

/*
 * Hard, late-afternoon light on concrete: one sun with crisp shadows, very
 * little fill so the shadows stay deep, and a warm light inside the base that
 * spills out through the glass in scene 5.
 */

export interface Lighting {
  sun: DirectionalLight;
  apply(state: ExperienceState): void;
}

const SUN_DISTANCE = 45;
const TARGET = new Vector3(0, 3, 0);

export function createLighting(scene: Scene, options: { shadows: boolean; interiorAt: Vector3 }): Lighting {
  const hemisphere = new HemisphereLight('#efe6d8', '#141210', 0.5);
  const ambient = new AmbientLight('#ede6da', 0.04);
  const sun = new DirectionalLight('#ffeedd', 2.4);
  sun.target.position.copy(TARGET);
  sun.castShadow = options.shadows;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.radius = 1.5;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  const frustum = sun.shadow.camera;
  frustum.left = -24;
  frustum.right = 24;
  frustum.top = 24;
  frustum.bottom = -24;
  frustum.near = 5;
  frustum.far = 110;

  const interior = new PointLight('#f2bd7c', 0, 22, 1.6);
  interior.position.copy(options.interiorAt);

  scene.add(hemisphere, ambient, sun, sun.target, interior);

  return {
    sun,
    apply(state) {
      // The pointer leans the sun a few degrees towards the cursor.
      const azimuth = state.sunAzimuth + state.tiltX * 0.14 * state.tilt;
      const elevation = Math.min(Math.max(state.sunElevation + state.tiltY * 0.08 * state.tilt, 0.12), 1.45);
      sun.position.set(
        TARGET.x + SUN_DISTANCE * Math.cos(elevation) * Math.sin(azimuth),
        TARGET.y + SUN_DISTANCE * Math.sin(elevation),
        TARGET.z + SUN_DISTANCE * Math.cos(elevation) * Math.cos(azimuth),
      );
      sun.intensity = state.sunIntensity;
      hemisphere.intensity = state.fill;
      interior.intensity = state.interior * 26;
    },
  };
}
