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
import { createMassing } from './building/massing';
import { createSharedUniforms, type SharedUniforms } from './building/materialWave';
import { deriveModel, type MaterialKind } from './building/params';
import { sheetOffset } from './building/plan';
import { createPlanSheet, type PlanSheet } from './building/planSheet';
import { lens, poseCamera, type CameraView } from './camera';
import type { Scroll } from './scroll';
import type { ExperienceState } from './state';

/*
 * The other projects, one slide to the side. From the model on the table the
 * camera rises and slides right to a row of the studio's other houses, each
 * drafted on its own board with the main plan's ink sweep. A click brings one
 * plan into focus: the camera turns to 3/4 and the house rises from its plan
 * as a balsa model, as the main house rose from its own. Escape steps back to
 * the row, lowering it, then to the house. The camera is blended over the timeline's (`aside`), so
 * the two never fight, and the scroll is stopped while the row is open, so
 * the timeline's values hold still underneath it.
 */

// ---------------------------------------------------------------------------
// The row, the views and the steps between them: pure, tested in projects.test.ts.

export interface SheetSize {
  width: number;
  depth: number;
  /** How tall the house's model stands on it. */
  height?: number;
}

/** A sheet on the table: its centre, its plot's size and its model's height. */
export interface PlacedSheet extends Required<SheetSize> {
  x: number;
  z: number;
}

/** Lays the sheets left to right from `start` (the first one's west edge), `gap` apart edge to edge, on one line. */
export function rowLayout(sizes: readonly SheetSize[], start: number, gap: number): PlacedSheet[] {
  let west = start;
  return sizes.map(({ width, depth, height = 0 }) => {
    const sheet = { x: west + width / 2, z: 0, width, depth, height };
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

/** The row is seen as sheets on a table, looking north; a plan in focus in 3/4, its model standing on it. */
const LIST_VIEW = { azimuth: 0, elevation: 1.12 };
const FOCUS_VIEW = { azimuth: 0.45, elevation: 0.62 };

const fitter = lens();
const corner = new Vector3();

/**
 * The closest view from `angle` that holds the box (a rectangle on the table, raised to `y[1]`) inside the
 * safe margins. The camera looks at the box's centre, so left to right it is centred by itself; only the
 * distance and the band between the heading and the labels remain.
 */
function frameBox(
  x: readonly [number, number],
  z: readonly [number, number],
  y: readonly [number, number],
  aspect: number,
  safe: Safe,
  angle: { azimuth: number; elevation: number },
) {
  const view: CameraView = {
    ...angle,
    distance: 1,
    targetX: (x[0] + x[1]) / 2,
    targetY: (y[0] + y[1]) / 2,
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
      for (const cy of y) {
        for (const cz of z) {
          corner.set(cx, cy, cz).project(fitter);
          // Behind the camera or past its far plane: it does not fit.
          if (Math.abs(corner.z) > 1) return null;
          left = Math.min(left, corner.x);
          right = Math.max(right, corner.x);
          low = Math.min(low, corner.y);
          high = Math.max(high, corner.y);
        }
      }
    }
    return { left, right, low, high };
  };
  const fits = () => {
    const seen = extent();
    return seen !== null && Math.max(-seen.left, seen.right) <= 1 - 2 * safe.side && seen.high - seen.low <= 2 - 2 * (safe.top + safe.bottom);
  };
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
 * in focus, one plan with its model standing on it, closer and in 3/4. `y` is the height the sheets lie at.
 */
export function projectsView(row: readonly PlacedSheet[], nav: ProjectsNav, aspect: number, narrow: boolean, y: number) {
  const mode = nav.mode === 'focus' ? 'focus' : 'list';
  const framed = mode === 'list' && !narrow ? row : [row[Math.min(Math.max(nav.index, 0), row.length - 1)]];
  const x: [number, number] = [Math.min(...framed.map((s) => s.x - s.width / 2)), Math.max(...framed.map((s) => s.x + s.width / 2))];
  const z: [number, number] = [Math.min(...framed.map((s) => s.z - s.depth / 2)), Math.max(...framed.map((s) => s.z + s.depth / 2))];
  if (mode === 'list') return frameBox(x, z, [y, y], aspect, safeArea(mode, narrow), LIST_VIEW);
  return frameBox(x, z, [y, y + framed[0].height], aspect, safeArea(mode, narrow), FOCUS_VIEW);
}

/** Only the house whose plan is in focus stands on it. */
export const standing = (nav: ProjectsNav, index: number) => nav.mode === 'focus' && nav.index === index;

/** While one plan is in focus the others fade from the table, and are not there to pick. */
export const present = (nav: ProjectsNav, index: number) => nav.mode !== 'focus' || nav.index === index;

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
  /** The houses' materials: their models are balsa, but the waves they were built in stay as on the main house. */
  materials: Record<MaterialKind, string> & { interior: string; balsa: string };
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
/** A model rises as the camera settles in 3/4, and sinks at once when its plan leaves the focus. */
const RISE = { duration: 2.4, delay: 0.9, ease: 'power1.inOut' };
const SINK = { duration: 0.8, ease: 'power2.in' };
/** The other plans fade while one is in focus, and come back with the list. */
const FADE = { duration: 0.9, ease: 'power1.inOut' };

export type Projects = ReturnType<typeof createProjects>;

export function createProjects(options: ProjectsOptions) {
  const nav = document.querySelector<HTMLElement>('[data-projects]');
  const button = document.querySelector<HTMLElement>('[data-projects-open]');
  if (!nav || !button || options.projects.length === 0) return null;
  const opener: HTMLElement = button;
  const panel: HTMLElement = nav;
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

  // Each house raised from its plan, as numbers: cheap, so the framing knows its height from the start.
  const houses = options.projects.map((project) => deriveModel(project.plan, options.lowDetail ? 'low' : 'full', sheetOffset(project.plan)));
  const row = rowLayout(
    options.projects.map((project, index) => ({ ...project.site, height: houses[index].height })),
    options.start,
    ROW_GAP,
  );
  const top = options.floor + BOARD;
  const group = new Group();
  group.visible = false;
  options.scene.add(group);
  const boardMaterial = new MeshStandardMaterial({ color: options.colors.board, roughness: 0.95, metalness: 0, transparent: true, opacity: 0 });
  let sheets: PlanSheet[] | null = null;
  const boards: Mesh<BoxGeometry, MeshStandardMaterial>[] = [];

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
      // Each board its own material, so the other plans can fade while one is in focus.
      const board = new Mesh(new BoxGeometry(width, BOARD, depth), boardMaterial.clone());
      board.position.set(x, options.floor + BOARD / 2, z);
      board.receiveShadow = options.shadows;
      board.renderOrder = -2;
      boards.push(board);
      group.add(board, sheet.mesh);
      options.renderer.initTexture(sheet.texture);
      return sheet;
    }));

  /** Each house's model, built the first time its plan comes into focus, standing on the plan it is raised from. */
  const models: ({ root: Group; uniforms: SharedUniforms; height: number } | null)[] = houses.map(() => null);
  const model = (index: number) =>
    (models[index] ??= (() => {
      const house = houses[index];
      const uniforms = createSharedUniforms(house.height, house.storey, {
        bone: options.colors.bone,
        interior: options.materials.interior,
        balsa: options.materials.balsa,
      });
      // Every material wave has passed, and the whole house is the study model.
      uniforms.uWave.value = 3;
      uniforms.uModel.value = 1;
      const massing = createMassing(house, options.materials, uniforms, { lowDetail: options.lowDetail, shadows: options.shadows });
      for (const wave of massing.materials) wave.material.depthWrite = wave.kindIndex < 2;
      massing.root.position.set(row[index].x, top, row[index].z);
      massing.root.visible = false;
      group.add(massing.root);
      return { root: massing.root, uniforms, height: house.height };
    })());
  /** How far each model has risen and how present each plan is, 0..1, and where each is going. */
  const rises = houses.map(() => ({ value: 0 }));
  const presences = houses.map(() => ({ value: 1 }));
  const goals = houses.map(() => ({ rise: 0, presence: 1 }));

  let current: ProjectsNav = { mode: 'closed', index: 0 };
  const target: CameraView = { ...state };
  const blended: CameraView = { ...state };
  const narrowScreen = matchMedia('(max-width: 767px)');
  const narrow = () => narrowScreen.matches;
  const size = () => ({ width: options.canvas.clientWidth || innerWidth, height: options.canvas.clientHeight || innerHeight });

  // Reduced motion: no travel. The frame fades to the base colour, the camera cuts, the frame fades back.
  // A change asked for while the veil is still rising joins that cut, so no cut is ever dropped
  // (an arrow pressed just after opening would otherwise leave the view open over the house).
  let fade: gsap.core.Timeline | null = null;
  let cuts: (() => void)[] = [];
  const crossfade = (change: () => void) => {
    cuts.push(change);
    if (cuts.length > 1) return;
    fade?.kill();
    fade = gsap
      .timeline()
      .to(veil, { opacity: 1, duration: 0.45, ease: 'power1.inOut' })
      .call(() => {
        const due = cuts;
        cuts = [];
        for (const cut of due) cut();
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

  /** Under reduced motion a value jumps at the crossfade's cut; otherwise it is tweened there. */
  const ease = (value: { value: number }, to: number, how: gsap.TweenVars) => {
    gsap.killTweensOf(value);
    if (reducedMotion) value.value = to;
    else gsap.to(value, { value: to, ...how, onUpdate: requestRender });
  };

  /** The house in focus rises and the other plans fade; back in the list every plan returns and every model sinks. */
  const arrange = () => {
    goals.forEach((goal, index) => {
      const rise = standing(current, index) ? 1 : 0;
      const presence = present(current, index) ? 1 : 0;
      if (rise !== goal.rise) {
        goal.rise = rise;
        if (rise) model(index);
        ease(rises[index], rise, rise ? RISE : SINK);
      }
      if (presence !== goal.presence) {
        goal.presence = presence;
        ease(presences[index], presence, FADE);
      }
    });
    requestRender();
  };

  /** Everything outside the view is inert while it is open, so Tab stays among its controls. */
  const seal = (held: boolean) => {
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
    delete panel.dataset.seen;
    options.scroll.stop();
    build();
    seal(true);
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
    seal(false);
    show();
    opener.focus({ preventScroll: true });
    // The scroll walks again from where it was once the camera is back over the model; a gesture made
    // on the way back is kept and walked then. Under reduced motion it is free again at the cut, and the
    // model sinks and the plans return there too, behind the veil.
    const done = () => current.mode === 'closed' && options.scroll.start();
    aside?.kill();
    if (reducedMotion) {
      crossfade(() => {
        arrange();
        state.aside = 0;
        done();
      });
    } else {
      arrange();
      options.scroll.hold();
      aside = gsap.to(state, { aside: 0, duration: 2.2, ease: SETTLE, onUpdate: requestRender, onComplete: done });
    }
  }

  /** Goes to `next`, moving the camera where it frames something else. */
  function go(next: ProjectsNav) {
    if (next.mode === 'closed') return close();
    const moved = next.mode !== current.mode || (next.index !== current.index && (next.mode === 'focus' || narrow()));
    const stepped = next.index !== current.index;
    current = next;
    // Once a plan has been in focus the row is drafted: back in the list its labels return with their sheets.
    if (next.mode === 'focus') panel.dataset.seen = '';
    show();
    if (moved) frame(false);
    if (reducedMotion) crossfade(arrange);
    else arrange();
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
      if (!present(current, index) || !ray.intersectBox(box, hit)) return;
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
      if (index < 0) return;
      go(navigate(current, { type: 'focus', index }, total));
      // The press left the focus on the page itself: it moves to the plan's label.
      labels[current.index].focus({ preventScroll: true });
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
      sheets!.forEach((sheet, index) => {
        const opacity = s.aside * presences[index].value;
        boards[index].material.opacity = opacity;
        sheet.uniforms.uOpacity.value = opacity;
        boards[index].visible = sheet.mesh.visible = opacity > 0.001;
      });
      models.forEach((built, index) => {
        if (!built) return;
        // The extrusion of scene 3: what the rise has not reached is pressed down into the plan.
        built.uniforms.uGrow.value = rises[index].value * built.height;
        built.root.visible = rises[index].value > 0.001;
      });
    },
    /**
     * Hangs each label under its plan, from the plan's near left corner (as ExplodedWords does from its layer);
     * where the camera turns to 3/4, under the sheet's lowest corner, so the label stays off the drawing.
     */
    place() {
      camera.updateMatrixWorld();
      const { width, height } = size();
      row.forEach((sheet, index) => {
        let bottom = Infinity;
        for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
          label.set(sheet.x + (dx * sheet.width) / 2, top, sheet.z + (dz * sheet.depth) / 2).project(camera);
          bottom = Math.min(bottom, label.y);
        }
        // The last corner is the near left one.
        items[index].style.setProperty('--x', `${(((label.x + 1) / 2) * width).toFixed(1)}px`);
        items[index].style.setProperty('--y', `${(((1 - bottom) / 2) * height).toFixed(1)}px`);
      });
    },
    resize() {
      if (current.mode === 'closed') return;
      show();
      frame(true);
    },
  };
}
