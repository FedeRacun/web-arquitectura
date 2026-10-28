import type Lenis from 'lenis';
import type { VirtualScrollData } from 'lenis';
import { Vector3 } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { createCameraRig, lens, poseCamera, type CameraView } from './camera';
import { createGuide } from './guide';
import { blendView, navigate, projectsView, rowLayout, safeArea, standing, type ProjectsNav } from './projects';
import { createState } from './state';

const SIZES = [
  { width: 26, depth: 18, height: 3.6 },
  { width: 30, depth: 20, height: 6.75 },
  { width: 24, depth: 16, height: 3.5 },
];

/** Where each corner of a sheet lands on screen (NDC) for a view. */
function corners(view: CameraView, aspect: number, sheet: { x: number; z: number; width: number; depth: number }, y = 0) {
  const camera = lens();
  camera.aspect = aspect;
  camera.updateProjectionMatrix();
  poseCamera(camera, view, aspect * 1000, 1000);
  camera.updateMatrixWorld();
  return [-1, 1].flatMap((sx) =>
    [-1, 1].map((sz) =>
      new Vector3(sheet.x + (sx * sheet.width) / 2, y, sheet.z + (sz * sheet.depth) / 2).project(camera),
    ),
  );
}

describe('rowLayout', () => {
  const row = rowLayout(SIZES, 50, 8);

  it('lays the sheets left to right from the start, on one line', () => {
    expect(row).toHaveLength(3);
    expect(row[0].x - row[0].width / 2).toBeCloseTo(50);
    for (const sheet of row) expect(sheet.z).toBe(0);
    row.forEach((sheet, i) => expect(sheet).toMatchObject(SIZES[i]));
  });

  it('spaces them evenly, edge to edge, and never overlaps them', () => {
    for (let i = 1; i < row.length; i++) {
      const gap = row[i].x - row[i].width / 2 - (row[i - 1].x + row[i - 1].width / 2);
      expect(gap).toBeCloseTo(8);
    }
  });
});

describe('blendView', () => {
  const away: CameraView = {
    azimuth: 0,
    elevation: 1.3,
    distance: 90,
    targetX: 80,
    targetY: -0.4,
    targetZ: 2,
    frameX: 0,
    frameY: 0.05,
    portraitPull: 0,
  };

  it("keeps the timeline's camera exactly at aside 0", () => {
    const state = createState();
    Object.assign(state, { azimuth: 0.42, elevation: 0.42, distance: 150, targetY: 1.2, frameX: 0.1, portraitPull: 0.8 });
    const view = blendView(state, away, 0, { ...away });
    for (const key of Object.keys(away) as (keyof CameraView)[]) expect(view[key]).toBe(state[key]);
  });

  it("reaches the projects' camera at aside 1", () => {
    const view = blendView(createState(), away, 1, { ...away, distance: 0 });
    expect(view).toEqual(away);
  });
});

describe('the camera rig at aside 0', () => {
  it('orbits the target as before, pulling back on a portrait screen', () => {
    const state = createState();
    Object.assign(state, { azimuth: 0.42, elevation: 0.42, distance: 150, targetY: 1.2, portraitPull: 0.8 });
    for (const [width, height] of [
      [1440, 900],
      [375, 812],
    ]) {
      const rig = createCameraRig();
      rig.resize(width, height);
      rig.apply(blendView(state, { ...state, targetX: 90 }, 0, { ...state }));
      const aspect = width / height;
      const fit = aspect < 1.5 ? Math.min(Math.pow(1.5 / aspect, 0.9), 3) : 1;
      const distance = 150 * (1 + (fit - 1) * 0.8);
      expect(rig.camera.position.x).toBeCloseTo(distance * Math.cos(0.42) * Math.sin(0.42), 9);
      expect(rig.camera.position.y).toBeCloseTo(1.2 + distance * Math.sin(0.42), 9);
      expect(rig.camera.position.z).toBeCloseTo(distance * Math.cos(0.42) * Math.cos(0.42), 9);
    }
  });
});

describe('projectsView', () => {
  const row = rowLayout(SIZES, 50, 8);
  const screens = [
    { name: 'desktop', width: 1440, height: 900, narrow: false },
    { name: 'portrait', width: 375, height: 812, narrow: true },
  ];

  for (const screen of screens) {
    it(`frames a whole sheet and its standing model in focus, inside its margins, on a ${screen.name} screen`, () => {
      const aspect = screen.width / screen.height;
      for (let index = 0; index < row.length; index++) {
        const view = projectsView(row, { mode: 'focus', index }, aspect, screen.narrow, -0.4);
        const safe = safeArea('focus', screen.narrow);
        const sheet = row[index];
        for (const point of [...corners(view, aspect, sheet, -0.4), ...corners(view, aspect, sheet, -0.4 + sheet.height)]) {
          expect(point.x).toBeGreaterThanOrEqual(-1 + 2 * safe.side - 1e-6);
          expect(point.x).toBeLessThanOrEqual(1 - 2 * safe.side + 1e-6);
          expect(point.y).toBeGreaterThanOrEqual(-1 + 2 * safe.bottom - 1e-6);
          expect(point.y).toBeLessThanOrEqual(1 - 2 * safe.top + 1e-6);
        }
      }
    });
  }

  it('fits the whole row in the list on a wide screen, and one sheet per screen on a narrow one', () => {
    const wide = projectsView(row, { mode: 'list', index: 1 }, 1440 / 900, false, -0.4);
    for (const sheet of row) {
      for (const point of corners(wide, 1440 / 900, sheet, -0.4)) expect(Math.abs(point.x)).toBeLessThanOrEqual(1);
    }
    const narrow = projectsView(row, { mode: 'list', index: 1 }, 375 / 812, true, -0.4);
    expect(narrow.targetX).toBeCloseTo(row[1].x);
    for (const sheet of [row[0], row[2]]) {
      for (const point of corners(narrow, 375 / 812, sheet, -0.4)) expect(Math.abs(point.x)).toBeGreaterThan(1);
    }
  });

  it('comes closer for a sheet in focus than for the list, and turns to see its model in 3/4', () => {
    const list = projectsView(row, { mode: 'list', index: 0 }, 1440 / 900, false, -0.4);
    const focus = projectsView(row, { mode: 'focus', index: 0 }, 1440 / 900, false, -0.4);
    expect(focus.distance).toBeLessThan(list.distance);
    expect(focus.elevation).toBeLessThan(list.elevation);
    expect(focus.azimuth).toBeGreaterThan(0.3);
    expect(focus.azimuth).toBeLessThan(1.2);
  });
});

describe('standing', () => {
  it('stands only the house whose plan is in focus', () => {
    expect(standing({ mode: 'focus', index: 1 }, 1)).toBe(true);
    expect(standing({ mode: 'focus', index: 1 }, 0)).toBe(false);
    expect(standing({ mode: 'list', index: 1 }, 1)).toBe(false);
    expect(standing({ mode: 'closed', index: 1 }, 1)).toBe(false);
  });
});

describe('navigate', () => {
  const closed: ProjectsNav = { mode: 'closed', index: 0 };

  it('opens on the list, and Escape goes from a plan to the list, then closes', () => {
    const list = navigate(closed, { type: 'open' }, 3);
    expect(list.mode).toBe('list');
    const focus = navigate(list, { type: 'focus', index: 2 }, 3);
    expect(focus).toEqual({ mode: 'focus', index: 2 });
    const back = navigate(focus, { type: 'back' }, 3);
    expect(back).toEqual({ mode: 'list', index: 2 });
    expect(navigate(back, { type: 'back' }, 3).mode).toBe('closed');
  });

  it('steps between plans and stops at either end of the row', () => {
    let nav = navigate(navigate(closed, { type: 'open' }, 3), { type: 'focus', index: 0 }, 3);
    nav = navigate(nav, { type: 'step', by: -1 }, 3);
    expect(nav.index).toBe(0);
    nav = navigate(navigate(nav, { type: 'step', by: 1 }, 3), { type: 'step', by: 1 }, 3);
    expect(nav).toEqual({ mode: 'focus', index: 2 });
    expect(navigate(nav, { type: 'step', by: 1 }, 3).index).toBe(2);
  });

  it('ignores steps and picks while closed', () => {
    expect(navigate(closed, { type: 'step', by: 1 }, 3)).toEqual(closed);
    expect(navigate(closed, { type: 'focus', index: 1 }, 3)).toEqual(closed);
  });
});

describe('a gesture while the camera glides back from the other projects', () => {
  // The page is held (Lenis stopped) until the camera is back over the model.
  const setup = () => {
    const lenis = { animatedScroll: 0, isScrolling: false, isStopped: true, scrollTo: vi.fn() };
    const held = vi.fn(() => true);
    const guide = createGuide(lenis as unknown as Lenis, { toScroll: (p) => p * 1000, toProgress: (y) => y / 1000 }, held);
    return { lenis, held, guide };
  };
  const wheel = (deltaY: number, timeStamp: number) =>
    ({ deltaY, event: { type: 'wheel', deltaY, timeStamp, cancelable: true, ctrlKey: false, preventDefault: vi.fn() } }) as unknown as VirtualScrollData;
  const key = (key: string) => ({ key, target: null, repeat: false, preventDefault: vi.fn() }) as unknown as KeyboardEvent;

  it('is handed over as one step in its direction, once per gesture, and does not move the page', () => {
    const { lenis, held, guide } = setup();
    for (let t = 0; t < 120; t += 16) guide.virtualScroll(wheel(30, 1000 + t));
    expect(held).toHaveBeenCalledOnce();
    expect(held).toHaveBeenCalledWith(1);
    expect(lenis.scrollTo).not.toHaveBeenCalled();
    // A new gesture the other way turns the held step round.
    guide.virtualScroll(wheel(-30, 2000));
    expect(held).toHaveBeenLastCalledWith(-1);
  });

  it('hands over a paging key too, and keeps it from the browser only when the step is taken', () => {
    vi.stubGlobal('Element', class {});
    const { lenis, held, guide } = setup();
    const down = key('ArrowDown');
    guide.keydown(down);
    expect(held).toHaveBeenCalledWith(1);
    expect(down.preventDefault).toHaveBeenCalled();
    held.mockReturnValueOnce(false);
    const up = key('ArrowUp');
    guide.keydown(up);
    expect(up.preventDefault).not.toHaveBeenCalled();
    expect(lenis.scrollTo).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
