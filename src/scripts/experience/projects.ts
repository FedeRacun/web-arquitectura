import { gsap } from 'gsap';
import {
  Box3,
  BoxGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Ray,
  Vector2,
  Vector3,
  type PerspectiveCamera,
  type Scene,
  type WebGLRenderer,
} from 'three';
import type { Project } from '../../config/projects';
import { sheetOffset } from './building/plan';
import { createPlanSheet, type PlanSheet } from './building/planSheet';
import { lens, poseCamera, type CameraView } from './camera';
import type { Scroll } from './scroll';
import type { ExperienceState } from './state';

/*
 * The other projects, one slide to the side. From the model on the table the
 * camera rises and slides right to a row of the studio's other houses, each
 * drafted on its own board with the main plan's ink sweep. A click brings the
 * camera over one plan until it reads whole; Escape steps back to the row,
 * then to the house. The camera is blended over the timeline's (`aside`), so
 * the two never fight, and the scroll is stopped while the row is open, so
 * the timeline's values hold still underneath it.
 */

// ---------------------------------------------------------------------------
// The row, the views and the steps between them: pure, tested in projects.test.ts.

export interface SheetSize {
  width: number;
  depth: number;
}

/** A sheet on the table: its centre and its plot's size. */
export interface PlacedSheet extends SheetSize {
  x: number;
  z: number;
}

/** Lays the sheets left to right from `start` (the first one's west edge), `gap` apart edge to edge, on one line. */
export function rowLayout(sizes: readonly SheetSize[], start: number, gap: number): PlacedSheet[] {
  let west = start;
  return sizes.map(({ width, depth }) => {
    const sheet = { x: west + width / 2, z: 0, width, depth };
    west += width + gap;
    return sheet;
  });
}

const VIEW_KEYS = [
  'azimuth',
  'elevation',
  'distance',
  'targetX',
  'targetY',
  'targetZ',
  'frameX',
  'frameY',
  'portraitPull',
] as const;

/** The camera `t` of the way from the timeline's view to the projects' (both ends exact). */
export function blendView(from: CameraView, to: CameraView, t: number, out: CameraView): CameraView {
  // It rises sooner than it slides: over the table first, then along it.
  const rise = 1 - (1 - t) * (1 - t);
  for (const key of VIEW_KEYS) {
    const k = key === 'elevation' ? rise : t;
    out[key] = from[key] * (1 - k) + to[key] * k;
  }
  return out;
}

/** Margins the framed sheets keep clear, as fractions of the screen: the heading above, the labels below. */
export interface Safe {
  top: number;
  bottom: number;
  side: number;
}

const SAFE: Record<'list' | 'focus', Record<'wide' | 'narrow', Safe>> = {
  list: { wide: { top: 0.24, bottom: 0.16, side: 0.06 }, narrow: { top: 0.3, bottom: 0.26, side: 0.06 } },
  focus: { wide: { top: 0.17, bottom: 0.14, side: 0.05 }, narrow: { top: 0.2, bottom: 0.26, side: 0.04 } },
};

export const safeArea = (mode: 'list' | 'focus', narrow: boolean) => SAFE[mode][narrow ? 'narrow' : 'wide'];

/** The row is seen as sheets on a table; a plan in focus nearly plumb, to read it whole. */
const LIST_ELEVATION = 1.12;
const FOCUS_ELEVATION = 1.42;

const fitter = lens();
const corner = new Vector3();

/** The closest view, looking north over the table, that holds the rectangle inside the safe margins. */
function frameRect(x: [number, number], z: [number, number], y: number, aspect: number, safe: Safe, elevation: number) {
  const view: CameraView = {
    azimuth: 0,
    elevation,
    distance: 1,
    targetX: (x[0] + x[1]) / 2,
    targetY: y,
    targetZ: (z[0] + z[1]) / 2,
    frameX: 0,
    frameY: 0,
    portraitPull: 0,
  };
  fitter.aspect = aspect;
  fitter.updateProjectionMatrix();
  const extent = () => {
    poseCamera(fitter, view, aspect, 1);
    fitter.updateMatrixWorld();
    let left = Infinity;
    let right = -Infinity;
    let low = Infinity;
    let high = -Infinity;
    for (const cx of x) {
      for (const cz of z) {
        corner.set(cx, y, cz).project(fitter);
        // Behind the camera or past its far plane: it does not fit.
        if (Math.abs(corner.z) > 1) return null;
        left = Math.min(left, corner.x);
        right = Math.max(right, corner.x);
        low = Math.min(low, corner.y);
        high = Math.max(high, corner.y);
      }
    }
    return { width: right - left, low, high };
  };
  const fits = () => {
    const seen = extent();
    return seen !== null && seen.width <= 2 - 4 * safe.side && seen.high - seen.low <= 2 - 2 * (safe.top + safe.bottom);
  };
  // Looking straight along the row's axis, the sheet is centred left to right: only the distance and the band remain.
  let near = 5;
  let far = 800;
  for (let i = 0; i < 40; i++) {
    view.distance = (near + far) / 2;
    if (fits()) far = view.distance;
    else near = view.distance;
  }
  view.distance = far;
  const seen = extent();
  // Centred in the band between the heading and the labels (positive frameY moves the image down).
  if (seen) view.frameY = ((seen.low + seen.high) / 2 - (safe.bottom - safe.top)) / 2;
  return view;
}

export type ProjectsMode = 'closed' | 'list' | 'focus';

export interface ProjectsNav {
  mode: ProjectsMode;
  /** The plan in focus; in the list, the one a step moves from. */
  index: number;
}

export type ProjectsAction =
  | { type: 'open' }
  | { type: 'close' }
  /** Escape or "Volver": from a plan to the list, from the list to the house. */
  | { type: 'back' }
  | { type: 'focus'; index: number }
  | { type: 'step'; by: 1 | -1 };

export function navigate(nav: ProjectsNav, action: ProjectsAction, count: number): ProjectsNav {
  const clamp = (index: number) => Math.min(Math.max(index, 0), count - 1);
  switch (action.type) {
    case 'open':
      return nav.mode === 'closed' ? { mode: 'list', index: nav.index } : nav;
    case 'close':
      return { mode: 'closed', index: nav.index };
    case 'back':
      return { mode: nav.mode === 'focus' ? 'list' : 'closed', index: nav.index };
    case 'focus':
      return nav.mode === 'closed' ? nav : { mode: 'focus', index: clamp(action.index) };
    case 'step':
      return nav.mode === 'closed' ? nav : { mode: nav.mode, index: clamp(nav.index + action.by) };
  }
}

/**
 * Where the camera goes for `nav`: the whole row in the list, or one plan per screen where only one fits;
 * one plan, closer and from higher up, in focus. `y` is the height the sheets lie at.
 */
export function projectsView(row: readonly PlacedSheet[], nav: ProjectsNav, aspect: number, narrow: boolean, y: number) {
  const mode = nav.mode === 'focus' ? 'focus' : 'list';
  const framed = mode === 'list' && !narrow ? row : [row[Math.min(Math.max(nav.index, 0), row.length - 1)]];
  const x: [number, number] = [Math.min(...framed.map((s) => s.x - s.width / 2)), Math.max(...framed.map((s) => s.x + s.width / 2))];
  const z: [number, number] = [Math.min(...framed.map((s) => s.z - s.depth / 2)), Math.max(...framed.map((s) => s.z + s.depth / 2))];
  return frameRect(x, z, y, aspect, safeArea(mode, narrow), mode === 'focus' ? FOCUS_ELEVATION : LIST_ELEVATION);
}

// ---------------------------------------------------------------------------
// The view itself: the sheets in the scene, the camera's moves and the HTML around them.

export interface ProjectsOptions {
  projects: readonly Project[];
  scene: Scene;
  renderer: WebGLRenderer;
  camera: PerspectiveCamera;
  canvas: HTMLCanvasElement;
  state: ExperienceState;
  scroll: Scroll;
  /** The lettering's family, already loaded. */
  font: string;
  colors: { bone: string; board: string };
  lowDetail: boolean;
  shadows: boolean;
  reducedMotion: boolean;
  /** The first sheet's west edge: clear of the model's plot. */
  start: number;
  /** The table's top, where the boards lie. */
  floor: number;
  requestRender(): void;
}

/** Space between two plots on the table, edge to edge. */
const ROW_GAP = 9;
/** The boards are thinner than the model's plot: sheets on the table, not a base. */
const BOARD = 0.12;
const SETTLE = 'power2.inOut';

export type Projects = ReturnType<typeof createProjects>;

export function createProjects(options: ProjectsOptions) {
  const nav = document.querySelector<HTMLElement>('[data-projects]');
  const button = document.querySelector<HTMLElement>('[data-projects-open]');
  if (!nav || !button || options.projects.length === 0) return null;
  const opener: HTMLElement = button;
  const { state, camera, requestRender, reducedMotion } = options;
  const root = document.documentElement;
  const title = nav.querySelector<HTMLElement>('[data-projects-title]');
  const back = nav.querySelector<HTMLElement>('[data-projects-back]');
  const veil = document.querySelector<HTMLElement>('[data-projects-veil]');
  const live = nav.querySelector<HTMLElement>('[data-projects-live]');
  const count = nav.querySelector<HTMLElement>('[data-projects-index]');
  const steps = [...nav.querySelectorAll<HTMLElement>('[data-projects-step]')];
  const items = [...nav.querySelectorAll<HTMLElement>('[data-project]')];
  const total = options.projects.length;

  // The plain page lists the houses as text; here each label becomes the button that brings its plan into focus.
  const labels = items.map((item) => {
    const text = item.querySelector<HTMLElement>('[data-project-label]')!;
    const button = document.createElement('button');
    button.type = 'button';
    // Every attribute, the component's scoping one included, so its styles carry over.
    for (const { name, value } of text.attributes) button.setAttribute(name, value);
    button.append(...text.childNodes);
    text.replaceWith(button);
    return button;
  });

  const row = rowLayout(
    options.projects.map((project) => project.site),
    options.start,
    ROW_GAP,
  );
  const top = options.floor + BOARD;
  const group = new Group();
  group.visible = false;
  options.scene.add(group);
  const boardMaterial = new MeshStandardMaterial({ color: options.colors.board, roughness: 0.95, metalness: 0, transparent: true, opacity: 0 });
  let sheets: PlanSheet[] | null = null;

  /** Drawn on the first visit, not at boot: each sheet is a canvas the size of its plot. */
  const build = () =>
    (sheets ??= options.projects.map((project, index) => {
      const { x, z, width, depth } = row[index];
      const sheet = createPlanSheet(project.plan, project.site, {
        color: options.colors.bone,
        pixelsPerMetre: options.lowDetail ? 24 : 40,
        font: options.font,
        offset: sheetOffset(project.plan),
        height: top,
        maxSize: options.renderer.capabilities.maxTextureSize,
      });
      sheet.mesh.position.x = x;
      sheet.mesh.position.z = z;
      // A dark board under each plan, like the model's plot, so the bone inks read on the lamp-lit table.
      const board = new Mesh(new BoxGeometry(width, BOARD, depth), boardMaterial);
      board.position.set(x, options.floor + BOARD / 2, z);
      board.receiveShadow = options.shadows;
      board.renderOrder = -2;
      group.add(board, sheet.mesh);
      options.renderer.initTexture(sheet.texture);
      return sheet;
    }));

  let current: ProjectsNav = { mode: 'closed', index: 0 };
  const target: CameraView = { ...state };
  const blended: CameraView = { ...state };
  const narrowScreen = matchMedia('(max-width: 767px)');
  const narrow = () => narrowScreen.matches;
  const size = () => ({ width: options.canvas.clientWidth || innerWidth, height: options.canvas.clientHeight || innerHeight });

  // Reduced motion: no travel. The frame fades to the base colour, the camera cuts, the frame fades back.
  let fade: gsap.core.Timeline | null = null;
  const crossfade = (change: () => void, done?: () => void) => {
    fade?.kill();
    fade = gsap
      .timeline({ onComplete: done })
      .to(veil, { opacity: 1, duration: 0.45, ease: 'power1.inOut' })
      .call(() => {
        change();
        requestRender();
      })
      .to(veil, { opacity: 0, duration: 0.6, ease: 'power1.inOut' });
  };

  /** The heading, the labels, the way back and the pager follow the step the view is on. */
  const show = () => {
    const open = current.mode !== 'closed';
    if (open) {
      root.dataset.projects = current.mode;
      nav.dataset.mode = current.mode;
    } else {
      delete root.dataset.projects;
      delete nav.dataset.mode;
    }
    opener.setAttribute('aria-expanded', String(open));
    const single = current.mode === 'focus' || narrow();
    labels.forEach((label, index) => label.toggleAttribute('aria-current', open && single && index === current.index));
    for (const step of steps) {
      const to = current.index + Number(step.dataset.projectsStep);
      step.setAttribute('aria-disabled', String(to < 0 || to >= total));
    }
    if (count) count.textContent = String(current.index + 1);
  };

  /** Moves the camera to the view for the current step: at once (resize, first frame) or with a glide. */
  const frame = (immediate: boolean) => {
    const { width, height } = size();
    const view = projectsView(row, current, width / height, narrow(), top);
    gsap.killTweensOf(target);
    if (immediate) Object.assign(target, view);
    else if (reducedMotion) crossfade(() => Object.assign(target, view));
    else gsap.to(target, { ...view, duration: 1.9, ease: SETTLE, onUpdate: requestRender });
    requestRender();
  };

  /** Everything outside the view is inert while it is open, so Tab stays among its controls. */
  const hold = (held: boolean) => {
    for (const section of document.querySelectorAll<HTMLElement>('[data-scene], [data-scroll-hint]')) section.inert = held;
  };

  let aside: gsap.core.Tween | null = null;
  const draft = () => {
    for (const [index, sheet] of build().entries()) {
      gsap.killTweensOf(sheet.uniforms.uDraw);
      // A sheet still on screen from a visit cut short keeps its ink.
      if (state.aside < 0.05) sheet.uniforms.uDraw.value = 0;
      if (reducedMotion) sheet.uniforms.uDraw.value = 1;
      else gsap.to(sheet.uniforms.uDraw, { value: 1, duration: 2.8, delay: 1.1 + index * 0.35, ease: 'power1.inOut', onUpdate: requestRender });
    }
  };

  function open() {
    if (current.mode !== 'closed') return;
    current = navigate(current, { type: 'open' }, total);
    options.scroll.stop();
    build();
    hold(true);
    show();
    frame(state.aside === 0);
    aside?.kill();
    if (reducedMotion) {
      crossfade(() => {
        draft();
        state.aside = 1;
      });
    } else {
      draft();
      aside = gsap.to(state, { aside: 1, duration: 2.6, ease: SETTLE, onUpdate: requestRender });
    }
    title?.focus({ preventScroll: true });
  }

  function close() {
    current = navigate(current, { type: 'close' }, total);
    hover(-1);
    hold(false);
    show();
    opener.focus({ preventScroll: true });
    // The scroll walks again from where it was once the camera is back over the model.
    const done = () => current.mode === 'closed' && options.scroll.start();
    aside?.kill();
    if (reducedMotion) crossfade(() => (state.aside = 0), done);
    else aside = gsap.to(state, { aside: 0, duration: 2.2, ease: SETTLE, onUpdate: requestRender, onComplete: done });
  }

  /** Goes to `next`, moving the camera where it frames something else. */
  function go(next: ProjectsNav) {
    if (next.mode === 'closed') return close();
    const moved = next.mode !== current.mode || (next.index !== current.index && (next.mode === 'focus' || narrow()));
    const stepped = next.index !== current.index;
    current = next;
    show();
    if (moved) frame(false);
    if (stepped && live) live.textContent = [...labels[current.index].children].map((part) => part.textContent).join(', ');
  }

  const step = (by: 1 | -1, keyboard = false) => {
    const roving = keyboard && (labels.includes(document.activeElement as HTMLButtonElement) || document.activeElement === title);
    go(navigate(current, { type: 'step', by }, total));
    // Keyboard focus on a label follows the step, so the next arrow carries on from the plan on screen.
    if (roving) labels[current.index].focus({ preventScroll: true });
  };

  opener.addEventListener('click', open);
  back?.addEventListener('click', () => go(navigate(current, { type: 'back' }, total)));
  for (const element of steps) {
    element.addEventListener('click', () => {
      if (element.getAttribute('aria-disabled') !== 'true') step(Number(element.dataset.projectsStep) as 1 | -1);
    });
  }
  labels.forEach((label, index) => {
    label.addEventListener('click', () => go(navigate(current, { type: 'focus', index }, total)));
    // Tabbing to a plan that is off screen brings it in.
    label.addEventListener('focus', () => {
      if (current.mode === 'closed' || index === current.index) return;
      if (current.mode === 'focus' || narrow()) go({ ...current, index });
      else current = { ...current, index };
    });
  });

  addEventListener('keydown', (event) => {
    if (current.mode === 'closed' || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'Escape') go(navigate(current, { type: 'back' }, total));
    else if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') step(event.key === 'ArrowRight' ? 1 : -1, true);
    else return;
    event.preventDefault();
  });

  // Picking: a ray from the camera against each sheet's board, nearest first.
  const ndc = new Vector2();
  const ray = new Ray();
  const hit = new Vector3();
  const boxes = row.map(
    ({ x, z, width, depth }) =>
      new Box3(new Vector3(x - width / 2, options.floor, z - depth / 2), new Vector3(x + width / 2, top, z + depth / 2)),
  );
  const sheetAt = (clientX: number, clientY: number) => {
    const rect = options.canvas.getBoundingClientRect();
    ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    camera.updateMatrixWorld();
    ray.origin.setFromMatrixPosition(camera.matrixWorld);
    ray.direction.set(ndc.x, ndc.y, 0.5).unproject(camera).sub(ray.origin).normalize();
    let nearest = Infinity;
    let found = -1;
    boxes.forEach((box, index) => {
      if (!ray.intersectBox(box, hit)) return;
      const distance = hit.distanceTo(ray.origin);
      if (distance < nearest) {
        nearest = distance;
        found = index;
      }
    });
    return found;
  };

  let hovered = -1;
  function hover(index: number) {
    if (index === hovered) return;
    hovered = index;
    labels.forEach((label, i) => label.toggleAttribute('data-active', i === index));
    dispatchEvent(new CustomEvent('cad-cursor', { detail: { target: index >= 0 } }));
  }

  let pending = false;
  let lastX = 0;
  let lastY = 0;
  addEventListener(
    'pointermove',
    (event) => {
      if (event.pointerType !== 'mouse' || current.mode === 'closed') return;
      lastX = event.clientX;
      lastY = event.clientY;
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        if (current.mode !== 'closed') hover(sheetAt(lastX, lastY));
      });
    },
    { passive: true },
  );

  // A tap or a click picks a plan; on a touch screen a sideways swipe moves along the row.
  let downX = 0;
  let downY = 0;
  options.canvas.addEventListener('pointerdown', (event) => {
    downX = event.clientX;
    downY = event.clientY;
  });
  options.canvas.addEventListener('pointerup', (event) => {
    if (current.mode === 'closed') return;
    const dx = event.clientX - downX;
    const dy = event.clientY - downY;
    if (Math.hypot(dx, dy) <= 10) {
      const index = sheetAt(event.clientX, event.clientY);
      if (index >= 0) go(navigate(current, { type: 'focus', index }, total));
    } else if (event.pointerType !== 'mouse' && Math.abs(dx) > 48 && Math.abs(dx) > 1.4 * Math.abs(dy)) {
      step(dx < 0 ? 1 : -1);
    }
  });

  const label = new Vector3();
  return {
    /** The camera to draw: the timeline's, with the projects' blended over it. */
    view(s: ExperienceState): CameraView {
      return s.aside > 0 ? blendView(s, target, s.aside, blended) : s;
    },
    /** Writes the view's share of the state into the scene: the boards and the ink fade with the camera's way. */
    apply(s: ExperienceState) {
      group.visible = sheets !== null && s.aside > 0.001;
      if (!group.visible) return;
      boardMaterial.opacity = s.aside;
      for (const sheet of sheets!) sheet.uniforms.uOpacity.value = s.aside;
    },
    /** Hangs each label under its plan, from the plan's near left corner (as ExplodedWords does from its layer). */
    place() {
      camera.updateMatrixWorld();
      const { width, height } = size();
      row.forEach((sheet, index) => {
        label.set(sheet.x - sheet.width / 2, top, sheet.z + sheet.depth / 2).project(camera);
        items[index].style.setProperty('--x', `${(((label.x + 1) / 2) * width).toFixed(1)}px`);
        items[index].style.setProperty('--y', `${(((1 - label.y) / 2) * height).toFixed(1)}px`);
      });
    },
    resize() {
      if (current.mode === 'closed') return;
      show();
      frame(true);
    },
  };
}
