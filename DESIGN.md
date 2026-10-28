---
name: Del trazo al volumen
description: A one-page scroll-driven WebGL scene where the visitor builds a building from a charcoal line to a finished volume.
colors:
  base: "#141210"
  bone: "#ede6da"
  accent: "#b8743a"
  ground: "#2b2723"
  table: "#8f877b"
  concrete: "#a5a29e"
  wood: "#8b5a34"
  glass: "#2a3436"
  interior: "#f2bd7c"
  balsa: "#d9c7a6"
typography:
  display:
    fontFamily: "DM Serif Display, serif"
    fontSize: "clamp(2.1rem, 0.95rem + 3.5vw, 5rem)"
    fontWeight: 400
    lineHeight: 1.04
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "DM Serif Display, serif"
    fontSize: "clamp(2rem, 1.2rem + 3vw, 3.75rem)"
    fontWeight: 400
    lineHeight: 1.05
  label:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "clamp(0.95rem, 0.85rem + 0.35vw, 1.15rem)"
    fontWeight: 500
    letterSpacing: "0.01em"
  button:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 500
    letterSpacing: "0.005em"
rounded:
  none: "0px"
spacing:
  gutter: "clamp(1.25rem, 6vw, 6rem)"
  sentence-low: "12svh"
  sentence-high: "14svh"
  leader-gap: "0.9rem"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.base}"
    typography: "{typography.button}"
    rounded: "{rounded.none}"
    padding: "1.15rem 2rem 1.2rem"
  button-primary-hover:
    backgroundColor: "{colors.bone}"
    textColor: "{colors.base}"
  scene-sentence:
    textColor: "{colors.bone}"
    typography: "{typography.display}"
  layer-word:
    textColor: "{colors.bone}"
    typography: "{typography.label}"
  layer-word-active:
    textColor: "{colors.accent}"
---

# Design System: Del trazo al volumen

## Overview

**Creative North Star: "The Drawing Board at Night"**

One continuous dark frame in which a building is drawn, raised, clad, lit, taken apart and shrunk to a model, all driven by the visitor's scroll. The page has no chrome: no nav, no logo, no cards, no grid of content. Each scene carries at most one sentence, set large in a serif and given air, while the 3D scene does the rest of the talking. Interface marks borrow from the drafting table: hairline leader lines like axonometric callouts, a plumb line for the scroll hint, a CAD crosshair for the pointer.

Material character comes from architecture rather than from UI: board-formed concrete with formwork tie holes, warm wood, dark glass, hard raking light, and a balsa study model under one lamp. Everything is procedural; no image is downloaded. A fine concrete grain sits over the whole frame, scene included.

Motion is slow and heavy: every transition decelerates like a load settling, nothing bounces, there is no sound. Stopping the scroll leaves the stroke or the extrusion halfway. Under reduced motion the finished building stands still and only the light follows the scroll.

**Key Characteristics:**
- Three interface colours (warm black, bone, copper) and two faces.
- One sentence per scene, display serif, at most one copper word in it.
- Hairline (1px) linework for every interface mark; no boxes, no radii.
- Charcoal sketch strokes that overshoot corners, waver and thin at their ends.
- A single heavy easing curve for every CSS transition.

## Colors

A warm near-black ground with bone type and linework, and one copper accent kept rare; the remaining tones belong to the 3D world and are set per architect.

### Primary
- **Workshop Copper** (accent): the CAD cursor, the closing WhatsApp button, the one emphasised word of a scene sentence, the active leader line and layer word in the exploded view, and text selection. Overridden per architect from `src/config/architect.ts` (Base.astro writes it onto `<html>`).

### Neutral
- **Warm Black** (base): the page, the preloader, the WebGL clear colour, and the text colour on the copper and bone button states.
- **Bone** (bone): all type, the charcoal sketch strokes, the point of light, hairlines at reduced strength (leader lines at 45%, the scroll-hint line at 28%, scrollbar thumb at 22%, all via `color-mix` in oklab), and the focus outline.

### Scene Materials (3D only, per architect)
- **Site Board** (ground): the plot's board once the building stands on it.
- **Workshop Table** (table): the table under the lamp in the model scene.
- **Formwork Concrete** (concrete), **Oiled Wood** (wood), **Dark Glass** (glass): the three waves of matter that sweep up the building.
- **Lamplight** (interior): the warm light behind the glass in the light scene.
- **Balsa** (balsa): every solid of the study model.

These never appear as interface fills; they live inside the shader.

### Named Rules
**The One Copper Word Rule.** A scene sentence carries at most one copper word, set through `<em>` (rendered upright, never italic). Copper appears elsewhere only on the cursor, the closing button and the active exploded-view layer.

**The Three Colours Rule.** The interface palette is base, bone and copper; Tailwind's default colours are cleared (`--color-*: initial`). Tints come from `color-mix` of bone, not from new hexes.

## Typography

**Display Font:** DM Serif Display (with serif fallback)
**Body Font:** DM Sans (with sans-serif fallback), weights 400 and 500

**Character:** A high-contrast editorial serif speaks the sentences; a quiet grotesk handles the few functional labels. DM Serif Display and DM Sans are free stand-ins for the licensed PP Editorial New and Neue Haas Grotesk; the swap point is the two `fonts` entries in `astro.config.mjs` (keep the `--font-dm-serif-display` and `--font-dm-sans` variables and nothing else changes).

### Hierarchy
- **Display** (400, clamp(2.1rem, 0.95rem + 3.5vw, 5rem), 1.04): the one sentence per scene. Balanced wrap, max 13ch; a two-clause sentence sets each clause on its own line and drops the measure.
- **Headline** (400, clamp(2rem, 1.2rem + 3vw, 3.75rem), 1.05): the exploded-view layer words ("Estructura", "Envolvente", "Luz", "Habitar") when they read as a column, and on narrow screens as the caption under the stack (fixed 2.25rem).
- **Label** (DM Sans 500, clamp(0.95rem, 0.85rem + 0.35vw, 1.15rem), 0.01em): the layer words hung off their leader lines on wide screens.
- **Button** (DM Sans 500, 1.125rem, 0.005em): "Escribir por WhatsApp".

### Named Rules
**The Sentence, Not a Heading Rule.** Display type is used for whole sentences, not for titles over content. There are no eyebrows, kickers or small caps above them.

**The Upright Emphasis Rule.** `em` is never italic; emphasis is colour (copper) alone.

## Layout

There is no grid or container. Each storyboard scene is a section as tall as its share of the scroll (`--screens × 100lvh`); with the experience running, its content is pinned to the viewport and faded by the master timeline. Sentences sit at one of five placements over the scene: centre-low (11svh from the bottom), left-low or right-high / left-high (side inset by the gutter, 12svh from the bottom or 14svh from the top), or centre (the closing, sentence at 14svh and button at 12svh from the bottom). Placement alternates against the building's framing so text never sits on the volume.

Without WebGL the sections read as a plain sequence of centred sentences (min-height 100svh, 6rem × 1.5rem padding). Under reduced motion each sentence rides its own section, sticky and left-aligned at the gutter, 12svh above the bottom.

Below 768px the exploded-view words leave the side of the stack and become a single centred caption, hung from the tapped layer by a vertical plumb line. Copy uses `svh` for placement and `lvh` for scroll length.

## Elevation & Depth

The interface is flat: no box shadows, no layered surfaces. Depth belongs entirely to the WebGL scene (three.js lights, shadow casting, hard sun raking the concrete, a single lamp over the model). The only CSS glow is the preloader's point of light, which hands over to the same point drawn in WebGL.

Stacking is by role, not elevation: scene content 20, preloader 30, grain 40, cursor 50.

### Shadow Vocabulary
- **Point of light** (`box-shadow: 0 0 6px 1px color-mix(in oklab, var(--color-bone) 80%, transparent), 0 0 28px 6px color-mix(in oklab, var(--color-bone) 18%, transparent)`): the 5px preloader point only.

### Named Rules
**The Depth Lives in the Scene Rule.** Interface elements never cast shadows; anything that needs depth is built in the 3D scene and lit.

## Shapes

Square and hairline. Every interface mark has square corners (0px): the button, the cursor's pick box, the scroll-hint tick. Lines are 1px: leader lines, the plumb line, the cursor arms (2.25rem long), the focus outline (offset 6px). The single circle is the 5px point of light. In the scene, strokes are camera-facing ribbons of constant pixel width with broken, grainy edges, never clean CAD wireframes.

## Components

### Buttons
The one action on the page, held back until the last scene.
- **Shape:** square corners (0px).
- **Primary:** copper fill, warm-black text, DM Sans 500 at 1.125rem, padding 1.15rem 2rem 1.2rem.
- **Hover / Focus:** fill shifts to bone over 0.6s on the settle curve; focus shows the global 1px bone outline at 6px offset; pressed nudges down 1px. The same bone state shows while the scene extrudes the button.
- Opens WhatsApp in a new tab and says so to screen readers ("(se abre en una pestaña nueva)").

### Leader-line Callout (signature)
The exploded axonometric's four layer words. Each hangs off its layer on a 1px bone line at 45% strength (clamp(1.75rem, 4vw, 3.5rem) long, 0.9rem gap). The words always read at 60% opacity, so nobody has to find the hover to learn the layers. Hover or tap lengthens the line to clamp(3rem, 7vw, 6rem), turns it copper and lights the word to full copper, all over 0.9s on the settle curve. On narrow screens only one word fits: the line becomes a vertical plumb line that scales down from the layer to a display-serif caption, hidden until active, and the scene lights the four in turn, 1.2s apart, once the layers have come apart.

### CAD Cursor
Replaces the pointer on hover-capable devices: a copper crosshair of two 1px arms; over anything interactive the cross folds into a 0.875rem square pick box (0.45s, settle curve).

### Scroll Hint
Scene 1 only: a 1px plumb line, 3.25rem tall, bone at 28%, with a 5px bone tick sliding down it every 3.2s. Still under reduced motion.

### Preloader
A full warm-black cover with a breathing 5px point of light (2.8s, alternate) placed where the scene's own point appears, 8vh above centre; it fades out over 1.2s as the WebGL point takes over.

## Do's and Don'ts

### Do:
- **Do** use the settle curve (`cubic-bezier(0.22, 0.61, 0.24, 1)`) for every CSS transition, with durations between 0.4s and 1.2s.
- **Do** keep scene choreography on `power1`/`power2` in-out curves with scrub smoothing; nothing overshoots.
- **Do** draw every interface mark as a 1px line in bone or copper.
- **Do** keep one sentence per scene, display serif, with at most one copper word.
- **Do** generate textures procedurally (formwork panels and tie holes, wood grain, the SVG grain overlay at 9% soft-light).
- **Do** give reduced motion the finished building, with only the light following the scroll.

### Don't:
- **Don't** add colours beyond base, bone and copper to the interface; derive tints with `color-mix` of bone.
- **Don't** round corners or add box shadows to interface elements.
- **Don't** use bounce, spring, or overshoot easing, and don't add sound.
- **Don't** italicise emphasis; copper is the emphasis.
- **Don't** put a nav, logo or second action on the page; the single action arrives in the last scene.
- **Don't** render the building as a clean CAD wireframe; strokes overshoot, waver and thin like charcoal.
