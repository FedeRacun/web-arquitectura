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
  type CanvasTexture,
  type PerspectiveCamera,
  type Scene,
  type WebGLRenderer,
} from 'three';
import type { Project } from '../../config/projects';
import { createMassing } from './building/massing';
import { createSharedUniforms, type SharedUniforms } from './building/materialWave';
import { deriveModel, type MaterialKind } from './building/params';
import { CUT_HEIGHT, levelHeights, sheetOffset, type LevelId, type SheetPlan } from './building/plan';
import { createPlanSheet, drawSheet, type PlanSheet } from './building/planSheet';
import { FOV, lens, poseCamera, type CameraView } from './camera';
import type { Scroll } from './scroll';
import type { ExperienceState } from './state';

/*
 * The other projects, one slide to the side. From the model on the table the
 * camera rises and slides right to a row of the studio's other houses, each
 * drafted on its own board with the main plan's ink sweep. A click brings one
 * plan into focus: the camera turns to 3/4 and the house rises from its plan
 * as a balsa model, as the main house rose from its own; a drag or the turn
 * buttons take the camera all the way round it. Escape steps back to
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

/**
 * Margins the framed sheets keep clear, as fractions of the screen: the heading above, the labels below; in
 * focus on a narrow screen, the label over the hint and the layers, over the pager and the turn.
 */
export interface Safe {
  top: number;
  bottom: number;
  side: number;
}

const SAFE: Record<'list' | 'focus', Record<'wide' | 'narrow', Safe>> = {
  list: { wide: { top: 0.24, bottom: 0.16, side: 0.06 }, narrow: { top: 0.3, bottom: 0.26, side: 0.06 } },
  focus: { wide: { top: 0.17, bottom: 0.14, side: 0.05 }, narrow: { top: 0.2, bottom: 0.3, side: 0.04 } },
};

export const safeArea = (mode: 'list' | 'focus', narrow: boolean) => SAFE[mode][narrow ? 'narrow' : 'wide'];


/** Where the camera looks at a box from, round it and over it (radians). */
export interface Angle {
  azimuth: number;
  elevation: number;
}

/** The row is seen as sheets on a table, looking north; a plan in focus in 3/4, its model standing on it. */
const LIST_VIEW: Angle = { azimuth: 0, elevation: 1.12 };
export const FOCUS_VIEW: Angle = { azimuth: 0.45, elevation: 0.62 };
/** Turned by hand, the model is seen from just over the table to almost overhead. */
const ELEVATION = { low: 0.2, high: 1.4 };
/** A floor cut open is looked into from at least this high, so its rooms read. */
const INTO_FLOOR = 0.9;
/** The sides of the polygon drawn round a turning box's circle. */
const ROUND = 32;
/** A model in focus is zoomed by hand up to this many times as close as it is framed. */
const ZOOM_MAX = 3;
/**
 * The plan alone is read straight down, north up: square to the lens, a flat drawing shows true, with no
 * perspective. (Exactly overhead the camera would have no side to keep its up from.)
 */
const PLAN_VIEW: Angle = { azimuth: 0, elevation: Math.PI / 2 - 1e-4 };
/** The plan is zoomed by hand up to this many times as close, to read its figures. */
const PLAN_ZOOM_MAX = 4;

/** How far the plan in focus is moved from the middle of its sheet, in metres east and south. */
export interface Pan {
  x: number;
  z: number;
}

/**
 * A pan held so the sheet never leaves the screen: at the framing the sheet is centred; zoomed in, the point the
 * view is centred on stays on the sheet, the further from its middle the closer the sheet is seen.
 */
export function clampPan(pan: Pan, sheet: { width: number; depth: number }, zoom: number): Pan {
  const hold = (value: number, half: number) => {
    const room = (half * (zoom - 1)) / zoom;
    return room > 0 ? Math.min(Math.max(value, -room), room) : 0;
  };
  return { x: hold(pan.x, sheet.width / 2), z: hold(pan.z, sheet.depth / 2) };
}

/** Metres of the plan one pixel spans, on a screen `height` tall, seen straight down from `view`. */
const pixelSize = (view: CameraView, height: number) => (2 * view.distance * Math.tan((FOV * Math.PI) / 360)) / height;

/**
 * The pan that keeps the point of the plan under pixel (`px`, `py`) where it is while the plan is zoomed `by`
 * times as close, seen straight down from `view` on a screen `width` by `height`.
 */
export function planZoomAt(pan: Pan, by: number, px: number, py: number, view: CameraView, width: number, height: number): Pan {
  const metres = pixelSize(view, height) * (1 - 1 / by);
  // The view's aim shows in the middle of the screen, moved down by its frame.
  return { x: pan.x + (px - width / 2) * metres, z: pan.z + (py - height / 2 - view.frameY * height) * metres };
}

/** The pan after a drag of `dx`, `dy` pixels over the plan seen straight down from `view`: it moves with the hand. */
export function planDrag(pan: Pan, dx: number, dy: number, view: CameraView, height: number): Pan {
  const metres = pixelSize(view, height);
  return { x: pan.x - dx * metres, z: pan.z - dy * metres };
}

const fitter = lens();
const corner = new Vector3();

/**
 * The closest view from `angle` that holds the box (a rectangle on the table, raised to `y[1]`) inside the
 * safe margins. The camera looks at the box's centre, so left to right it is centred by itself; only the
 * distance and the band between the heading and the labels remain. `round`: the box is to be turned about
 * its centre, so the view holds the circle it turns in instead, which looks the same from every side: the
 * distance and the band stay put whatever the azimuth.
 */
function frameBox(
  x: readonly [number, number],
  z: readonly [number, number],
  y: readonly [number, number],
  aspect: number,
  safe: Safe,
  angle: Angle,
  round = false,
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
  // The box's corners; turning, a polygon round the circle they sweep, wide enough to hold the circle and
  // turned with the camera (whose azimuth runs the other way round), so it is seen the same from every side.
  const plan: [number, number][] = [];
  if (round) {
    const radius = Math.hypot(x[1] - x[0], z[1] - z[0]) / 2 / Math.cos(Math.PI / ROUND);
    for (let k = 0; k < ROUND; k++) {
      const turn = (k / ROUND) * 2 * Math.PI - angle.azimuth;
      plan.push([view.targetX + radius * Math.cos(turn), view.targetZ + radius * Math.sin(turn)]);
    }
  } else {
    for (const cx of x) for (const cz of z) plan.push([cx, cz]);
  }
  fitter.aspect = aspect;
  fitter.updateProjectionMatrix();
  const extent = () => {
    poseCamera(fitter, view, aspect, 1);
    fitter.updateMatrixWorld();
    let left = Infinity;
    let right = -Infinity;
    let low = Infinity;
    let high = -Infinity;
    for (const [cx, cz] of plan) {
      for (const cy of y) {
        corner.set(cx, cy, cz).project(fitter);
        // Behind the camera or past its far plane: it does not fit.
        if (Math.abs(corner.z) > 1) return null;
        left = Math.min(left, corner.x);
        right = Math.max(right, corner.x);
        low = Math.min(low, corner.y);
        high = Math.max(high, corner.y);
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

/** What the plan in focus shows: itself on the table, one floor cut open, or the whole house. */
export type LayerId = 'plano' | LevelId | 'completa';

export interface ProjectsNav {
  mode: ProjectsMode;
  /** The plan in focus; in the list, the one a step moves from. */
  index: number;
  /** What the plan in focus shows; anywhere else, the whole house it will rise as. */
  layer: LayerId;
}

export type ProjectsAction =
  | { type: 'open' }
  | { type: 'close' }
  /** Escape or "Volver": from a plan to the list, from the list to the house. */
  | { type: 'back' }
  | { type: 'focus'; index: number }
  | { type: 'step'; by: 1 | -1 }
  | { type: 'layer'; layer: LayerId };

/** Every plan that comes into focus comes whole; the one already there keeps the layer it shows. */
export function navigate(nav: ProjectsNav, action: ProjectsAction, count: number): ProjectsNav {
  const clamp = (index: number) => Math.min(Math.max(index, 0), count - 1);
  const to = (mode: ProjectsMode, index: number): ProjectsNav => ({
    mode,
    index,
    layer: mode === 'focus' && nav.mode === 'focus' && index === nav.index ? nav.layer : 'completa',
  });
  switch (action.type) {
    case 'open':
      return nav.mode === 'closed' ? to('list', nav.index) : nav;
    case 'close':
      return to('closed', nav.index);
    case 'back':
      return to(nav.mode === 'focus' ? 'list' : 'closed', nav.index);
    case 'focus':
      return nav.mode === 'closed' ? nav : to('focus', clamp(action.index));
    case 'step':
      return nav.mode === 'closed' ? nav : to(nav.mode, clamp(nav.index + action.by));
    case 'layer':
      return nav.mode === 'focus' ? { ...nav, layer: action.layer } : nav;
  }
}

/** The floor the sheet draws: the one a layer cuts, the one chosen for the plan alone, the ground floor under the whole house. */
export const sheetFloor = (layer: LayerId, floor: LevelId): LevelId => (layer === 'plano' ? floor : layer === 'completa' ? 'ground' : layer);

/** A house's layers, from the line to the volume: its plan, each of its floors by its name, the whole house. */
export function layersOf(plan: SheetPlan): { id: LayerId; name: string }[] {
  return [
    { id: 'plano', name: 'Plano' },
    { id: 'ground', name: plan.ground.name },
    ...(plan.upper ? [{ id: 'upper' as const, name: plan.upper.name }] : []),
    { id: 'completa', name: 'Completa' },
  ];
}

/**
 * How high a model `height` tall stands for `layer`: a floor is cut 1.20 m over it, where its plan is drawn,
 * so what is above it is gone and what is below it stands whole; the plan lays the model down into the sheet.
 */
export function cutHeight(plan: SheetPlan, layer: LayerId, height: number) {
  if (layer === 'plano') return 0;
  if (layer === 'completa') return height;
  return levelHeights(plan, layer).floor + CUT_HEIGHT;
}

/** A floor cut open is looked into from high enough to see its rooms, from the side the model was turned to. */
export const layerTurn = (turn: Angle, layer: LayerId): Angle =>
  layer === 'ground' || layer === 'upper' ? { ...turn, elevation: Math.max(turn.elevation, INTO_FLOOR) } : turn;

/**
 * Where the camera goes for `nav`: the whole row in the list, or one plan per screen where only one fits;
 * in focus, one plan with its model standing on it `height` tall (whole, or cut at a floor), closer, seen
 * from `turn` (3/4 until it is turned by hand) and far enough to stay whole from any side, or `zoom` times
 * as close, but never inside the sphere round the plan and its model; or, for the plan, the plan alone, read
 * straight down, `zoom` times as close and moved by `pan`. `y` is the height the sheets lie at.
 */
export function projectsView(
  row: readonly PlacedSheet[],
  nav: ProjectsNav,
  aspect: number,
  narrow: boolean,
  y: number,
  turn: Angle = FOCUS_VIEW,
  height?: number,
  zoom = 1,
  pan: Pan = { x: 0, z: 0 },
) {
  const mode = nav.mode === 'focus' ? 'focus' : 'list';
  const framed = mode === 'list' && !narrow ? row : [row[Math.min(Math.max(nav.index, 0), row.length - 1)]];
  const x: [number, number] = [Math.min(...framed.map((s) => s.x - s.width / 2)), Math.max(...framed.map((s) => s.x + s.width / 2))];
  const z: [number, number] = [Math.min(...framed.map((s) => s.z - s.depth / 2)), Math.max(...framed.map((s) => s.z + s.depth / 2))];
  if (mode === 'list') return frameBox(x, z, [y, y], aspect, safeArea(mode, narrow), LIST_VIEW);
  if (nav.layer === 'plano') {
    const view = frameBox(x, z, [y, y], aspect, safeArea(mode, narrow), PLAN_VIEW);
    const held = clampPan(pan, framed[0], zoom);
    view.distance /= zoom;
    view.targetX += held.x;
    view.targetZ += held.z;
    return view;
  }
  const standing = height ?? framed[0].height;
  const view = frameBox(x, z, [y, y + standing], aspect, safeArea(mode, narrow), turn, true);
  view.distance = Math.max(view.distance / zoom, Math.hypot(x[1] - x[0], z[1] - z[0], standing) / 2);
  return view;
}

/**
 * How many times as close as it is framed the model in focus can be zoomed: three, or less where the camera
 * would otherwise come inside the sphere round the plan and its model; the plan alone, four. One in the list.
 */
export function zoomLimit(
  row: readonly PlacedSheet[],
  nav: ProjectsNav,
  aspect: number,
  narrow: boolean,
  y: number,
  turn: Angle = FOCUS_VIEW,
  height?: number,
) {
  if (nav.mode !== 'focus') return 1;
  if (nav.layer === 'plano') return PLAN_ZOOM_MAX;
  const framed = projectsView(row, nav, aspect, narrow, y, turn, height).distance;
  const closest = projectsView(row, nav, aspect, narrow, y, turn, height, Infinity).distance;
  return Math.min(Math.max(framed / closest, 1), ZOOM_MAX);
}

/** A zoom held between the framing and `limit`. */
export const clampZoom = (zoom: number, limit: number) => Math.min(Math.max(zoom, 1), limit);

/**
 * How much a wheel turned by `deltaY` zooms: in as it turns away, out by as much as it turns back. Lines and
 * pages count as pixels; a pinch on a trackpad (a wheel with Ctrl held) comes in small steps, so each counts more.
 */
export function wheelZoom(deltaY: number, deltaMode: number, pinch: boolean) {
  const pixels = deltaY * (deltaMode === 1 ? 16 : deltaMode === 2 ? 800 : 1);
  return Math.exp(-pixels * (pinch ? 0.01 : 0.002));
}

/**
 * The angle a drag of `dx`, `dy` pixels turns the model in focus to, on a screen `width` wide: half a turn
 * across the screen. Left brings its east side round to the front, as a hand turning it would; down looks
 * from higher up. Round and round without end; up and down between just over the table and almost overhead.
 */
export function orbit(angle: Angle, dx: number, dy: number, width: number): Angle {
  const rate = Math.PI / width;
  return {
    azimuth: angle.azimuth - dx * rate,
    elevation: Math.min(Math.max(angle.elevation + dy * rate, ELEVATION.low), ELEVATION.high),
  };
}

/** The same angle wound back between -π and π. */
export const wrapAngle = (angle: number) => angle - 2 * Math.PI * Math.ceil((angle - Math.PI) / (2 * Math.PI));

/** `to`, give or take whole turns: the one nearest `from`, so the way there never takes more than half a turn. */
export const nearestTurn = (from: number, to: number) => from + wrapAngle(to - from);

/** A press moved by this many pixels or fewer is a tap. */
const TAP = 10;

/**
 * What a press released `dx`, `dy` pixels from where it went down means: a tap picks a plan; in the list, a
 * sideways swipe on a touch screen moves along the row. In focus a drag has turned the model, and means no more.
 */
export function released(mode: 'list' | 'focus', dx: number, dy: number, pointerType: string) {
  if (Math.hypot(dx, dy) <= TAP) return { type: 'pick' } as const;
  if (mode === 'list' && pointerType !== 'mouse' && Math.abs(dx) > 48 && Math.abs(dx) > 1.4 * Math.abs(dy)) {
    return { type: 'step', by: dx < 0 ? 1 : -1 } as const;
  }
  return null;
}

/** Whether a press that has moved `dx`, `dy` pixels is a drag yet. */
export const dragging = (dx: number, dy: number) => Math.hypot(dx, dy) > TAP;

/** Only the house whose plan is in focus stands on it, unless its plan alone is shown. */
export const standing = (nav: ProjectsNav, index: number) => nav.mode === 'focus' && nav.index === index && nav.layer !== 'plano';

/** What a move from `from` to `to` tells a screen reader: the plan stepped to, or the layer shown in focus. */
export function announced(from: ProjectsNav, to: ProjectsNav) {
  if (to.index !== from.index) return 'project';
  if (from.mode === 'focus' && to.mode === 'focus' && to.layer !== from.layer) return 'layer';
  return null;
}

const hook = new Vector3();

/**
 * Where a sheet's label hangs on a screen `width` by `height` seen through `camera`, in pixels: from the plan's
 * near left corner as the camera sees it, wherever it was turned to (as ExplodedWords hangs its words from
 * their layer); where the camera turns to 3/4, under the sheet's lowest corner, so the label stays off the
 * drawing. `top` is the height the sheet lies at.
 */
export function labelAnchor(sheet: PlacedSheet, top: number, camera: PerspectiveCamera, width: number, height: number) {
  // The camera looks along (-sin azimuth, -cos azimuth) over the table: the corner in front of it, on its left.
  camera.getWorldDirection(hook);
  const sin = -hook.x;
  const cos = -hook.z;
  const near: [number, number] = [cos - sin < 0 ? 1 : -1, sin + cos < 0 ? -1 : 1];
  let bottom = Infinity;
  for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    hook.set(sheet.x + (dx * sheet.width) / 2, top, sheet.z + (dz * sheet.depth) / 2).project(camera);
    bottom = Math.min(bottom, hook.y);
  }
  hook.set(sheet.x + (near[0] * sheet.width) / 2, top, sheet.z + (near[1] * sheet.depth) / 2).project(camera);
  return { x: ((hook.x + 1) / 2) * width, y: ((1 - bottom) / 2) * height };
}

/**
 * The view a zoomed model's label is hung from: the camera's own side and height, at the framing's distance and
 * aim, so the label stays whole where it hangs unzoomed instead of following a corner off the screen.
 */
export const heldView = (live: CameraView, framing: CameraView): CameraView => ({
  ...framing,
  azimuth: live.azimuth,
  elevation: live.elevation,
});

/** A drag turns the model in focus, while there is one standing. */
export const turnable = (nav: ProjectsNav) => nav.mode === 'focus' && nav.layer !== 'plano';

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
/** A turn button turns the model by an eighth of a turn. */
const TURN_STEP = Math.PI / 4;
/** A zoom button brings the model or the plan in focus this many times as close, or takes it as far back. */
const ZOOM_STEP = 1.5;
/** The plan in focus is redrawn with this many times the pixels per metre, so it stays crisp zoomed in. */
const SHARP = 3;
/** A model is cut open at a floor, or closed again, as the camera settles over it. */
const CUT = { duration: 1.4, ease: SETTLE };

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
  const turners = [...nav.querySelectorAll<HTMLElement>('[data-projects-turn]')];
  const zoomers = [...nav.querySelectorAll<HTMLElement>('[data-projects-zoom]')];
  const layerBar = nav.querySelector<HTMLElement>('[data-projects-layers]');
  const floorBar = nav.querySelector<HTMLElement>('[data-projects-floors]');
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

  /** How each sheet is drawn: a canvas the size of its plot. */
  const drawing = (index: number) => ({
    color: options.colors.bone,
    pixelsPerMetre: options.lowDetail ? 24 : 40,
    font: options.font,
    offset: sheetOffset(options.projects[index].plan),
    height: top,
    maxSize: options.renderer.capabilities.maxTextureSize,
  });
  /** Drawn on the first visit, not at boot. */
  const build = () =>
    (sheets ??= options.projects.map((project, index) => {
      const { x, z, width, depth } = row[index];
      const sheet = createPlanSheet(project.plan, project.site, drawing(index));
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

  /** The floor each sheet is drawn at; the ground floor's texture is the sheet's own, the others are drawn when first read. */
  const floors: LevelId[] = options.projects.map(() => 'ground');
  const floorTextures = new Map<string, CanvasTexture>();
  const baseTexture = (index: number, level: LevelId) => {
    if (level === 'ground') return sheets![index].texture;
    const key = `${index}:${level}`;
    let texture = floorTextures.get(key);
    if (!texture) {
      texture = drawSheet(options.projects[index].plan, options.projects[index].site, { ...drawing(index), level });
      options.renderer.initTexture(texture);
      floorTextures.set(key, texture);
    }
    return texture;
  };

  /** The plan read alone, redrawn sharper the first time it is, and kept so until another one is: one at a time. */
  let sharp: { index: number; level: LevelId; texture: CanvasTexture } | null = null;
  const paint = (index: number) => {
    const level = floors[index];
    sheets![index].uniforms.uMap.value = sharp?.index === index && sharp.level === level ? sharp.texture : baseTexture(index, level);
  };
  const sharpen = (index: number, level: LevelId) => {
    if (!sheets || (sharp?.index === index && sharp.level === level)) return;
    const base = drawing(index);
    const texture = drawSheet(options.projects[index].plan, options.projects[index].site, { ...base, pixelsPerMetre: base.pixelsPerMetre * SHARP, level });
    options.renderer.initTexture(texture);
    const old = sharp;
    sharp = { index, level, texture };
    paint(index);
    if (old) {
      old.texture.dispose();
      if (old.index !== index) paint(old.index);
    }
  };

  /** Each sheet draws the floor the view reads: the plan in focus its layer's or the one chosen, every other the ground floor. */
  const follow = () => {
    if (!sheets) return;
    const focus = current.mode === 'focus';
    sheets.forEach((sheet, index) => {
      const level = focus && index === current.index ? sheetFloor(current.layer, planFloor) : 'ground';
      if (floors[index] === level) return;
      floors[index] = level;
      paint(index);
      // The sheet in focus is drafted again on its new floor.
      if (focus && index === current.index) {
        gsap.killTweensOf(sheet.uniforms.uDraw);
        if (reducedMotion) sheet.uniforms.uDraw.value = 1;
        else {
          sheet.uniforms.uDraw.value = 0;
          gsap.to(sheet.uniforms.uDraw, { value: 1, duration: 1.6, ease: 'power1.inOut', onUpdate: requestRender });
        }
      }
    });
    if (focus && current.layer === 'plano') sharpen(current.index, floors[current.index]);
  };

  /** Each house's model, built the first time its plan comes into focus, standing on the plan it is raised from. */
  const models: ({ root: Group; uniforms: SharedUniforms } | null)[] = houses.map(() => null);
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
      return { root: massing.root, uniforms };
    })());
  /**
   * How far each model has risen and how present each plan is, 0..1, how tall each stands (whole, or cut at
   * a floor, in metres), and where each is going.
   */
  const rises = houses.map(() => ({ value: 0 }));
  const presences = houses.map(() => ({ value: 1 }));
  const heights = houses.map((house) => ({ value: house.height }));
  const goals = houses.map((house) => ({ rise: 0, presence: 1, height: house.height }));

  let current: ProjectsNav = { mode: 'closed', index: 0, layer: 'completa' };
  /** The floor the plan alone is read at; a floor layer sets it, another house starts at the ground floor. */
  let planFloor: LevelId = 'ground';
  const target: CameraView = { ...state };
  /** Where the model in focus is seen from: 3/4 until it is turned by hand. */
  const turn: Angle = { ...FOCUS_VIEW };
  /**
   * How many times as close as it is framed the model or the plan in focus is seen, how far the plan is moved,
   * whether it was zoomed by hand, and the view that frames it whole from where it is seen now, which its label
   * hangs from while it is zoomed.
   */
  let zoom = 1;
  let pan: Pan = { x: 0, z: 0 };
  let zoomed = false;
  let framing: CameraView = target;
  const still = lens();
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

  /** How tall the model in focus stands for the layer it shows. */
  const shown = () => cutHeight(options.projects[current.index].plan, current.layer, houses[current.index].height);

  /**
   * The zoom held within what the view allows from where the model is seen now (from just over the table the
   * camera would sooner come inside it), and the buttons that would zoom no further marked so.
   */
  const hold = () => {
    const { width, height } = size();
    framing = projectsView(row, current, width / height, narrow(), top, turn, shown());
    const limit = zoomLimit(row, current, width / height, narrow(), top, turn, shown());
    zoom = clampZoom(zoom, limit);
    pan = clampPan(pan, row[current.index], zoom);
    for (const element of zoomers) {
      const done = Number(element.dataset.projectsZoom) > 0 ? zoom >= limit - 1e-6 : zoom <= 1 + 1e-6;
      element.setAttribute('aria-disabled', String(done));
    }
  };

  /** Where the camera is going: the view for the step the view is on, turned, zoomed and moved by hand. */
  const goal = () => {
    const { width, height } = size();
    return projectsView(row, current, width / height, narrow(), top, turn, shown(), zoom, pan);
  };

  /** The layers of the plan in focus, made when it comes into focus, the one it shows pressed. */
  let layersOfIndex = -1;
  const showLayers = () => {
    if (!layerBar) return;
    if (layersOfIndex !== current.index) {
      layersOfIndex = current.index;
      const held = layerBar.contains(document.activeElement);
      // The bar's scoping attribute too, so the component's styles reach the buttons made here.
      const scope = [...layerBar.attributes].filter(({ name }) => name.startsWith('data-astro-cid'));
      layerBar.replaceChildren(
        ...layersOf(options.projects[current.index].plan).map(({ id, name }) => {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'projects-layer';
          for (const { name: attribute, value } of scope) button.setAttribute(attribute, value);
          button.dataset.layer = id;
          button.textContent = name;
          button.addEventListener('click', () => go(navigate(current, { type: 'layer', layer: id }, total)));
          return button;
        }),
      );
      // A step taken from the bar keeps the keyboard there, on the next plan's layer.
      if (held) layerBar.querySelector<HTMLElement>(`[data-layer="${current.layer}"]`)?.focus({ preventScroll: true });
    }
    for (const button of layerBar.querySelectorAll<HTMLElement>('[data-layer]')) {
      button.setAttribute('aria-pressed', String(button.dataset.layer === current.layer));
    }
  };

  /** The floors the plan alone can be read at, for a house with more than one; made like the layers, the one read pressed. */
  let floorsOfIndex = -1;
  const showFloors = () => {
    if (!floorBar) return;
    const plan = options.projects[current.index].plan;
    floorBar.hidden = !(current.mode === 'focus' && current.layer === 'plano' && plan.upper);
    if (floorBar.hidden) return;
    if (floorsOfIndex !== current.index) {
      floorsOfIndex = current.index;
      const held = floorBar.contains(document.activeElement);
      const scope = [...floorBar.attributes].filter(({ name }) => name.startsWith('data-astro-cid'));
      floorBar.replaceChildren(
        ...(['ground', 'upper'] as const).map((id) => {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'projects-layer';
          for (const { name: attribute, value } of scope) button.setAttribute(attribute, value);
          button.dataset.floor = id;
          button.textContent = plan[id]!.name;
          button.addEventListener('click', () => {
            if (planFloor === id) return;
            planFloor = id;
            follow();
            show();
            requestRender();
            if (live) live.textContent = `${plan[id]!.name}, ${labels[current.index].querySelector('.projects-name')?.textContent}`;
          });
          return button;
        }),
      );
      if (held) floorBar.querySelector<HTMLElement>(`[data-floor="${planFloor}"]`)?.focus({ preventScroll: true });
    }
    for (const button of floorBar.querySelectorAll<HTMLElement>('[data-floor]')) {
      button.setAttribute('aria-pressed', String(button.dataset.floor === planFloor));
    }
  };

  /** The heading, the labels, the way back, the pager and the layers follow the step the view is on. */
  const show = () => {
    const open = current.mode !== 'closed';
    if (open) {
      root.dataset.projects = current.mode;
      nav.dataset.mode = current.mode;
    } else {
      delete root.dataset.projects;
      delete nav.dataset.mode;
    }
    if (current.mode === 'focus') {
      nav.dataset.layer = current.layer;
      showLayers();
    } else {
      delete nav.dataset.layer;
    }
    showFloors();
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
  const frame = (immediate: boolean, duration = 1.9) => {
    gsap.killTweensOf(target);
    // The whole turns the model was turned by are the same view: wound back, with the turn still to come,
    // they are never undone on the way to the list or the house.
    const wound = wrapAngle(target.azimuth);
    turn.azimuth += wound - target.azimuth;
    target.azimuth = wound;
    hold();
    const view = goal();
    if (immediate) Object.assign(target, view);
    // At the veil's cut, the view as it is then: a drag or a zoom made under the veil is not undone by it.
    else if (reducedMotion) crossfade(() => Object.assign(target, goal()));
    else gsap.to(target, { ...view, duration, ease: SETTLE, onUpdate: requestRender });
    requestRender();
  };

  /**
   * The model in focus turned or zoomed by hand: the camera follows the hand, heavily, or at once under
   * reduced motion.
   */
  const aim = () => {
    hold();
    const view = goal();
    if (reducedMotion) {
      gsap.killTweensOf(target);
      Object.assign(target, view);
    } else {
      gsap.to(target, { ...view, duration: 0.6, ease: 'power3.out', overwrite: true, onUpdate: requestRender });
    }
    requestRender();
  };

  /** Under reduced motion a value jumps at the crossfade's cut; otherwise it is tweened there. */
  const ease = (value: { value: number }, to: number, how: gsap.TweenVars) => {
    gsap.killTweensOf(value);
    if (reducedMotion) value.value = to;
    else gsap.to(value, { value: to, ...how, onUpdate: requestRender });
  };

  /**
   * The house in focus rises, whole or cut at a floor, and the other plans fade; its plan alone lays it down.
   * Back in the list every plan returns and every model sinks, to rise whole next time.
   */
  const arrange = () => {
    goals.forEach((goal, index) => {
      const rise = standing(current, index) ? 1 : 0;
      const presence = present(current, index) ? 1 : 0;
      const height = rise ? cutHeight(options.projects[index].plan, current.layer, houses[index].height) : houses[index].height;
      if (rise !== goal.rise) {
        goal.rise = rise;
        if (rise) model(index);
        ease(rises[index], rise, rise ? RISE : SINK);
      }
      // Laid down into its plan, a model keeps its height until it stands again.
      if (height !== goal.height && (rise || current.mode !== 'focus')) {
        goal.height = height;
        ease(heights[index], height, rise ? CUT : { ...CUT, delay: SINK.duration });
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
    follow();
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
    const stepped = next.index !== current.index;
    const layered = next.layer !== current.layer;
    const moved = next.mode !== current.mode || layered || (stepped && (next.mode === 'focus' || narrow()));
    // A plan comes into focus in 3/4, the short way round from wherever the camera is.
    if (next.mode === 'focus' && (current.mode !== 'focus' || stepped)) {
      turn.azimuth = nearestTurn(target.azimuth, FOCUS_VIEW.azimuth);
      turn.elevation = FOCUS_VIEW.elevation;
    }
    if (layered) Object.assign(turn, layerTurn(turn, next.layer));
    // Another house, another layer or the list: seen whole again.
    if (stepped || layered || next.mode !== current.mode) {
      zoom = 1;
      pan = { x: 0, z: 0 };
      zoomed = false;
    }
    const news = announced(current, next);
    // A floor layer is the floor the plan alone is read at next; another house starts at the ground floor.
    if (stepped) planFloor = 'ground';
    if (next.layer === 'ground' || next.layer === 'upper') planFloor = next.layer;
    current = next;
    // Once a plan has been in focus the row is drafted: back in the list its labels return with their sheets.
    if (next.mode === 'focus') panel.dataset.seen = '';
    show();
    follow();
    if (moved) frame(false);
    if (reducedMotion) crossfade(arrange);
    else arrange();
    if (!live) return;
    if (news === 'project') live.textContent = [...labels[current.index].children].map((part) => part.textContent).join(', ');
    else if (news === 'layer') {
      const layer = layersOf(options.projects[current.index].plan).find(({ id }) => id === current.layer);
      live.textContent = `${layer?.name}, ${labels[current.index].querySelector('.projects-name')?.textContent}`;
    }
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
  for (const element of turners) {
    element.addEventListener('click', () => {
      if (!turnable(current)) return;
      turn.azimuth += Number(element.dataset.projectsTurn) * TURN_STEP;
      frame(false, 1.2);
    });
  }
  /**
   * The model or the plan in focus, `by` times as close, within its limits; the plan about the pixel (`px`, `py`)
   * of the canvas, where the hand is, so what is under it stays there.
   */
  const scale = (by: number, px?: number, py?: number) => {
    const from = goal();
    const was = zoom;
    zoom *= by;
    hold();
    if (current.layer === 'plano' && px !== undefined && py !== undefined) {
      const { width, height } = size();
      pan = planZoomAt(pan, zoom / was, px, py, from, width, height);
    }
    zoomed = true;
  };
  const zoomBy = (by: number, px?: number, py?: number) => {
    scale(by, px, py);
    aim();
  };
  for (const element of zoomers) {
    element.addEventListener('click', () => {
      if (current.mode === 'focus' && element.getAttribute('aria-disabled') !== 'true') zoomBy(ZOOM_STEP ** Number(element.dataset.projectsZoom));
    });
  }
  labels.forEach((label, index) => {
    label.addEventListener('click', () => go(navigate(current, { type: 'focus', index }, total)));
    // Tabbing to a plan that is off screen brings it in.
    label.addEventListener('focus', () => {
      if (current.mode === 'closed' || index === current.index) return;
      if (current.mode === 'focus') go(navigate(current, { type: 'focus', index }, total));
      else if (narrow()) go({ ...current, index });
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

  /** A pointer's place on the canvas. */
  const onCanvas = (event: { clientX: number; clientY: number }) => {
    const rect = options.canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  // A wheel over the model or the plan in focus zooms it, the plan towards the pointer (a pinch on a trackpad
  // too, which the browser would zoom the page by).
  options.canvas.addEventListener(
    'wheel',
    (event) => {
      if (current.mode !== 'focus') return;
      event.preventDefault();
      const { x, y } = onCanvas(event);
      zoomBy(wheelZoom(event.deltaY, event.deltaMode, event.ctrlKey), x, y);
    },
    { passive: false },
  );

  // A tap or a click picks a plan. In focus a drag turns the model, or moves the plan read alone, and a pinch
  // zooms either; in the list, on a touch screen, a sideways swipe moves along the row.
  let downX = 0;
  let downY = 0;
  /** The pointer turning the model or moving the plan, and where it was last. */
  let grip = -1;
  let gripX = 0;
  let gripY = 0;
  /**
   * The fingers on the model or the plan in focus; once two are down, how far apart they began and the zoom
   * then, and where between them they were last.
   */
  const fingers = new Map<number, { clientX: number; clientY: number }>();
  let spread = 0;
  let spreadZoom = 1;
  let middle = { x: 0, y: 0 };
  /** A press that became a pinch neither turns, moves nor picks, until every finger is lifted. */
  let pinched = false;
  const pair = () => {
    const [a, b] = [...fingers.values()].map((finger) => onCanvas(finger));
    return { spread: Math.hypot(a.x - b.x, a.y - b.y), middle: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
  };
  // Only the first finger moves where the press began, turns and picks; a second one makes the press a pinch.
  options.canvas.addEventListener('pointerdown', (event) => {
    if (event.isPrimary) {
      fingers.clear();
      spread = 0;
      pinched = false;
    }
    if (event.pointerType === 'touch' && current.mode === 'focus') {
      fingers.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });
      options.canvas.setPointerCapture(event.pointerId);
      if (fingers.size === 2) {
        grip = -1;
        pinched = true;
        ({ spread, middle } = pair());
        spreadZoom = zoom;
      }
    }
    if (!event.isPrimary) return;
    downX = gripX = event.clientX;
    downY = gripY = event.clientY;
    if (current.mode !== 'focus' || event.button !== 0) return;
    grip = event.pointerId;
    options.canvas.setPointerCapture(event.pointerId);
  });
  options.canvas.addEventListener('pointermove', (event) => {
    if (fingers.has(event.pointerId)) {
      fingers.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });
      if (spread > 0 && fingers.size > 1 && current.mode === 'focus') {
        // The zoom the spread asks for since the pinch began, held within its limits; the plan follows the
        // fingers' middle as they spread, as a sheet under the hand would.
        const now = pair();
        scale((spreadZoom * now.spread) / spread / zoom, now.middle.x, now.middle.y);
        if (current.layer === 'plano') pan = planDrag(pan, now.middle.x - middle.x, now.middle.y - middle.y, goal(), size().height);
        middle = now.middle;
        aim();
        return;
      }
    }
    if (event.pointerId !== grip || current.mode !== 'focus' || !dragging(event.clientX - downX, event.clientY - downY)) return;
    if (current.layer === 'plano') pan = planDrag(pan, event.clientX - gripX, event.clientY - gripY, goal(), size().height);
    else Object.assign(turn, orbit(turn, event.clientX - gripX, event.clientY - gripY, size().width));
    gripX = event.clientX;
    gripY = event.clientY;
    aim();
  });
  const release = (event: PointerEvent) => {
    if (event.pointerId === grip) grip = -1;
    fingers.delete(event.pointerId);
    // A third finger lifted: the pinch goes on from the two still down, as they are now.
    if (fingers.size > 1) ({ spread, middle } = pair());
    else spread = 0;
    spreadZoom = zoom;
  };
  options.canvas.addEventListener('pointercancel', release);
  options.canvas.addEventListener('pointerup', (event) => {
    release(event);
    if (!event.isPrimary || pinched || current.mode === 'closed') return;
    const action = released(current.mode, event.clientX - downX, event.clientY - downY, event.pointerType);
    if (action?.type === 'pick') {
      const index = sheetAt(event.clientX, event.clientY);
      if (index < 0) return;
      go(navigate(current, { type: 'focus', index }, total));
      // The press left the focus on the page itself: it moves to the plan's label.
      labels[current.index].focus({ preventScroll: true });
    } else if (action?.type === 'step') {
      step(action.by);
    }
  });

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
        // The extrusion of scene 3: what the rise has not reached, or the cut has taken off, is pressed down.
        built.uniforms.uGrow.value = rises[index].value * heights[index].value;
        built.root.visible = rises[index].value > 0.001;
      });
    },
    /** Hangs each label under its plan; the label of a model zoomed by hand where it hangs unzoomed. */
    place() {
      camera.updateMatrixWorld();
      const { width, height } = size();
      if (zoomed) {
        still.aspect = width / height;
        poseCamera(still, heldView(target, framing), width, height);
        still.updateMatrixWorld();
      }
      row.forEach((sheet, index) => {
        const { x, y } = labelAnchor(sheet, top, zoomed && index === current.index ? still : camera, width, height);
        items[index].style.setProperty('--x', `${x.toFixed(1)}px`);
        items[index].style.setProperty('--y', `${y.toFixed(1)}px`);
      });
    },
    resize() {
      if (current.mode === 'closed') return;
      show();
      frame(true);
    },
  };
}
