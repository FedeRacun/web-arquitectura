import { Color, MeshDepthMaterial, MeshStandardMaterial, RGBADepthPacking, type IUniform } from 'three';
import type { MaterialKind } from './params';

/*
 * The one custom shader: a MeshStandardMaterial patched so the building keeps
 * three.js lights and shadows while the scroll drives it through its states.
 *
 * - uGrow (metres): the extrusion. Vertices above it are pressed down to it,
 *   so the walls rise out of the ground; parts that start above it vanish.
 * - uWave (0..3): the three waves of matter. Wave k sweeps up the building
 *   and turns the parts of kind k (0 concrete, 1 wood, 2 glass) from frosted
 *   glass into their material, with a thin bright front where it passes.
 * - uInterior (0..1): warm light behind the glass.
 * - uModel (0..1): everything becomes the balsa and acetate of a study model.
 *
 * Every texture is procedural: formwork panels with their tie holes for the
 * concrete, grain for the wood, no image is ever downloaded.
 */

export interface SharedUniforms {
  uGrow: IUniform<number>;
  uWave: IUniform<number>;
  uHeight: IUniform<number>;
  uInterior: IUniform<number>;
  uModel: IUniform<number>;
  uBone: IUniform<Color>;
  uInteriorColor: IUniform<Color>;
  uBalsa: IUniform<Color>;
}

export interface WaveMaterial {
  material: MeshStandardMaterial;
  /** Shadow caster that grows with the building. */
  depth: MeshDepthMaterial;
  kindIndex: number;
  uHighlight: IUniform<number>;
}

export const KIND_INDEX: Record<MaterialKind, number> = { concrete: 0, wood: 1, glass: 2 };

export function createSharedUniforms(height: number, colors: { bone: string; interior: string; balsa: string }): SharedUniforms {
  return {
    uGrow: { value: 0 },
    uWave: { value: 0 },
    uHeight: { value: height },
    uInterior: { value: 0 },
    uModel: { value: 0 },
    uBone: { value: new Color(colors.bone) },
    uInteriorColor: { value: new Color(colors.interior) },
    uBalsa: { value: new Color(colors.balsa) },
  };
}

const GROW_VERTEX = /* glsl */ `
  if (uGrow <= aBase + 0.001) transformed = vec3(0.0);
  transformed.y = min(transformed.y, uGrow);
`;

const NOISE = /* glsl */ `
  float waveHash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float waveNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(waveHash(i), waveHash(i + vec2(1.0, 0.0)), u.x), mix(waveHash(i + vec2(0.0, 1.0)), waveHash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float waveFbm(vec2 p) {
    float sum = 0.5 * waveNoise(p) + 0.25 * waveNoise(p * 2.03);
    #ifndef LOW_DETAIL
      sum += 0.125 * waveNoise(p * 4.01);
    #endif
    return sum;
  }

  // Board-formed concrete: 1.2 x 0.6 m panels, their seams and six tie holes each.
  vec3 concreteSurface(vec2 uv) {
    float mottling = waveFbm(uv * 1.6) * 0.65 + waveFbm(uv * 11.0) * 0.35;
    vec3 color = uColor * (0.8 + 0.3 * mottling);
    #ifndef LOW_DETAIL
      vec2 panel = vec2(1.2, 0.6);
      vec2 local = fract(uv / panel) * panel;
      float footprint = max(fwidth(uv.x), fwidth(uv.y));
      float detail = 1.0 - smoothstep(0.01, 0.04, footprint);
      float edge = min(min(local.x, panel.x - local.x), min(local.y, panel.y - local.y));
      float seam = 1.0 - smoothstep(0.004, 0.004 + max(footprint, 0.006), edge);
      vec2 hole = vec2(local.x < 0.6 ? 0.3 : 0.9, local.y < 0.3 ? 0.15 : 0.45);
      float tie = 1.0 - smoothstep(0.016, 0.016 + max(footprint, 0.008), length(local - hole));
      color *= 1.0 - detail * (0.18 * seam + 0.55 * tie);
    #endif
    return color;
  }

  vec3 woodSurface(vec2 uv) {
    float warp = waveNoise(uv * vec2(2.5, 0.35)) * 0.8;
    float rings = 0.5 + 0.5 * sin((uv.x + warp) * 70.0);
    float streak = waveNoise(vec2(uv.x * 40.0, uv.y * 1.5));
    return uColor * (0.74 + 0.2 * rings + 0.16 * streak);
  }

  vec3 balsaSurface(vec2 uv) {
    return uBalsa * (0.9 + 0.1 * waveNoise(vec2(uv.x * 55.0, uv.y * 2.0)));
  }
`;

const SURFACE = /* glsl */ `
  {
    vec3 viewNormal = normalize(normal);
    float facing = clamp(dot(viewNormal, normalize(vViewPosition)), 0.0, 1.0);
    float fresnel = pow(1.0 - facing, 3.0);

    float sweep = clamp(uWave - uKind, 0.0, 1.0);
    float front = mix(-0.6, uHeight + 0.6, sweep);
    float done = 1.0 - smoothstep(front - 0.05, front + 0.05, vObj.y);
    float band = (1.0 - smoothstep(0.0, 0.2, abs(vObj.y - front))) * step(0.001, sweep) * step(sweep, 0.999);

    vec3 axis = abs(vObjNormal);
    vec2 uv = axis.y > 0.5 ? vObj.xz : (axis.x > 0.5 ? vObj.zy : vObj.xy);

    vec3 color;
    float alpha;
    float rough;
    if (uKind < 0.5) {
      color = concreteSurface(uv);
      alpha = 1.0;
      rough = 0.88;
    } else if (uKind < 1.5) {
      color = woodSurface(uv);
      alpha = 1.0;
      rough = 0.6;
    } else {
      color = uColor;
      alpha = 0.34 + 0.5 * fresnel;
      rough = 0.08;
    }

    // The study model: balsa for every solid, clear acetate for the glass.
    if (uKind < 1.5) {
      color = mix(color, balsaSurface(uv), uModel);
    } else {
      color = mix(color, uBalsa * 0.9, uModel * 0.5);
      alpha = mix(alpha, 0.18 + 0.3 * fresnel, uModel);
    }
    rough = mix(rough, 0.8, uModel);

    // Before its wave: frosted glass, milky where it is seen edge-on.
    vec3 frost = uBone * 0.72;
    float frostAlpha = 0.2 + 0.5 * fresnel;

    diffuseColor.rgb = mix(frost, color, done);
    diffuseColor.a = mix(frostAlpha, alpha, done);
    roughnessFactor = mix(0.45, rough, done);
    metalnessFactor = 0.0;

    totalEmissiveRadiance += uBone * band * 0.85;
    totalEmissiveRadiance += uBone * fresnel * (1.0 - done) * 0.08;
    totalEmissiveRadiance += uBone * uHighlight * 0.05;
    if (uKind > 1.5) {
      totalEmissiveRadiance += uBone * fresnel * 0.18 * done;
      float warmth = 0.55 + 0.45 * smoothstep(0.0, 3.0, vObj.y - floor(vObj.y / 3.6) * 3.6);
      totalEmissiveRadiance += uInteriorColor * uInterior * done * warmth * (1.0 - uModel) * 1.4;
    }
  }
`;

export function createWaveMaterial(
  kind: MaterialKind,
  color: string,
  shared: SharedUniforms,
  lowDetail: boolean,
): WaveMaterial {
  const kindIndex = KIND_INDEX[kind];
  const uHighlight: IUniform<number> = { value: 0 };
  const material = new MeshStandardMaterial({ transparent: true, depthWrite: kind !== 'glass' });
  if (lowDetail) material.defines = { LOW_DETAIL: '' };

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, shared, {
      uKind: { value: kindIndex },
      uColor: { value: new Color(color) },
      uHighlight,
    });
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute float aBase;
        uniform float uGrow;
        varying vec3 vObj;
        varying vec3 vObjNormal;`,
      )
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n vObjNormal = objectNormal;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${GROW_VERTEX}\n vObj = transformed;`);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uWave;
        uniform float uHeight;
        uniform float uInterior;
        uniform float uModel;
        uniform float uKind;
        uniform float uHighlight;
        uniform vec3 uColor;
        uniform vec3 uBone;
        uniform vec3 uInteriorColor;
        uniform vec3 uBalsa;
        varying vec3 vObj;
        varying vec3 vObjNormal;
        ${NOISE}`,
      )
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${SURFACE}`);
  };
  material.customProgramCacheKey = () => `wave-${kind}-${lowDetail ? 'low' : 'full'}`;

  const depth = new MeshDepthMaterial({ depthPacking: RGBADepthPacking });
  depth.onBeforeCompile = (shader) => {
    shader.uniforms.uGrow = shared.uGrow;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n attribute float aBase;\n uniform float uGrow;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${GROW_VERTEX}`);
  };
  depth.customProgramCacheKey = () => 'wave-depth';

  return { material, depth, kindIndex, uHighlight };
}
