import { PerspectiveCamera } from 'three';
import type { ExperienceState } from './state';

/*
 * A slow orbit rig. Portrait screens see less width at the same field of
 * view, so the rig backs away until the subject fits as it does on a
 * landscape screen.
 */

/** What places the camera: the timeline's values, or the other projects' view blended over them. */
export type CameraView = Pick<
  ExperienceState,
  'azimuth' | 'elevation' | 'distance' | 'targetX' | 'targetY' | 'targetZ' | 'frameX' | 'frameY' | 'portraitPull'
>;

export interface CameraRig {
  camera: PerspectiveCamera;
  resize(width: number, height: number): void;
  apply(view: CameraView): void;
}

export const FOV = 30;
/** Aspect ratio the scenes were composed at; narrower screens pull back. */
const COMPOSED_ASPECT = 1.5;

/** The rig's lens, also used to frame views off screen (projects.ts). */
export const lens = () => new PerspectiveCamera(FOV, 1, 0.5, 900);

/** How far a screen narrower than the composition pulls back: 1 on a landscape screen. */
const portraitFit = (aspect: number) =>
  aspect < COMPOSED_ASPECT ? Math.min(Math.pow(COMPOSED_ASPECT / aspect, 0.9), 3) : 1;

/** Places `camera` for `view` on a `width` × `height` screen (its aspect already set). */
export function poseCamera(camera: PerspectiveCamera, view: CameraView, width: number, height: number) {
  const fit = portraitFit(width / height);
  const distance = view.distance * (1 + (fit - 1) * view.portraitPull);
  const { x, y, z } = { x: view.targetX, y: view.targetY, z: view.targetZ };
  camera.position.set(
    x + distance * Math.cos(view.elevation) * Math.sin(view.azimuth),
    y + distance * Math.sin(view.elevation),
    z + distance * Math.cos(view.elevation) * Math.cos(view.azimuth),
  );
  camera.lookAt(x, y, z);
  // Framing: shift the image so the subject sits beside the sentence (positive x: right, positive y: down).
  // Narrow screens stack sentence and subject, so only the vertical shift applies there.
  const shiftX = fit > 1.4 ? 0 : 1;
  camera.setViewOffset(width, height, -view.frameX * width * shiftX, -view.frameY * height, width, height);
}

export function createCameraRig(): CameraRig {
  const camera = lens();
  let width = 1;
  let height = 1;

  return {
    camera,
    resize(w, h) {
      width = w;
      height = h;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    },
    apply(view) {
      poseCamera(camera, view, width, height);
    },
  };
}
