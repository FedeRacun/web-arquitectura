import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  Mesh,
  MeshStandardMaterial,
  Points,
  ShaderMaterial,
  type IUniform,
} from 'three';
import { createSketch, type Sketch } from './sketch';
import type { SketchLine } from './params';

/*
 * The plot: its outline drawn by the point of light in scene 1, and a thin
 * board under it that receives the building's shadows and becomes the base
 * of the study model in scene 7.
 */

export interface Site {
  outline: Sketch;
  board: Mesh<BoxGeometry, MeshStandardMaterial>;
  point: Points<BufferGeometry, ShaderMaterial>;
  pointUniforms: { uOpacity: IUniform<number>; uSize: IUniform<number> };
}

export const BOARD_THICKNESS = 0.5;

const POINT_VERTEX = /* glsl */ `
  uniform float uSize;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize;
  }
`;

const POINT_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float core = 1.0 - smoothstep(0.0, 0.09, d);
    float halo = pow(1.0 - clamp(d, 0.0, 1.0), 3.0) * 0.55;
    gl_FragColor = vec4(uColor, (core + halo) * uOpacity);
    #include <colorspace_fragment>
  }
`;

export function createSite(width: number, depth: number, colors: { bone: string; ground: string }, step: number): Site {
  const w = width / 2;
  const d = depth / 2;
  // Drawn as one pen run: from the front-left corner, clockwise seen from above.
  const edges: SketchLine[] = [
    { from: [-w, 0, d], to: [w, 0, d], direction: 'horizontal' },
    { from: [w, 0, d], to: [w, 0, -d], direction: 'horizontal' },
    { from: [w, 0, -d], to: [-w, 0, -d], direction: 'horizontal' },
    { from: [-w, 0, -d], to: [-w, 0, d], direction: 'horizontal' },
  ];
  const outline = createSketch(edges, colors.bone, {
    step,
    overshoot: [0.15, 0.45],
    tremor: 0.03,
    strokeShare: 0.25,
    seed: 7,
  });
  outline.mesh.position.y = 0.02;

  const board = new Mesh(
    new BoxGeometry(width, BOARD_THICKNESS, depth),
    new MeshStandardMaterial({ color: new Color(colors.ground), roughness: 0.95, metalness: 0 }),
  );
  board.position.y = -BOARD_THICKNESS / 2;
  board.receiveShadow = true;

  const pointUniforms = {
    uOpacity: { value: 0 },
    uSize: { value: 40 },
    uColor: { value: new Color(colors.bone) },
  };
  const pointGeometry = new BufferGeometry();
  pointGeometry.setAttribute('position', new BufferAttribute(new Float32Array(3), 3));
  const point = new Points(
    pointGeometry,
    new ShaderMaterial({
      uniforms: pointUniforms,
      vertexShader: POINT_VERTEX,
      fragmentShader: POINT_FRAGMENT,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: AdditiveBlending,
    }),
  );
  point.frustumCulled = false;
  point.renderOrder = 10;

  return { outline, board, point, pointUniforms };
}
