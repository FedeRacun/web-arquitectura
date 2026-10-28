import { Color, Mesh, MeshStandardMaterial, PlaneGeometry, SpotLight, Object3D } from 'three';
import { BOARD_THICKNESS } from './site';

/*
 * Scene 7's workshop table: a plane that runs out of sight into the dark
 * (the scene fog swallows its edge, so it reads as endless) and one lamp
 * above the model. Both stay dark and off until the model appears.
 */

export interface Table {
  surface: Mesh<PlaneGeometry, MeshStandardMaterial>;
  lamp: SpotLight;
  /** The colour the surface reaches at full lamp light. */
  lit: Color;
  dark: Color;
}

export function createTable(colors: { base: string; table: string }, shadows: boolean): Table {
  const dark = new Color(colors.base);
  const lit = new Color(colors.table);
  const surface = new Mesh(
    new PlaneGeometry(900, 900),
    new MeshStandardMaterial({ color: dark.clone(), roughness: 0.92, metalness: 0 }),
  );
  surface.rotation.x = -Math.PI / 2;
  surface.position.y = -BOARD_THICKNESS - 0.01;
  surface.receiveShadow = shadows;

  const lamp = new SpotLight('#fff3e2', 0, 0, 0.42, 0.85, 1.1);
  lamp.position.set(-14, 70, 26);
  // The lamp aims at the model on the site's centre; its target rides along as a child.
  const target = new Object3D();
  lamp.add(target);
  target.position.set(14, -70, -26);
  lamp.target = target;
  lamp.castShadow = shadows;
  lamp.shadow.mapSize.set(1024, 1024);
  lamp.shadow.radius = 6;
  lamp.shadow.bias = -0.0005;
  lamp.shadow.camera.near = 30;
  lamp.shadow.camera.far = 140;

  return { surface, lamp, lit, dark };
}
