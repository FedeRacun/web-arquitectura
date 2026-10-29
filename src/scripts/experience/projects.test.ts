import type Lenis from 'lenis';
import type { VirtualScrollData } from 'lenis';
import { Vector3 } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { projects } from '../../config/projects';
import { levelHeights } from './building/plan';
import { createCameraRig, lens, poseCamera, type CameraView } from './camera';
import { createGuide } from './guide';
import {
  announced,
  blendView,
  clampZoom,
  cutHeight,
  FOCUS_VIEW,
  inSafeArea,
  layersOf,
  layerTurn,
  navigate,
  nearestTurn,
  orbit,
  present,
  projectsView,
  released,
  rowLayout,
  safeArea,
  standing,
  turnable,
  wheelZoom,
  wrapAngle,
  zoomLimit,
  type ProjectsNav,
} from './projects';
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
        const view = projectsView(row, { mode: 'focus', index, layer: 'completa' }, aspect, screen.narrow, -0.4);
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
    const wide = projectsView(row, { mode: 'list', index: 1, layer: 'completa' }, 1440 / 900, false, -0.4);
    for (const sheet of row) {
      for (const point of corners(wide, 1440 / 900, sheet, -0.4)) expect(Math.abs(point.x)).toBeLessThanOrEqual(1);
    }
    const narrow = projectsView(row, { mode: 'list', index: 1, layer: 'completa' }, 375 / 812, true, -0.4);
    expect(narrow.targetX).toBeCloseTo(row[1].x);
    for (const sheet of [row[0], row[2]]) {
      for (const point of corners(narrow, 375 / 812, sheet, -0.4)) expect(Math.abs(point.x)).toBeGreaterThan(1);
    }
  });

  it('comes closer for a sheet in focus than for the list, and turns to see its model in 3/4', () => {
    const list = projectsView(row, { mode: 'list', index: 0, layer: 'completa' }, 1440 / 900, false, -0.4);
    const focus = projectsView(row, { mode: 'focus', index: 0, layer: 'completa' }, 1440 / 900, false, -0.4);
    expect(focus.distance).toBeLessThan(list.distance);
    expect(focus.elevation).toBeLessThan(list.elevation);
    expect(focus.azimuth).toBeGreaterThan(0.3);
    expect(focus.azimuth).toBeLessThan(1.2);
  });

  for (const screen of screens) {
    it(`holds the sheet and its model inside its margins from any angle it is turned to, on a ${screen.name} screen`, () => {
      const aspect = screen.width / screen.height;
      const safe = safeArea('focus', screen.narrow);
      for (let index = 0; index < row.length; index++) {
        const sheet = row[index];
        for (const elevation of [0.2, 0.62, 1.4]) {
          for (let step = 0; step < 48; step++) {
            const turn = { azimuth: (step / 48) * 2 * Math.PI - Math.PI, elevation };
            const view = projectsView(row, { mode: 'focus', index, layer: 'completa' }, aspect, screen.narrow, -0.4, turn);
            expect(view.azimuth).toBe(turn.azimuth);
            expect(view.elevation).toBe(elevation);
            for (const point of [...corners(view, aspect, sheet, -0.4), ...corners(view, aspect, sheet, -0.4 + sheet.height)]) {
              expect(point.x).toBeGreaterThanOrEqual(-1 + 2 * safe.side - 1e-6);
              expect(point.x).toBeLessThanOrEqual(1 - 2 * safe.side + 1e-6);
              expect(point.y).toBeGreaterThanOrEqual(-1 + 2 * safe.bottom - 1e-6);
              expect(point.y).toBeLessThanOrEqual(1 - 2 * safe.top + 1e-6);
            }
          }
        }
      }
    });
  }

  it('keeps the same distance all the way round, so the model does not pump while it turns', () => {
    for (const elevation of [0.2, 0.62, 1.4]) {
      const distances = [0, 0.7, 1.9, 3.1, -2.4].map(
        (azimuth) => projectsView(row, { mode: 'focus', index: 1, layer: 'completa' }, 1440 / 900, false, -0.4, { azimuth, elevation }).distance,
      );
      for (const distance of distances) expect(distance).toBeCloseTo(distances[0], 9);
    }
  });
});

describe('orbit', () => {
  const start = { azimuth: 0.45, elevation: 0.62 };

  it('turns the model with the drag, half a turn across the screen, and never stops turning', () => {
    // Dragging left brings the model's east side round to the front, as a hand turning it would.
    expect(orbit(start, -1000, 0, 1000).azimuth).toBeCloseTo(0.45 + Math.PI);
    expect(orbit(start, 1000, 0, 1000).azimuth).toBeCloseTo(0.45 - Math.PI);
    expect(orbit(start, -4000, 0, 1000).azimuth).toBeCloseTo(0.45 + 4 * Math.PI);
    expect(orbit(start, -500, 0, 1000).elevation).toBe(0.62);
  });

  it('looks from higher up as the drag goes down, between just over the table and almost overhead', () => {
    const higher = orbit(start, 0, 100, 1000);
    expect(higher.elevation).toBeCloseTo(0.62 + Math.PI / 10);
    expect(higher.azimuth).toBe(0.45);
    const top = orbit(start, 0, 100000, 1000).elevation;
    const low = orbit(start, 0, -100000, 1000).elevation;
    expect(top).toBeLessThan(Math.PI / 2);
    expect(top).toBeGreaterThan(1.3);
    expect(low).toBeGreaterThan(0.1);
    expect(low).toBeLessThan(0.3);
  });
});

describe('the layers of a house', () => {
  const [enL, entreMedianeras, patio] = projects;

  it('read from the line to the volume: the plan, each floor by its name, the whole house', () => {
    expect(layersOf(enL.plan)).toEqual([
      { id: 'plano', name: 'Plano' },
      { id: 'ground', name: 'Planta' },
      { id: 'completa', name: 'Completa' },
    ]);
    expect(layersOf(entreMedianeras.plan)).toEqual([
      { id: 'plano', name: 'Plano' },
      { id: 'ground', name: 'Planta baja' },
      { id: 'upper', name: 'Planta alta' },
      { id: 'completa', name: 'Completa' },
    ]);
    expect(layersOf(patio.plan).map((layer) => layer.name)).toEqual(['Plano', 'Planta baja', 'Completa']);
  });

  it('cut each floor 1.20 m over it, as its plan is drawn, and leave the whole house or none of it', () => {
    for (const { plan } of projects) {
      for (const { id } of layersOf(plan)) {
        if (id === 'plano' || id === 'completa') continue;
        const { floor, ceiling } = levelHeights(plan, id);
        const cut = cutHeight(plan, id, 9);
        expect(cut).toBeCloseTo(floor + 1.2, 9);
        expect(cut).toBeLessThan(ceiling);
      }
      expect(cutHeight(plan, 'completa', 9)).toBe(9);
      expect(cutHeight(plan, 'plano', 9)).toBe(0);
    }
  });

  it('take the floors above off a floor, and keep those below it whole', () => {
    const { plan } = entreMedianeras;
    // The upper floor's slab starts at `nivel`: under the ground floor's cut it is gone, with all above it.
    expect(cutHeight(plan, 'ground', 9)).toBeLessThan(levelHeights(plan, 'upper').nivel);
    // The upper floor's cut is over its own floor, so the ground floor and the slab between stand whole.
    expect(cutHeight(plan, 'upper', 9)).toBeGreaterThan(levelHeights(plan, 'upper').floor);
  });

  it('look into a floor from high enough to see its rooms, from the side it was turned to', () => {
    const turned = { azimuth: 2.1, elevation: 0.4 };
    for (const layer of ['ground', 'upper'] as const) {
      const turn = layerTurn(turned, layer);
      expect(turn.azimuth).toBe(2.1);
      expect(turn.elevation).toBeGreaterThanOrEqual(0.9);
      expect(layerTurn({ azimuth: 2.1, elevation: 1.3 }, layer).elevation).toBe(1.3);
    }
    expect(layerTurn(turned, 'completa')).toEqual(turned);
    expect(layerTurn(turned, 'plano')).toEqual(turned);
  });

  it('only turn while there is a model to turn', () => {
    expect(turnable({ mode: 'focus', index: 0, layer: 'completa' })).toBe(true);
    expect(turnable({ mode: 'focus', index: 0, layer: 'ground' })).toBe(true);
    expect(turnable({ mode: 'focus', index: 0, layer: 'plano' })).toBe(false);
    expect(turnable({ mode: 'list', index: 0, layer: 'completa' })).toBe(false);
  });
});

describe('the view of a layer', () => {
  const row = rowLayout(SIZES, 50, 8);
  const screens = [
    { name: 'desktop', width: 1440, height: 900, narrow: false },
    { name: 'portrait', width: 375, height: 812, narrow: true },
  ];

  for (const screen of screens) {
    it(`looks down on the plan alone for the plan, and holds a cut model closer, on a ${screen.name} screen`, () => {
      const aspect = screen.width / screen.height;
      const safe = safeArea('focus', screen.narrow);
      const sheet = row[1];
      const inside = (view: CameraView, height: number) => {
        for (const point of [...corners(view, aspect, sheet, -0.4), ...corners(view, aspect, sheet, -0.4 + height)]) {
          expect(point.x).toBeGreaterThanOrEqual(-1 + 2 * safe.side - 1e-6);
          expect(point.x).toBeLessThanOrEqual(1 - 2 * safe.side + 1e-6);
          expect(point.y).toBeGreaterThanOrEqual(-1 + 2 * safe.bottom - 1e-6);
          expect(point.y).toBeLessThanOrEqual(1 - 2 * safe.top + 1e-6);
        }
      };
      const turned = { azimuth: 2.1, elevation: 0.95 };
      const plan = projectsView(row, { mode: 'focus', index: 1, layer: 'plano' }, aspect, screen.narrow, -0.4, turned);
      expect(plan.azimuth).toBe(0);
      expect(plan.elevation).toBeGreaterThan(1);
      inside(plan, 0);
      const whole = projectsView(row, { mode: 'focus', index: 1, layer: 'completa' }, aspect, screen.narrow, -0.4, turned);
      const cut = projectsView(row, { mode: 'focus', index: 1, layer: 'ground' }, aspect, screen.narrow, -0.4, turned, 1.6);
      expect(cut.azimuth).toBe(2.1);
      expect(cut.distance).toBeLessThanOrEqual(whole.distance);
      inside(cut, 1.6);
    });
  }
});

describe('zooming the model in focus', () => {
  const row = rowLayout(SIZES, 50, 8);
  const focus = (index: number, layer: ProjectsNav['layer'] = 'completa'): ProjectsNav => ({ mode: 'focus', index, layer });
  const screens = [
    { aspect: 1440 / 900, narrow: false },
    { aspect: 375 / 812, narrow: true },
  ];
  /** The radius of the sphere round a sheet and its model `height` tall. */
  const reach = (index: number, height: number) => Math.hypot(row[index].width, row[index].depth, height) / 2;
  const turned = { azimuth: 2.1, elevation: 0.95 };

  it('comes closer by the zoom, to the same point of the model, from the same side', () => {
    const whole = projectsView(row, focus(1), 1440 / 900, false, -0.4, turned);
    const zoomed = projectsView(row, focus(1), 1440 / 900, false, -0.4, turned, undefined, 2);
    expect(zoomed.distance).toBeCloseTo(whole.distance / 2, 9);
    expect({ ...zoomed, distance: 0 }).toEqual({ ...whole, distance: 0 });
  });

  it('never comes inside the sphere round the plan and its model, however far it is zoomed', () => {
    for (const { aspect, narrow } of screens) {
      for (let index = 0; index < row.length; index++) {
        for (const [layer, height] of [['completa', row[index].height], ['ground', 1.6]] as const) {
          for (const elevation of [0.2, 0.62, 1.4]) {
            const turn = { azimuth: 0.7, elevation };
            const view = projectsView(row, focus(index, layer), aspect, narrow, -0.4, turn, height, 100);
            expect(view.distance).toBeGreaterThanOrEqual(reach(index, height) - 1e-9);
          }
        }
      }
    }
  });

  it('goes up to three times as close, less where the sphere comes first, and never back past the framing', () => {
    for (const { aspect, narrow } of screens) {
      for (let index = 0; index < row.length; index++) {
        for (const elevation of [0.2, 0.62, 1.4]) {
          const turn = { azimuth: 0.7, elevation };
          const height = row[index].height;
          const limit = zoomLimit(row, focus(index), aspect, narrow, -0.4, turn, height);
          expect(limit).toBeGreaterThanOrEqual(1);
          expect(limit).toBeLessThanOrEqual(3);
          const whole = projectsView(row, focus(index), aspect, narrow, -0.4, turn, height);
          const closest = projectsView(row, focus(index), aspect, narrow, -0.4, turn, height, limit);
          expect(closest.distance).toBeCloseTo(whole.distance / limit, 6);
          if (limit < 3) expect(closest.distance).toBeCloseTo(reach(index, height), 6);
        }
      }
    }
    // From just over the table on a landscape screen the sphere comes first; on a portrait one, never.
    expect(zoomLimit(row, focus(1), 1440 / 900, false, -0.4, { azimuth: 0.45, elevation: 0.2 })).toBeLessThan(3);
    expect(zoomLimit(row, focus(1), 375 / 812, true, -0.4, { azimuth: 0.45, elevation: 0.2 })).toBe(3);
  });

  it('holds a zoom between the framing and the limit', () => {
    expect(clampZoom(0.4, 2.8)).toBe(1);
    expect(clampZoom(2, 2.8)).toBe(2);
    expect(clampZoom(5, 2.8)).toBe(2.8);
  });

  it('leaves the list and the plan framed as they are', () => {
    for (const nav of [{ mode: 'list', index: 1, layer: 'completa' } as const, focus(1, 'plano')]) {
      expect(projectsView(row, nav, 1440 / 900, false, -0.4, turned, undefined, 3)).toEqual(
        projectsView(row, nav, 1440 / 900, false, -0.4, turned),
      );
      expect(zoomLimit(row, nav, 1440 / 900, false, -0.4, turned)).toBe(1);
    }
  });
});

describe('wheelZoom', () => {
  it('zooms in as the wheel turns away, and out by as much as it turns back', () => {
    const into = wheelZoom(-100, 0, false);
    expect(into).toBeGreaterThan(1.1);
    expect(into).toBeLessThan(1.4);
    expect(wheelZoom(100, 0, false)).toBeCloseTo(1 / into, 9);
    expect(wheelZoom(0, 0, false)).toBe(1);
  });

  it('reads a wheel counted in lines or pages as one counted in pixels', () => {
    expect(wheelZoom(-3, 1, false)).toBeCloseTo(wheelZoom(-48, 0, false), 9);
    expect(wheelZoom(-1, 2, false)).toBeCloseTo(wheelZoom(-800, 0, false), 9);
  });

  it('follows a pinch on a trackpad, whose steps are small, more closely than a wheel', () => {
    expect(wheelZoom(-10, 0, true)).toBeGreaterThan(wheelZoom(-10, 0, false) + 0.05);
    expect(wheelZoom(10, 0, true)).toBeCloseTo(1 / wheelZoom(-10, 0, true), 9);
  });
});

describe('inSafeArea', () => {
  const safe = safeArea('focus', false);

  it('leaves a label where it hangs inside the margins', () => {
    expect(inSafeArea(500, 400, 1440, 900, safe)).toEqual({ x: 500, y: 400 });
  });

  it('holds a label hung from a corner zoomed off the screen at the edge of the margins', () => {
    expect(inSafeArea(-200, 1300, 1440, 900, safe)).toEqual({ x: 1440 * safe.side, y: 900 * (1 - safe.bottom) });
    expect(inSafeArea(2000, -50, 1440, 900, safe)).toEqual({ x: 1440 * (1 - safe.side), y: 900 * safe.top });
  });
});

describe('announced', () => {
  const focus = (index: number, layer: ProjectsNav['layer']): ProjectsNav => ({ mode: 'focus', index, layer });

  it('names the plan stepped to, and the layer shown in focus', () => {
    expect(announced(focus(1, 'ground'), focus(2, 'completa'))).toBe('project');
    expect(announced({ mode: 'list', index: 0, layer: 'completa' }, { mode: 'list', index: 1, layer: 'completa' })).toBe('project');
    expect(announced(focus(1, 'completa'), focus(1, 'upper'))).toBe('layer');
    expect(announced(focus(1, 'upper'), focus(1, 'plano'))).toBe('layer');
  });

  it('says nothing of the layer on the way back to the list, where there is none', () => {
    expect(announced(focus(1, 'upper'), { mode: 'list', index: 1, layer: 'completa' })).toBeNull();
    expect(announced(focus(1, 'plano'), { mode: 'list', index: 1, layer: 'completa' })).toBeNull();
    expect(announced({ mode: 'list', index: 1, layer: 'completa' }, focus(1, 'completa'))).toBeNull();
  });
});

describe('released', () => {
  it('picks a plan on a tap, in the list and in focus alike', () => {
    for (const mode of ['list', 'focus'] as const) {
      expect(released(mode, 4, -6, 'mouse')).toEqual({ type: 'pick' });
      expect(released(mode, 0, 0, 'touch')).toEqual({ type: 'pick' });
    }
  });

  it('steps along the row on a sideways swipe in the list, as before', () => {
    expect(released('list', -120, 10, 'touch')).toEqual({ type: 'step', by: 1 });
    expect(released('list', 120, -10, 'pen')).toEqual({ type: 'step', by: -1 });
    // A short, steep or mouse drag is no swipe.
    expect(released('list', -40, 0, 'touch')).toBeNull();
    expect(released('list', -120, 100, 'touch')).toBeNull();
    expect(released('list', -120, 0, 'mouse')).toBeNull();
  });

  it('only turns the model in focus: the swipe that turned it does not step too', () => {
    expect(released('focus', -120, 10, 'touch')).toBeNull();
    expect(released('focus', -120, 10, 'mouse')).toBeNull();
  });
});

describe('turns of whole circles', () => {
  it('wind an angle back between -π and π, to the same view', () => {
    for (const angle of [0, 0.45, Math.PI, -3, 7, -20, 4 * Math.PI + 0.45]) {
      const wound = wrapAngle(angle);
      expect(wound).toBeGreaterThan(-Math.PI - 1e-9);
      expect(wound).toBeLessThanOrEqual(Math.PI + 1e-9);
      expect(Math.cos(wound)).toBeCloseTo(Math.cos(angle), 9);
      expect(Math.sin(wound)).toBeCloseTo(Math.sin(angle), 9);
    }
  });

  it('are skipped on the way to an angle, so the camera never turns more than half way round to reach it', () => {
    for (const [from, to] of [
      [0, 0.45],
      [7, 0.45],
      [-3, 0.45],
      [3, -3],
      [-20, 1],
    ]) {
      const goal = nearestTurn(from, to);
      expect(Math.abs(goal - from)).toBeLessThanOrEqual(Math.PI + 1e-9);
      expect(Math.cos(goal)).toBeCloseTo(Math.cos(to), 9);
      expect(Math.sin(goal)).toBeCloseTo(Math.sin(to), 9);
    }
  });
});

describe('standing', () => {
  it('stands only the house whose plan is in focus', () => {
    expect(standing({ mode: 'focus', index: 1, layer: 'completa' }, 1)).toBe(true);
    expect(standing({ mode: 'focus', index: 1, layer: 'completa' }, 0)).toBe(false);
    expect(standing({ mode: 'list', index: 1, layer: 'completa' }, 1)).toBe(false);
    expect(standing({ mode: 'closed', index: 1, layer: 'completa' }, 1)).toBe(false);
  });

  it('stands it cut at a floor, and lays it down into its plan for the plan', () => {
    expect(standing({ mode: 'focus', index: 1, layer: 'ground' }, 1)).toBe(true);
    expect(standing({ mode: 'focus', index: 1, layer: 'upper' }, 1)).toBe(true);
    expect(standing({ mode: 'focus', index: 1, layer: 'plano' }, 1)).toBe(false);
  });
});

describe('present', () => {
  it('keeps every plan in the list, and only the one in focus while one is', () => {
    for (const index of [0, 1, 2]) expect(present({ mode: 'list', index: 1, layer: 'completa' }, index)).toBe(true);
    expect(present({ mode: 'focus', index: 1, layer: 'completa' }, 1)).toBe(true);
    expect(present({ mode: 'focus', index: 1, layer: 'completa' }, 0)).toBe(false);
    expect(present({ mode: 'focus', index: 1, layer: 'completa' }, 2)).toBe(false);
  });
});

describe('navigate', () => {
  const closed: ProjectsNav = { mode: 'closed', index: 0, layer: 'completa' };

  it('opens on the list, and Escape goes from a plan to the list, then closes', () => {
    const list = navigate(closed, { type: 'open' }, 3);
    expect(list.mode).toBe('list');
    const focus = navigate(list, { type: 'focus', index: 2 }, 3);
    expect(focus).toEqual({ mode: 'focus', index: 2, layer: 'completa' });
    const back = navigate(focus, { type: 'back' }, 3);
    expect(back).toEqual({ mode: 'list', index: 2, layer: 'completa' });
    expect(navigate(back, { type: 'back' }, 3).mode).toBe('closed');
  });

  it('steps between plans and stops at either end of the row', () => {
    let nav = navigate(navigate(closed, { type: 'open' }, 3), { type: 'focus', index: 0 }, 3);
    nav = navigate(nav, { type: 'step', by: -1 }, 3);
    expect(nav.index).toBe(0);
    nav = navigate(navigate(nav, { type: 'step', by: 1 }, 3), { type: 'step', by: 1 }, 3);
    expect(nav).toEqual({ mode: 'focus', index: 2, layer: 'completa' });
    expect(navigate(nav, { type: 'step', by: 1 }, 3).index).toBe(2);
  });

  it('shows a layer of the plan in focus, and only there', () => {
    const focus: ProjectsNav = { mode: 'focus', index: 1, layer: 'completa' };
    expect(navigate(focus, { type: 'layer', layer: 'ground' }, 3)).toEqual({ mode: 'focus', index: 1, layer: 'ground' });
    expect(navigate(focus, { type: 'layer', layer: 'plano' }, 3)).toEqual({ mode: 'focus', index: 1, layer: 'plano' });
    const list: ProjectsNav = { mode: 'list', index: 1, layer: 'completa' };
    expect(navigate(list, { type: 'layer', layer: 'ground' }, 3)).toEqual(list);
    expect(navigate(closed, { type: 'layer', layer: 'ground' }, 3)).toEqual(closed);
  });

  it('brings every other plan into focus whole, and keeps the layer of the one already there', () => {
    const cut: ProjectsNav = { mode: 'focus', index: 1, layer: 'upper' };
    expect(navigate(cut, { type: 'step', by: 1 }, 3)).toEqual({ mode: 'focus', index: 2, layer: 'completa' });
    expect(navigate(cut, { type: 'focus', index: 0 }, 3)).toEqual({ mode: 'focus', index: 0, layer: 'completa' });
    expect(navigate(cut, { type: 'back' }, 3)).toEqual({ mode: 'list', index: 1, layer: 'completa' });
    // A tap on the plan in focus, or a step against the end of the row, changes nothing.
    expect(navigate(cut, { type: 'focus', index: 1 }, 3)).toEqual(cut);
    const last: ProjectsNav = { mode: 'focus', index: 2, layer: 'ground' };
    expect(navigate(last, { type: 'step', by: 1 }, 3)).toEqual(last);
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
