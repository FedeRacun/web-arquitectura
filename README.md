# Del trazo al volumen

A one-page site for architects who design and build. The visitor builds a
procedural building with the scroll, across eight scenes: the empty plot, the
sketch and the ground floor plan, the extrusion, the material, the light, the exploded layers, the model
on the table and the closing with a WhatsApp button.

Static Astro site, one Three.js scene, one GSAP ScrollTrigger timeline, Lenis
for the scroll and Tailwind for the page. It deploys to Cloudflare as static
assets, with no server and no adapter.

## Run it

Needs Node 24 (`.node-version`) and pnpm.

```bash
pnpm install
```

```bash
pnpm dev
```

| Script | What it does |
| --- | --- |
| `pnpm dev` | Dev server on http://localhost:4321 |
| `pnpm build` | Static build into `dist/` |
| `pnpm preview` | Serves the build locally |
| `pnpm test` | Unit tests of the pure modules (Vitest) |
| `pnpm check` | Astro and TypeScript diagnostics |
| `pnpm budget` | Fails if the shipped JS is over 250 KB gzip |
| `pnpm verify` | All of the above, in order |
| `pnpm preview:cloudflare` | Build and serve with `wrangler dev` |
| `pnpm deploy:cloudflare` | Build and deploy with `wrangler deploy` |

## Make it someone's

Everything that changes from one architect to the next lives in
[`src/config/architect.ts`](src/config/architect.ts). The building is generated
from these numbers; the code stays as it is.

| Field | Controls |
| --- | --- |
| `accent` | The cursor, the closing button and one word per scene |
| `whatsapp.number` | The number the button opens, in international format |
| `whatsapp.message` | The text the chat starts with |
| `building.site` | The plot drawn in scene 1 and seen from above in scene 8 (metres) |
| `building.plan` | The house itself, in [`src/config/plan.ts`](src/config/plan.ts): both floor plans (walls, doors, windows, columns, the stair, rooms, fittings), the grid, the heights, the blade wall, the galería and the terrace. Scene 2 drafts the ground floor plan from it and scene 3 raises every wall, opening and floor from the same numbers |
| `materials.*` | Concrete, wood, glass, the warm interior light and the balsa of the model |

**Before publishing:** `whatsapp.number` is a placeholder
(`+54 9 11 0000-0000`). Replace it with the real number.

### Fonts

The site uses DM Serif Display and DM Sans, self-hosted at build time. The
brief's first choice, PP Editorial New with Neue Haas Grotesk, needs a licence.
With the licensed files in hand, swap the two `fonts` entries in
[`astro.config.mjs`](astro.config.mjs) to `fontProviders.local()` and keep the
CSS variable names.

## How it works

- **One scene, rendered on demand.** All eight scenes are states of the same
  Three.js scene. A frame is drawn only when the scroll, the pointer or a tween
  changed something.
- **One timeline.** [`timeline.ts`](src/scripts/experience/timeline.ts) places
  every scene on one scrubbed timeline measured in screens of scroll. Each scene
  animates a plain state object; [`main.ts`](src/scripts/experience/main.ts)
  writes that state into the camera, lights and uniforms.
- **Guided scroll.** [`guide.ts`](src/scripts/experience/guide.ts) turns the
  first nudge of each gesture (a wheel turn, a swipe, an arrow, Page or Space
  key) into a glide to the next scene. The glide starts fast, settles into a
  slow, even pace while the scene plays and lands softly. It rests on each
  sentence and on the sun halfway across; the sketch is drawn on the way. The stops are the
  `rest` values in [`scenes.ts`](src/scripts/experience/scenes.ts). The
  scrollbar, Home and End still move freely. On the first scene a quiet
  "Bajar" with a drifting arrow invites the first step; it is a button, so a
  click or a tap takes that step too.
- **Layer words.** In the exploded scene each layer shows its part's name and
  what it does for the house: Estructura (lo que sostiene), Muros (lo que
  protege), Aberturas (lo que deja entrar la luz), Cubierta (lo que cobija).
  They always show, dim, beside their layers; hovering a layer lights its name
  in copper. The words live in
  [`ExplodedWords.astro`](src/components/ExplodedWords.astro). On narrow screens only one word fits, as a
  caption under the stack, so the scene lights the four in turn once the layers
  have come apart; a tap takes over.
- **One custom shader.** [`materialWave.ts`](src/scripts/experience/building/materialWave.ts)
  patches the standard material. It handles the extrusion, the three material
  waves (concrete, wood, glass), the warm interior and the balsa model, so
  lights and shadows stay standard.
- **Deferred start.** The page paints first. The scene, GSAP and Lenis load
  behind the point-of-light preloader. If WebGL is missing or the scene fails,
  the page stays readable: every sentence is real HTML text.

## Devices and preferences

- **Mobile:** simpler geometry, no shadows and a pixel ratio of at most 1.5.
  Taps replace hovers, and the CAD cursor is hidden.
- **Reduced motion:** the building stands finished from the start, and only
  the light follows the scroll. The scroll stays the browser's own, with no
  guided glide.
- **Keyboard:** the WhatsApp link is reachable with Tab. Focusing it scrolls
  to the closing scene.

## Not verified

The brief targets 60 fps on desktop and at least 30 fps on a mid-range
Android. Desktop measured about 90 fps. The Android target has not been
measured on a real device.
