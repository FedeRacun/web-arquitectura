import { CanvasTexture, Color, LinearMipmapLinearFilter, Mesh, PlaneGeometry, ShaderMaterial, type IUniform } from 'three';
import { planDrawing, sheetBounds, type Ink, type PlanDrawing, type Point, type Rect, type SheetFrame, type SheetPlan, type Weight } from './plan';

/*
 * The ground floor plan drafted on the plot at full size, the way a house
 * is set out on site before it is built: the main house's, or another
 * house's with fewer parts (see SheetPlan). The drawing is painted once into
 * a canvas, each ink in its own channel (red: what the plan cuts, green: what
 * it sees, blue: the notes), so the shader can lay them down in the order a
 * drafter does: walls first, then the lines, then the lettering. `uDraw`
 * (0..1) is how far the drafting has got.
 */

export interface PlanSheet {
  mesh: Mesh<PlaneGeometry, ShaderMaterial>;
  uniforms: { uDraw: IUniform<number>; uOpacity: IUniform<number> };
  /** Uploaded while the preloader still covers the page, not on the first frame that shows it. */
  texture: CanvasTexture;
}

export interface PlanSheetOptions {
  color: string;
  /** Canvas pixels per metre of plot. */
  pixelsPerMetre: number;
  /** The font family the lettering is set in, already loaded. */
  font: string;
  /** Plan coordinates to the scene's. */
  offset: { x: number; z: number };
  /** Height the sheet lies at: the top of the ground floor slab. */
  height: number;
  /** Upper bound on the canvas side, the GPU's texture limit. */
  maxSize: number;
}

/** Line widths in metres on the ground: 0.35, 0.22, 0.14 and 0.09 mm at 1:100. */
const WIDTH: Record<Weight, number> = { cut: 0.035, beyond: 0.022, thin: 0.014, hair: 0.009 };
const CHANNEL: Record<Ink, string> = { cut: '#ff0000', line: '#00ff00', note: '#0000ff' };
/** Brick partitions are hatched at 45 degrees, this far apart. */
const HATCH_SPACING = 0.075;
/** DM Sans capitals are about this fraction of the em. */
const CAP_HEIGHT = 0.7;

const VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec3 uColor;
  uniform float uDraw;
  uniform float uOpacity;
  varying vec2 vUv;

  // A front that crosses the sheet west to east while its ink's share of uDraw runs.
  float laid(float start, float end, float along) {
    float t = clamp((uDraw - start) / (end - start), 0.0, 1.0);
    float front = mix(-0.12, 1.12, t);
    return 1.0 - smoothstep(front - 0.1, front, along);
  }

  void main() {
    vec3 ink = texture2D(uMap, vUv).rgb;
    float along = vUv.x * 0.85 + (1.0 - vUv.y) * 0.15;
    float cut = ink.r * laid(0.0, 0.5, along);
    float lines = ink.g * laid(0.25, 0.75, along) * 0.8;
    float notes = ink.b * laid(0.5, 1.0, along) * 0.72;
    float alpha = max(cut, max(lines, notes)) * uOpacity;
    if (alpha < 0.002) discard;
    gl_FragColor = vec4(uColor, alpha);
    #include <colorspace_fragment>
  }
`;

/** Paints the drawing, one channel per ink, onto an opaque black canvas. */
export function paintPlan(
  context: CanvasRenderingContext2D,
  drawing: PlanDrawing,
  toCanvas: (point: Point) => [number, number],
  scale: number,
  font: string,
) {
  const { canvas } = context;
  context.globalCompositeOperation = 'source-over';
  context.fillStyle = '#000';
  context.fillRect(0, 0, canvas.width, canvas.height);
  // Inks add up channel by channel; the opaque ground keeps antialiased edges exact.
  context.globalCompositeOperation = 'lighter';
  context.lineJoin = 'miter';
  const width = (weight: Weight) => Math.max(WIDTH[weight] * scale, 1);
  const rectPath = (rect: Rect) => {
    const [x0, z0] = toCanvas([rect.x[0], rect.z[0]]);
    const [x1, z1] = toCanvas([rect.x[1], rect.z[1]]);
    context.beginPath();
    context.rect(x0, z0, x1 - x0, z1 - z0);
  };

  context.fillStyle = CHANNEL.cut;
  for (const rect of drawing.poche) {
    rectPath(rect);
    context.fill();
  }

  context.strokeStyle = CHANNEL.cut;
  for (const rect of drawing.hatch) {
    context.save();
    rectPath(rect);
    context.clip();
    context.lineWidth = width('hair');
    const [x0, z0] = toCanvas([rect.x[0], rect.z[0]]);
    const [x1, z1] = toCanvas([rect.x[1], rect.z[1]]);
    const step = HATCH_SPACING * scale;
    context.beginPath();
    for (let s = x0 - (z1 - z0); s < x1; s += step) {
      context.moveTo(s, z1);
      context.lineTo(s + (z1 - z0), z0);
    }
    context.stroke();
    context.restore();
    rectPath(rect);
    context.lineWidth = width('cut') * 0.8;
    context.stroke();
  }

  const dashes = { dashed: [0.16, 0.1], axis: [0.6, 0.12, 0.06, 0.12] };
  for (const stroke of drawing.strokes) {
    context.strokeStyle = CHANNEL[stroke.ink];
    context.lineWidth = width(stroke.weight);
    context.setLineDash(stroke.dash ? dashes[stroke.dash].map((d) => d * scale) : []);
    context.lineCap = stroke.dash ? 'butt' : 'square';
    context.beginPath();
    stroke.points.forEach((point, i) => {
      const [x, y] = toCanvas(point);
      if (i === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    if (stroke.closed) context.closePath();
    context.stroke();
  }
  context.setLineDash([]);

  for (const arc of drawing.arcs) {
    context.strokeStyle = CHANNEL[arc.ink];
    context.lineWidth = width(arc.weight);
    const [x, y] = toCanvas(arc.centre);
    context.beginPath();
    context.arc(x, y, arc.radius * scale, arc.from, arc.to);
    context.stroke();
  }

  for (const circle of drawing.circles) {
    context.strokeStyle = CHANNEL[circle.ink];
    context.lineWidth = width(circle.weight);
    const [x, y] = toCanvas(circle.centre);
    context.beginPath();
    context.arc(x, y, circle.radius * scale, 0, Math.PI * 2);
    context.stroke();
  }

  for (const solid of drawing.solids) {
    context.fillStyle = CHANNEL[solid.ink];
    context.beginPath();
    solid.points.forEach((point, i) => {
      const [x, y] = toCanvas(point);
      if (i === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.closePath();
    context.fill();
  }

  context.textBaseline = 'alphabetic';
  for (const label of drawing.labels) {
    const size = (label.size / CAP_HEIGHT) * scale;
    context.font = `${label.bold ? 500 : 400} ${size}px ${font}`;
    context.letterSpacing = label.tracking ? `${label.tracking * size}px` : '0px';
    context.textAlign = label.align ?? 'left';
    context.fillStyle = CHANNEL[label.ink];
    const [x, y] = toCanvas(label.at);
    if (label.quarter) {
      context.save();
      context.translate(x, y);
      context.rotate(-Math.PI / 2);
      context.fillText(label.text, 0, 0);
      context.restore();
    } else {
      context.fillText(label.text, x, y);
    }
  }
  context.letterSpacing = '0px';
}

/**
 * The plot as a canvas at `scale` pixels per metre: its size, plan
 * coordinates to pixels, and the frame the drawing is placed in. `offset`
 * takes plan coordinates to the plot's, whose centre is its origin.
 */
export function sheetLayout(plan: SheetPlan, site: { width: number; depth: number }, offset: { x: number; z: number }, scale: number) {
  // Canvas left is the plot's west edge, canvas top its south (back) edge.
  const toCanvas = ([x, z]: Point): [number, number] => [
    (x + offset.x + site.width / 2) * scale,
    (z + offset.z + site.depth / 2) * scale,
  ];
  const fromScene = (x: number, z: number): Point => [x - offset.x, z - offset.z];
  const [sx0, sz0] = fromScene(-site.width / 2, -site.depth / 2);
  const [sx1, sz1] = fromScene(site.width / 2, site.depth / 2);
  const frame: SheetFrame = { bounds: sheetBounds(plan), sheet: { x: [sx0, sx1], z: [sz0, sz1] } };
  return { width: Math.round(site.width * scale), height: Math.round(site.depth * scale), toCanvas, frame };
}

export function createPlanSheet(plan: SheetPlan, site: { width: number; depth: number }, options: PlanSheetOptions): PlanSheet {
  const scale = Math.min(options.pixelsPerMetre, options.maxSize / Math.max(site.width, site.depth));
  const layout = sheetLayout(plan, site, options.offset, scale);
  const canvas = document.createElement('canvas');
  canvas.width = layout.width;
  canvas.height = layout.height;
  const context = canvas.getContext('2d')!;
  paintPlan(context, planDrawing(plan, layout.frame), layout.toCanvas, scale, options.font);

  const texture = new CanvasTexture(canvas);
  texture.minFilter = LinearMipmapLinearFilter;
  texture.anisotropy = 8;

  const uniforms = {
    uMap: { value: texture },
    uColor: { value: new Color(options.color) },
    uDraw: { value: 0 },
    uOpacity: { value: 1 },
  };
  const material = new ShaderMaterial({
    uniforms,
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -4,
  });
  const mesh = new Mesh(new PlaneGeometry(site.width, site.depth), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = options.height + 0.004;
  // After the plot's board, before the frosted building, so the walls read over their plan.
  mesh.renderOrder = -1;
  return { mesh, uniforms, texture };
}
