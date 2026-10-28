import { gsap } from 'gsap';
import { Box3, Ray, Vector2, Vector3, type PerspectiveCamera } from 'three';
import type { Massing } from './building/massing';
import { LAYERS, type Box, type LayerId } from './building/params';
import type { SceneId } from './scenes';
import type { ExperienceState } from './state';

/*
 * What the pointer adds to the scroll. Everything here eases in slowly and
 * never overshoots:
 * - scene 5: the sun leans towards the cursor;
 * - scene 6: hovering a layer shows its word on a leader line;
 * - scene 7: hovering the model lifts it a few centimetres;
 * - scene 8: hovering the button extrudes a first floor out of the plot.
 * Touch screens have no hover, so a tap does the same on the layers and the
 * model, and pressing the button starts the extrusion.
 */

export interface PointerOptions {
  canvas: HTMLCanvasElement;
  camera: PerspectiveCamera;
  state: ExperienceState;
  massing: Massing;
  layerBounds: Record<LayerId, Box>;
  modelBounds: Box;
  /** Height of the floor the closing button extrudes. */
  firstFloor: number;
  words: Map<LayerId, HTMLElement>;
  cta: HTMLElement | null;
  touch: boolean;
  scene(): SceneId;
  layerOffset(index: number): number;
  requestRender(): void;
}

const SETTLE = 'power3.out';
const toBox3 = (box: Box) => new Box3(new Vector3(...box.min), new Vector3(...box.max));

export function createPointer(options: PointerOptions) {
  const { camera, state, massing, words, requestRender } = options;
  const ndc = new Vector2();
  const ray = new Ray();
  const hit = new Vector3();
  const layerBoxes = LAYERS.map((layer) => toBox3(options.layerBounds[layer]));
  const modelBox = toBox3(options.modelBounds);
  const scratch = new Box3();
  let activeLayer: LayerId | null = null;
  let overModel = false;
  let pending = false;

  const cursor = (target: boolean) => dispatchEvent(new CustomEvent('cad-cursor', { detail: { target } }));

  const setRay = (clientX: number, clientY: number) => {
    const rect = options.canvas.getBoundingClientRect();
    ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    ray.origin.setFromMatrixPosition(camera.matrixWorld);
    ray.direction.set(ndc.x, ndc.y, 0.5).unproject(camera).sub(ray.origin).normalize();
  };

  const lift = new Vector3();
  const layerUnderRay = (): LayerId | null => {
    let nearest = Infinity;
    let found: LayerId | null = null;
    for (let index = 0; index < LAYERS.length; index++) {
      scratch.copy(layerBoxes[index]).translate(lift.set(0, options.layerOffset(index), 0));
      if (!ray.intersectBox(scratch, hit)) continue;
      const distance = hit.distanceTo(ray.origin);
      if (distance < nearest) {
        nearest = distance;
        found = LAYERS[index];
      }
    }
    return found;
  };

  const showLayer = (layer: LayerId | null) => {
    if (layer === activeLayer) return;
    activeLayer = layer;
    for (const [id, element] of words) element.toggleAttribute('data-active', id === layer);
    for (const id of LAYERS) {
      for (const wave of massing.layerMaterials[id]) {
        gsap.to(wave.uHighlight, { value: id === layer ? 1 : 0, duration: 0.9, ease: SETTLE, onUpdate: requestRender });
      }
    }
    cursor(layer !== null);
  };

  const liftModel = (lifted: boolean) => {
    if (lifted === overModel) return;
    overModel = lifted;
    gsap.to(state, { lift: lifted ? 2.4 : 0, duration: 1.6, ease: SETTLE, overwrite: 'auto', onUpdate: requestRender });
    cursor(lifted);
  };

  const modelUnderRay = () => {
    scratch.copy(modelBox).translate(lift.set(0, state.lift, 0));
    return ray.intersectBox(scratch, hit) !== null;
  };

  /** Hover (or a tap) at a screen point, in whichever scene is showing. */
  const probe = (clientX: number, clientY: number, toggle: boolean) => {
    const scene = options.scene();
    setRay(clientX, clientY);
    if (scene === 'despiece' && state.explode > 0.6) {
      const layer = layerUnderRay();
      showLayer(toggle && layer === activeLayer ? null : layer);
    } else {
      showLayer(null);
    }
    if (scene === 'mesa' && state.model > 0.6) {
      const over = modelUnderRay();
      liftModel(toggle ? over && !overModel : over);
    } else {
      liftModel(false);
    }
  };

  let lastX = 0;
  let lastY = 0;
  addEventListener(
    'pointermove',
    (event) => {
      if (event.pointerType !== 'mouse') return;
      lastX = event.clientX;
      lastY = event.clientY;
      gsap.to(state, {
        tiltX: (event.clientX / innerWidth) * 2 - 1,
        tiltY: -((event.clientY / innerHeight) * 2 - 1),
        duration: 2.4,
        ease: SETTLE,
        overwrite: 'auto',
        onUpdate: state.tilt > 0 ? requestRender : undefined,
      });
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        probe(lastX, lastY, false);
      });
    },
    { passive: true },
  );

  // A tap: a short press that did not scroll.
  let downX = 0;
  let downY = 0;
  options.canvas.addEventListener('pointerdown', (event) => {
    downX = event.clientX;
    downY = event.clientY;
  });
  options.canvas.addEventListener('pointerup', (event) => {
    if (event.pointerType === 'mouse') return;
    if (Math.hypot(event.clientX - downX, event.clientY - downY) > 10) return;
    probe(event.clientX, event.clientY, true);
  });

  // The closing button: a first floor rises from the plot while it is hovered, focused or pressed.
  const extrude = (on: boolean) =>
    gsap.to(state, {
      ctaGrow: on ? options.firstFloor : 0,
      duration: on ? 2.2 : 1.6,
      ease: SETTLE,
      overwrite: 'auto',
      onUpdate: requestRender,
    });
  const cta = options.cta;
  if (cta) {
    cta.addEventListener('pointerenter', (event) => event.pointerType === 'mouse' && extrude(true));
    cta.addEventListener('pointerleave', (event) => event.pointerType === 'mouse' && extrude(false));
    cta.addEventListener('pointerdown', (event) => event.pointerType !== 'mouse' && extrude(true));
    cta.addEventListener('focus', () => extrude(true));
    cta.addEventListener('blur', () => extrude(false));
    if (document.activeElement === cta) extrude(true);
  }

  return {
    /** Called when the scroll changes scene: hover states do not outlive their scene. */
    sceneChanged(scene: SceneId) {
      if (scene !== 'despiece') showLayer(null);
      if (scene !== 'mesa') liftModel(false);
      if (scene !== 'cierre' && state.ctaGrow > 0) extrude(false);
      // Focus that arrived on the way (the keyboard shortcut to the end) extrudes once the plot is there.
      if (scene === 'cierre' && cta && document.activeElement === cta) extrude(true);
      if (!options.touch && (scene === 'despiece' || scene === 'mesa')) probe(lastX, lastY, false);
    },
    /** Hang each word off its layer: from its right-most edge on screen, at its middle height. */
    placeWords() {
      const corner = new Vector3();
      // The rig has just moved the camera; its matrices only refresh on render, which comes after this.
      camera.updateMatrixWorld();
      LAYERS.forEach((layer, index) => {
        const element = words.get(layer);
        if (!element) return;
        const { min, max } = options.layerBounds[layer];
        const offset = options.layerOffset(index);
        let right = -Infinity;
        let top = -Infinity;
        let bottom = Infinity;
        for (let i = 0; i < 8; i++) {
          corner
            .set(i & 1 ? max[0] : min[0], (i & 2 ? max[1] : min[1]) + offset, i & 4 ? max[2] : min[2])
            .project(camera);
          right = Math.max(right, corner.x);
          top = Math.max(top, corner.y);
          bottom = Math.min(bottom, corner.y);
        }
        const x = ((right + 1) / 2) * innerWidth + 12;
        const y = ((1 - (top + bottom) / 2) / 2) * innerHeight;
        element.style.setProperty('--x', `${x.toFixed(1)}px`);
        element.style.setProperty('--y', `${y.toFixed(1)}px`);
      });
    },
  };
}
