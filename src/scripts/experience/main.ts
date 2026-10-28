import { gsap } from 'gsap';
import { Color, Fog, Group, NeutralToneMapping, PCFShadowMap, Scene, Vector2, Vector3, WebGLRenderer } from 'three';
import { architect } from '../../config/architect';
import { createMassing } from './building/massing';
import { createSharedUniforms } from './building/materialWave';
import { LAYERS, deriveBuilding, planOffset, type Box, type LayerId } from './building/params';
import { createPlanSheet } from './building/planSheet';
import { createSketch } from './building/sketch';
import { BOARD_THICKNESS, createSite } from './building/site';
import { createTable } from './building/table';
import { createCameraRig } from './camera';
import { createLighting } from './lighting';
import { createPointer } from './pointer';
import type { Quality } from './quality';
import { SCENES, sceneAt, type SceneId } from './scenes';
import { startScroll } from './scroll';
import { createState, type ExperienceState } from './state';
import { createTimeline } from './timeline';

/*
 * One scene, one render loop. The eight storyboard scenes are states of the
 * same scene: the master timeline moves the camera and the uniforms, and the
 * loop draws a frame only when something changed (scroll, pointer, a tween),
 * so a still page costs nothing.
 */

const BASE = '#141210';
const BONE = '#ede6da';
/** The plot's board once the building stands on it. */
const GROUND = '#2b2723';
/** The workshop table under the lamp. */
const TABLE = '#8f877b';
/** Vertical gap between layers in the exploded axonometric. */
const EXPLODE_GAP = 7.5;
/** Lamp intensity over the model (candela; the lamp is ~75 m away). */
const LAMP = 520;
/** Pixel ratios the renderer steps down through when frames run late. */
const RATIO_STEPS = [2, 1.5, 1.25, 1];
/** Height the closing button extrudes: the ground floor. */
const FIRST_FLOOR = architect.building.plan.heights.ground;

export interface ExperienceDom {
  canvas: HTMLCanvasElement;
  story: HTMLElement;
  preloader: HTMLElement | null;
  hint: HTMLElement | null;
  cta: HTMLElement | null;
}

export async function startExperience(dom: ExperienceDom, quality: Quality) {
  const lowDetail = quality.tier === 'mobile';
  const building = deriveBuilding(architect.building, lowDetail ? 'low' : 'full');
  const { site } = architect.building;
  const state = createState();

  // Renderer
  const renderer = new WebGLRenderer({
    canvas: dom.canvas,
    antialias: !lowDetail,
    powerPreference: 'high-performance',
  });
  let pixelRatio = quality.pixelRatio;
  renderer.setPixelRatio(pixelRatio);
  renderer.setClearColor(BASE);
  renderer.toneMapping = NeutralToneMapping;
  renderer.shadowMap.enabled = quality.shadows;
  renderer.shadowMap.type = PCFShadowMap;

  const scene = new Scene();
  scene.background = new Color(BASE);
  scene.fog = new Fog(BASE, 60, 200);
  const rig = createCameraRig();

  // The model: building, sketch, plot board and outline lift together in scene 7.
  const model = new Group();
  scene.add(model);
  const shared = createSharedUniforms(building.height, {
    bone: BONE,
    interior: architect.materials.interior,
    balsa: architect.materials.balsa,
  });
  const massing = createMassing(building, architect.materials, shared, { lowDetail, shadows: quality.shadows });
  const sketch = createSketch(building.sketch, BONE, {
    step: lowDetail ? 0.8 : 0.35,
    overshoot: [0.3, 1.1],
    tremor: 0.045,
    strokeShare: 0.16,
    seed: 11,
  });
  const plot = createSite(site.width, site.depth, { bone: BONE, ground: GROUND }, lowDetail ? 0.8 : 0.35);
  plot.board.material.transparent = true;
  plot.board.material.opacity = 0;
  // The board first, then the plan drawn on it, then the frosted walls rising from the plan.
  plot.board.renderOrder = -2;
  const sheet = createPlanSheet(architect.building.plan, site, {
    color: BONE,
    pixelsPerMetre: lowDetail ? 60 : 118,
    font: await letteringFont(),
    offset: planOffset(architect.building.plan),
    height: architect.building.plan.heights.slab,
    maxSize: renderer.capabilities.maxTextureSize,
  });
  model.add(massing.root, sheet.mesh, sketch.mesh, plot.outline.mesh, plot.board);
  scene.add(plot.point);

  const table = createTable({ base: BASE, table: TABLE }, quality.shadows);
  scene.add(table.surface, table.lamp);

  const [baseVolume] = building.volumes;
  const lighting = createLighting(scene, {
    shadows: quality.shadows,
    interiorAt: new Vector3(
      (baseVolume.min[0] + baseVolume.max[0]) / 2,
      1.8,
      (baseVolume.min[2] + baseVolume.max[2]) / 2 + 1,
    ),
  });

  const corner = new Vector3(-site.width / 2, 0, site.depth / 2);
  const pointPosition = plot.point.geometry.attributes.position;
  const point = new Vector3();
  const ground = new Color(GROUND);
  const balsa = new Color(architect.materials.balsa);
  const buffer = new Vector2();

  const layerOffset = (index: number) => state.explode * index * EXPLODE_GAP;

  /** Writes the state into the scene. */
  function apply(s: ExperienceState) {
    rig.apply(s);
    lighting.apply(s);

    shared.uGrow.value = Math.max(s.grow, s.ctaGrow);
    shared.uWave.value = s.wave;
    shared.uInterior.value = s.interior;
    shared.uModel.value = s.model;
    for (const wave of massing.materials) {
      // Frosted parts are drawn without depth so the whole volume reads through itself.
      if (wave.kindIndex < 2) wave.material.depthWrite = s.wave - wave.kindIndex > 0.02;
    }
    LAYERS.forEach((layer, index) => (massing.layers[layer].position.y = layerOffset(index)));
    model.position.y = s.lift;

    sketch.uniforms.uDraw.value = s.sketchDraw;
    // The closing button raises the first floor as a line becoming volume: the sketch rises with it.
    const rising = s.ctaGrow / FIRST_FLOOR;
    sketch.uniforms.uOpacity.value = Math.max(s.sketchOpacity, 0.6 * rising) * (1 - s.model);
    sketch.uniforms.uClip.value = s.ctaGrow > 0.001 ? s.ctaGrow : 1e6;
    sheet.uniforms.uDraw.value = s.plan;
    sheet.uniforms.uOpacity.value = s.planOpacity * (1 - s.model);
    sheet.mesh.visible = s.plan > 0.001 && sheet.uniforms.uOpacity.value > 0.001;
    plot.outline.uniforms.uDraw.value = s.siteDraw;
    plot.outline.uniforms.uOpacity.value = s.siteOpacity * (1 - 0.65 * s.model);

    // The point of light: from the plot's centre to its first corner, then along the pen's path.
    if (s.pointTravel < 1) point.set(0, 0, 0).lerp(corner, s.pointTravel);
    else point.set(...plot.outline.pointAt(s.siteDraw));
    pointPosition.setXYZ(0, point.x, point.y + 0.02, point.z);
    pointPosition.needsUpdate = true;
    plot.pointUniforms.uOpacity.value = s.point;

    plot.board.material.opacity = Math.max(s.ground, s.model);
    plot.board.material.color.copy(ground).lerp(balsa, s.model);
    plot.board.visible = plot.board.material.opacity > 0.001;
    // The endless table exists only in scene 7; elsewhere the ground beyond the plot is the void.
    table.surface.visible = s.table > 0.001;
    table.surface.material.color.copy(table.dark).lerp(table.lit, s.table);
    table.lamp.intensity = s.table * LAMP;

    // Fog follows the camera: the table runs out of sight at any distance.
    const fog = scene.fog as Fog;
    const reach = rig.camera.position.distanceTo(new Vector3(s.targetX, s.targetY, s.targetZ));
    fog.near = reach * 1.15;
    fog.far = reach * 2.9;
  }

  // Render loop: one frame per change, on gsap's clock (the same one Lenis and ScrollTrigger use).
  let dirty = true;
  let currentScene: SceneId = 'vacio';
  let placeWords: (() => void) | null = null;
  const requestRender = () => {
    dirty = true;
  };

  let lastFrame = 0;
  let slowFrames = 0;
  let fastFrames = 0;
  const adaptRatio = (now: number) => {
    const interval = now - lastFrame;
    lastFrame = now;
    if (interval > 100) return;
    if (interval > 24) slowFrames++;
    else if (interval < 18) fastFrames++;
    if (slowFrames + fastFrames < 45) return;
    const step = RATIO_STEPS.findIndex((ratio) => ratio <= pixelRatio);
    if (slowFrames > 30 && step < RATIO_STEPS.length - 1) setRatio(RATIO_STEPS[step + 1]);
    slowFrames = 0;
    fastFrames = 0;
  };

  function draw() {
    apply(state);
    if (currentScene === 'despiece') placeWords?.();
    renderer.render(scene, rig.camera);
  }

  gsap.ticker.add(() => {
    if (!dirty) return;
    dirty = false;
    adaptRatio(performance.now());
    draw();
  });

  function setRatio(ratio: number) {
    pixelRatio = ratio;
    renderer.setPixelRatio(ratio);
    resize();
  }

  function resize() {
    // The canvas's own box, not the window's: a classic scrollbar takes its width out of the stage.
    const width = dom.canvas.clientWidth || innerWidth;
    const height = dom.canvas.clientHeight || innerHeight;
    renderer.setSize(width, height, false);
    rig.resize(width, height);
    renderer.getDrawingBufferSize(buffer);
    for (const lines of [sketch, plot.outline]) {
      lines.uniforms.uResolution.value.copy(buffer);
      lines.uniforms.uWidth.value = (lowDetail ? 1.5 : 1.6) * pixelRatio;
    }
    plot.pointUniforms.uSize.value = 34 * pixelRatio;
    requestRender();
  }
  // The canvas, not the window: a scrollbar that comes or goes resizes the stage without a window resize.
  new ResizeObserver(resize).observe(dom.canvas);
  resize();

  // The first frame compiles every program while the preloader still covers the page.
  apply(state);
  renderer.compile(scene, rig.camera);
  renderer.initTexture(sheet.texture);
  state.point = 1;
  draw();

  history.scrollRestoration = 'manual';
  scrollTo(0, 0);
  const scroll = startScroll(quality.reducedMotion);
  // The hint is also a button: clicked or tapped, it takes the first step of the walk.
  dom.hint?.addEventListener('click', () => scroll.next());
  const content = Object.fromEntries(
    SCENES.map(({ id }) => [id, document.querySelector<HTMLElement>(`[data-scene="${id}"] [data-scene-content]`)]).filter(
      ([, element]) => element,
    ),
  ) as Partial<Record<SceneId, HTMLElement>>;

  if (quality.reducedMotion) {
    finishedBuilding(state, building.height);
    gsap.to(dom.preloader, { opacity: 0, duration: 0.4, onComplete: () => dom.preloader?.remove() });
  } else {
    scroll.stop();
    await playIntro();
    scroll.start();
  }

  const words = new Map<LayerId, HTMLElement>();
  for (const element of document.querySelectorAll<HTMLElement>('[data-layer-word]')) {
    words.set(element.dataset.layerWord as LayerId, element);
  }
  const pointer = quality.reducedMotion
    ? null
    : createPointer({
        canvas: dom.canvas,
        camera: rig.camera,
        state,
        massing,
        layerBounds: building.layerBounds,
        modelBounds: modelBounds(building.layerBounds, site),
        firstFloor: FIRST_FLOOR,
        words,
        cta: dom.cta,
        touch: quality.touch,
        scene: () => currentScene,
        layerOffset,
        requestRender,
      });
  placeWords = pointer ? () => pointer.placeWords() : null;

  const setCtaReachable = (reachable: boolean) => {
    if (dom.cta) dom.cta.style.pointerEvents = reachable ? 'auto' : 'none';
  };
  setCtaReachable(quality.reducedMotion);
  // A keyboard user reaching the button is taken to the scene it belongs to,
  // including one who tabbed to it while the intro was still playing.
  const reachCta = () => currentScene !== 'cierre' && scroll.scrollToEnd();
  dom.cta?.addEventListener('focus', reachCta);
  if (dom.cta && document.activeElement === dom.cta) reachCta();

  const timeline = createTimeline(
    { story: dom.story, content, hint: dom.hint },
    {
      state,
      height: building.height,
      reducedMotion: quality.reducedMotion,
      onUpdate(progress) {
        requestRender();
        const next = sceneAt(progress);
        if (next !== currentScene) {
          currentScene = next;
          if (!quality.reducedMotion) setCtaReachable(next === 'cierre');
          pointer?.sceneChanged(next);
        }
        pointer?.progressed();
      },
    },
  );
  // The walk measures the story the way the timeline does: the trigger's own start and end, kept fresh on resize.
  const trigger = timeline.scrollTrigger;
  if (trigger) {
    scroll.guide({
      toScroll: (progress) => trigger.start + progress * (trigger.end - trigger.start),
      toProgress: (y) => (y - trigger.start) / (trigger.end - trigger.start),
    });
  }
  requestRender();

  /** Scene 1: the point of light leaves the centre, finds a corner and draws the plot. */
  function playIntro() {
    return new Promise<void>((resolve) => {
      const intro = gsap.timeline({ onUpdate: requestRender, onComplete: resolve });
      intro.to(dom.preloader, { opacity: 0, duration: 1.1, ease: 'power2.inOut', onComplete: () => dom.preloader?.remove() }, 0.2);
      intro.to(state, { pointTravel: 1, duration: 1.4, ease: 'power2.inOut' }, 1);
      intro.to(state, { siteDraw: 1, duration: 3, ease: 'power1.inOut' }, 2.35);
      intro.to(state, { point: 0.45, duration: 0.9, ease: 'power1.out' }, 5.1);
      // The fromTo hides the sentence the preloader was covering before the preloader starts to fade.
      if (content.vacio) {
        intro.fromTo(content.vacio, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 1.6, ease: 'power2.out' }, 4.9);
      }
      if (dom.hint) intro.to(dom.hint, { autoAlpha: 1, duration: 1.2, ease: 'power1.out' }, 5.6);
      // Anyone who tries to scroll is not made to wait: the intro hurries to its end.
      const hurry = () => intro.timeScale(5);
      addEventListener('wheel', hurry, { once: true, passive: true });
      addEventListener('touchstart', hurry, { once: true, passive: true });
      addEventListener('keydown', hurry, { once: true });
      dom.hint?.addEventListener('click', hurry, { once: true });
    });
  }
}

/** The family the plan is lettered in, once its two weights have loaded. */
async function letteringFont() {
  const family = getComputedStyle(document.documentElement).getPropertyValue('--font-dm-sans').trim() || 'sans-serif';
  try {
    await Promise.all([document.fonts.load(`400 32px ${family}`), document.fonts.load(`500 32px ${family}`)]);
  } catch {
    // A family the browser cannot load letters the plan in its fallback.
  }
  return family;
}

/** Reduced motion: the building stands finished and still. */
function finishedBuilding(state: ExperienceState, height: number) {
  Object.assign(state, {
    grow: height,
    wave: 3,
    siteDraw: 1,
    siteOpacity: 0.4,
    sketchOpacity: 0,
    planOpacity: 0,
    ground: 1,
    point: 0,
    azimuth: 0.62,
    elevation: 0.3,
    distance: 50,
    targetY: 3.2,
    // The sentences ride the lower left; the building stands right of and above them.
    frameX: 0.16,
    frameY: -0.1,
    sunIntensity: 2.8,
    fill: 0.2,
  });
}

/** The study model's extent: the plot board and everything standing on it. */
function modelBounds(layers: Record<LayerId, Box>, site: { width: number; depth: number }): Box {
  const top = Math.max(...LAYERS.map((layer) => layers[layer].max[1]));
  return { min: [-site.width / 2, -BOARD_THICKNESS, -site.depth / 2], max: [site.width / 2, top, site.depth / 2] };
}
