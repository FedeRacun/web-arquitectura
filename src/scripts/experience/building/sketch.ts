import { BufferAttribute, BufferGeometry, Color, DoubleSide, Mesh, ShaderMaterial, Vector2, type IUniform } from 'three';
import type { SketchLine, Vec3 } from './params';

/*
 * Lines drawn like a charcoal sketch, not a CAD wireframe: every stroke
 * overshoots its corners, wavers slightly along its length, thins at its
 * ends, and has a broken, grainy edge. Strokes are camera-facing ribbons of a
 * constant pixel width. `uDraw` (0..1) is how far the drawing has got: each
 * stroke owns a slice of it and is drawn tip first, so when the scroll stops
 * the stroke stops halfway.
 */

export interface SketchOptions {
  /** Metres between tremor samples; larger is cheaper. */
  step: number;
  /** Extra length past each end, as [min, max] metres. */
  overshoot: [number, number];
  /** Sideways waver, metres. */
  tremor: number;
  /** Portion of uDraw each stroke takes; strokes overlap when it is wider than their share. */
  strokeShare: number;
  seed: number;
}

export interface Sketch {
  mesh: Mesh<BufferGeometry, ShaderMaterial>;
  uniforms: {
    uDraw: IUniform<number>;
    uOpacity: IUniform<number>;
    uWidth: IUniform<number>;
    uResolution: IUniform<Vector2>;
  };
  /** The point at `draw` along one stroke, for the point of light that leads the drawing. */
  pointAt(draw: number): Vec3;
}

/** A small deterministic random generator, so every visit draws the same sketch. */
function random(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const addScaled = (a: Vec3, b: Vec3, s: number): Vec3 => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
const length = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);
const normalize = (a: Vec3): Vec3 => {
  const l = length(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

const VERTEX = /* glsl */ `
  uniform vec2 uResolution;
  uniform float uWidth;
  uniform float uDraw;
  attribute vec3 aPrev;
  attribute vec3 aNext;
  attribute float aSide;
  attribute float aAlong;
  attribute float aSeed;
  attribute vec2 aTiming;
  varying float vAlong;
  varying float vSide;
  varying float vReach;
  varying float vSeed;

  void main() {
    mat4 mvp = projectionMatrix * modelViewMatrix;
    vec4 current = mvp * vec4(position, 1.0);
    vec4 previous = mvp * vec4(aPrev, 1.0);
    vec4 next = mvp * vec4(aNext, 1.0);
    vec2 aspect = vec2(uResolution.x / uResolution.y, 1.0);
    vec2 dir = next.xy / next.w * aspect - previous.xy / previous.w * aspect;
    dir = length(dir) < 1e-6 ? vec2(1.0, 0.0) : normalize(dir);
    vec2 offset = vec2(-dir.y, dir.x) / aspect;
    float pressure = 0.45 + 0.55 * sin(3.14159 * aAlong);
    current.xy += offset * aSide * uWidth * pressure / uResolution.y * current.w;
    gl_Position = current;
    vAlong = aAlong;
    vSide = aSide;
    vSeed = aSeed;
    vReach = clamp((uDraw - aTiming.x) / max(aTiming.y - aTiming.x, 1e-4), 0.0, 1.0);
  }
`;

const FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vAlong;
  varying float vSide;
  varying float vReach;
  varying float vSeed;

  float sketchHash(vec2 p) {
    return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453);
  }

  void main() {
    if (vAlong > vReach || vReach <= 0.0) discard;
    float edge = 1.0 - smoothstep(0.35, 1.0, abs(vSide));
    float tooth = sketchHash(vec2(floor(vAlong * 260.0 + vSeed * 97.0), floor(vSide * 3.0)));
    float charcoal = 0.55 + 0.45 * tooth;
    float tip = 1.0 + 0.6 * (1.0 - smoothstep(0.0, 0.04, vReach - vAlong)) * step(vReach, 0.999);
    gl_FragColor = vec4(uColor * tip, uOpacity * edge * charcoal);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function createSketch(lines: SketchLine[], color: string, options: SketchOptions): Sketch {
  const rand = random(options.seed);
  const positions: number[] = [];
  const prevs: number[] = [];
  const nexts: number[] = [];
  const sides: number[] = [];
  const alongs: number[] = [];
  const seeds: number[] = [];
  const timings: number[] = [];
  const indices: number[] = [];
  const strokes: { points: Vec3[]; timing: [number, number] }[] = [];

  const count = lines.length;
  lines.forEach((line, index) => {
    const dir = normalize(sub(line.to, line.from));
    const [minOver, maxOver] = options.overshoot;
    const start = addScaled(line.from, dir, -(minOver + rand() * (maxOver - minOver)) * 0.6);
    const end = addScaled(line.to, dir, minOver + rand() * (maxOver - minOver));
    const span = length(sub(end, start));
    const reference: Vec3 = Math.abs(dir[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
    const side = normalize(cross(dir, reference));
    const lift = normalize(cross(dir, side));
    const samples = Math.max(2, Math.ceil(span / options.step) + 1);
    const phase = rand() * Math.PI * 2;
    const frequency = 1.5 + rand() * 2.5;
    const bow = (rand() - 0.5) * options.tremor * 2;

    const points: Vec3[] = [];
    for (let k = 0; k < samples; k++) {
      const s = k / (samples - 1);
      const waver =
        options.tremor * (Math.sin(s * frequency * Math.PI * 2 + phase) * 0.6 + (rand() - 0.5) * 0.5) +
        bow * Math.sin(s * Math.PI);
      const along = addScaled(start, sub(end, start), s);
      points.push(addScaled(addScaled(along, side, waver), lift, waver * 0.4));
    }

    // Strokes start evenly through uDraw; the last one ends exactly at 1.
    const t0 = count === 1 ? 0 : (index / (count - 1)) * (1 - options.strokeShare);
    const timing: [number, number] = [t0, t0 + options.strokeShare];
    strokes.push({ points, timing });
    const seed = rand();

    points.forEach((point, k) => {
      const previous = points[Math.max(k - 1, 0)];
      const next = points[Math.min(k + 1, points.length - 1)];
      for (const s of [-1, 1]) {
        positions.push(...point);
        prevs.push(...previous);
        nexts.push(...next);
        sides.push(s);
        alongs.push(k / (points.length - 1));
        seeds.push(seed);
        timings.push(...timing);
      }
      if (k > 0) {
        const base = positions.length / 3 - 4;
        indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
      }
    });
  });

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('aPrev', new BufferAttribute(new Float32Array(prevs), 3));
  geometry.setAttribute('aNext', new BufferAttribute(new Float32Array(nexts), 3));
  geometry.setAttribute('aSide', new BufferAttribute(new Float32Array(sides), 1));
  geometry.setAttribute('aAlong', new BufferAttribute(new Float32Array(alongs), 1));
  geometry.setAttribute('aSeed', new BufferAttribute(new Float32Array(seeds), 1));
  geometry.setAttribute('aTiming', new BufferAttribute(new Float32Array(timings), 2));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();

  const uniforms = {
    uDraw: { value: 0 },
    uOpacity: { value: 1 },
    uWidth: { value: 1.5 },
    uResolution: { value: new Vector2(1, 1) },
    uColor: { value: new Color(color) },
  };
  const material = new ShaderMaterial({
    uniforms,
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    depthWrite: false,
    // A ribbon's winding flips with its screen direction: draw both faces.
    side: DoubleSide,
  });
  const mesh = new Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 5;

  const pointAt = (draw: number): Vec3 => {
    const stroke = strokes.find((candidate) => draw <= candidate.timing[1]) ?? strokes[strokes.length - 1];
    const reach = Math.min(Math.max((draw - stroke.timing[0]) / (stroke.timing[1] - stroke.timing[0]), 0), 1);
    const position = reach * (stroke.points.length - 1);
    const k = Math.min(Math.floor(position), stroke.points.length - 2);
    const f = position - k;
    return addScaled(stroke.points[k], sub(stroke.points[k + 1], stroke.points[k]), f);
  };

  return { mesh, uniforms, pointAt };
}
