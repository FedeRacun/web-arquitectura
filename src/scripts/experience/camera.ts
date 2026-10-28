import { PerspectiveCamera, Vector3 } from 'three';
import type { ExperienceState } from './state';

/*
 * A slow orbit rig. Portrait screens see less width at the same field of
 * view, so the rig backs away until the subject fits as it does on a
 * landscape screen.
 */

export interface CameraRig {
  camera: PerspectiveCamera;
  resize(width: number, height: number): void;
  apply(state: ExperienceState): void;
}

const FOV = 30;
/** Aspect ratio the scenes were composed at; narrower screens pull back. */
const COMPOSED_ASPECT = 1.5;

export function createCameraRig(): CameraRig {
  const camera = new PerspectiveCamera(FOV, 1, 0.5, 900);
  const target = new Vector3();
  let width = 1;
  let height = 1;
  let fit = 1;

  return {
    camera,
    resize(w, h) {
      width = w;
      height = h;
      camera.aspect = w / h;
      const aspect = w / h;
      fit = aspect < COMPOSED_ASPECT ? Math.min(Math.pow(COMPOSED_ASPECT / aspect, 0.9), 3) : 1;
      camera.updateProjectionMatrix();
    },
    apply(state) {
      const distance = state.distance * (1 + (fit - 1) * state.portraitPull);
      target.set(state.targetX, state.targetY, state.targetZ);
      camera.position.set(
        target.x + distance * Math.cos(state.elevation) * Math.sin(state.azimuth),
        target.y + distance * Math.sin(state.elevation),
        target.z + distance * Math.cos(state.elevation) * Math.cos(state.azimuth),
      );
      camera.lookAt(target);
      // Framing: shift the image so the subject sits beside the sentence (positive x: right, positive y: down).
      // Narrow screens stack sentence and subject, so only the vertical shift applies there.
      const shiftX = fit > 1.4 ? 0 : 1;
      camera.setViewOffset(width, height, -state.frameX * width * shiftX, -state.frameY * height, width, height);
    },
  };
}
