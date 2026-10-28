# Feature: Del trazo al volumen — scroll-built 3D site for architects

Objective: build the full 8-scene one-page site described in the brief "Del trazo al volumen" (Oct 28, 2026).
Branch: `feat/del-trazo-al-volumen` · Delivery: local work-unit commits only (no remote, no push, no deploy) · Test runner: Vitest (pure modules) + `astro check` + `astro build` + JS budget script + browser inspection.

## Specs

- **S1 Concept.** "El usuario construye un edificio con su scroll." "El edificio es abstracto y procedural: un volumen limpio, casi escultórico, que no pertenece a nadie". "Metáfora central: del trazo al volumen. Cada escena pasa de un estado más abstracto a uno más físico: línea, masa, materia, luz, estructura." "Una sola escena cumple todos los roles: hero, recorrido, maqueta y cierre."
- **S2 Storyboard frame.** "Ocho escenas sobre una sola página larga. El scroll es el único control principal; el mouse agrega matices. Ninguna escena lleva más de una frase de texto, y dos no llevan ninguna. El recorrido completo ocupa entre ocho y diez pantallas de scroll."
- **S3 Scene 1, El vacío.** "Fondo oscuro con grano de hormigón. Un punto de luz del que nace una línea que dibuja un rectángulo en perspectiva: el terreno." Scroll: "Nada todavía. Un indicador sutil invita a bajar." Text: "Primero se piensa. Después se construye."
- **S4 Scene 2, Las líneas.** "Del terreno brotan líneas verticales y horizontales: un wireframe que se dibuja como croquis, con un leve temblor de mano." Scroll: "El scroll dibuja. Si se detiene, el trazo queda a mitad de camino." Text: none.
- **S5 Scene 3, La extrusión.** "Las líneas se levantan y se vuelven muros translúcidos, como vidrio esmerilado. La cámara orbita muy lento." Scroll: "El scroll hace crecer el volumen." Text: "Diseñar es imaginar el peso."
- **S6 Scene 4, La materia.** "Tres olas de shader recorren el volumen de abajo hacia arriba: hormigón, después vanos con madera, después vidrio." Scroll: "El scroll avanza cada ola." Text: "Construir es hacerlo existir."
- **S7 Scene 5, La luz.** "El edificio ya está completo. Las sombras giran sobre la fachada y el interior se ilumina." Scroll/mouse: "El scroll mueve el sol. El mouse inclina apenas la luz hacia el cursor." Text: none.
- **S8 Scene 6, El despiece.** "El edificio se descompone en capas flotantes: estructura, muros, carpinterías, techo. Una axonometría explotada viva." Scroll/mouse: "El scroll separa las capas. El hover sobre cada capa muestra una palabra: Estructura, Envolvente, Luz, Habitar." Text: "Las cuatro palabras".
- **S9 Scene 7, La mesa.** "Las capas se reensamblan y el edificio se vuelve una maqueta pequeña, sola sobre una mesa infinita. El vacío alrededor es parte de la escena." Scroll/mouse: "La cámara se aleja con el scroll. El hover eleva la maqueta unos centímetros." Text: "Cada obra empieza como esta."
- **S10 Scene 8, El cierre.** "Vuelta al terreno vacío de la escena 1, visto desde arriba. Un único botón a WhatsApp." Mouse: "Al pasar el mouse sobre el botón, el terreno extruye un primer piso. El clic abre WhatsApp." Text: "Tu próxima obra."
- **S11 Cross-cutting details.** "El cursor es una cruz fina de plano, como la mira de un CAD. Sobre un elemento interactivo se abre en un cuadrado pequeño." "En pantallas táctiles no existe el hover: las palabras del despiece, la elevación de la maqueta y la extrusión del cierre responden al toque, y el cursor CAD no se muestra." "Sin sonido. La experiencia es visual y silenciosa." "Nada rebota. Todo el movimiento es lento y pesado, como corresponde a una obra."
- **S12 Palette.** Base "#141210, negro cálido" (Fondo y grano de hormigón); Texto "#EDE6DA, blanco hueso" (Tipografía y wireframe); Acento "#B8743A, cobre u ocre" (Cursor, botón, una sola palabra por escena). "El sitio es solo oscuro, sin modo claro; la luz la pone la escena."
- **S13 Typography.** Free option chosen (licensed files unavailable): "DM Serif Display" titles, "DM Sans" body. "DM Serif es solo display, no sirve para párrafos". Licensed swap (PP Editorial New / Neue Haas Grotesk) must stay a one-entry config change.
- **S14 Stack.** "Sitio estático de una sola página: Astro genera el HTML, Cloudflare lo sirve, y un único script cliente orquesta la escena Three.js con el scroll. Sin SSR, sin backend, sin framework de UI." Three.js vanilla, "GSAP ScrollTrigger: Una sola timeline para las ocho escenas", Lenis, Tailwind CSS, "Enlace directo wa.me; sin formulario ni envío". Cloudflare "Sin adapter de Astro".
- **S15 Three decisions.** "Geometría procedural, no modelo." "Cero glTF". "Un solo shader custom. La ola hormigón, madera, vidrio es un ShaderMaterial con un uniform de progreso que GSAP anima con el scroll. El resto son materiales estándar con buenas luces." "Una sola escena y un solo render loop." "Las tres librerías se cargan después del primer paint; el preloader del punto de luz cubre ese tiempo." WebGL renderer.
- **S16 Performance and accessibility.** Mobile: "Geometría más simple, sombras apagadas, pixel ratio limitado a 1.5." Reduced motion: "el edificio aparece construido y solo la luz responde al scroll". JS budget: "todo el JS bajo 250 KB" gzip. Frames: "60 fps en escritorio, nunca por debajo de 30 fps en un Android de gama media". "Cada frase del storyboard existe en el HTML como texto real; el canvas lleva una descripción. El botón a WhatsApp es un enlace accesible por teclado".
- **S17 Exclusions.** "Lo que no incluye en esta etapa: datos personales, casos de éxito, formulario con envío ni sonido. El contacto es un botón directo a WhatsApp."
- **S18 Per-architect parameters.** "parámetros para adaptar proporciones, materiales, acento y número de WhatsApp a cada arquitecto." Generic demo: placeholder WhatsApp number (L2).
- **S19 Location.** Project folder `web-arquitectura` inside `/Users/fedeknispel/Programacion/Propio`.

## Tasks

| ID | Specs | Route | Status | Evidence |
| --- | --- | --- | --- | --- |
| T1 Scaffold, tokens, HTML scenes, preloader, CAD cursor, CTA | S2, S3–S10 text, S11 cursor, S12–S14, S16 a11y, S17–S19 | inline | done | `8600ead`; whatsapp + quality tests green |
| T2 3D core: deferred boot, renderer, Lenis+ScrollTrigger master timeline, camera rig, grain, scene 1 | S1, S3, S14, S15 | inline | done | `3748e47`; scenes + params tests green, scene 1 intro checked in browser |
| T3 Scenes 2–4: sketch wireframe, frosted extrusion, material wave shader | S4–S6, S15 | inline | done | `3b03c3b` + `3748e47`; scenes 2–4 checked at 1440×900 |
| T4 Scenes 5–6: sun and interior light, cursor light tilt, exploded layers with words | S7, S8, S11 | inline | done | `3b03c3b` + `3748e47`; layer-word hover checked per layer |
| T5 Scenes 7–8: model on infinite table, top view closing, CTA first-floor extrusion | S9, S10, S11 | inline | done | `3b03c3b` + `3748e47`; model lift and CTA extrusion checked, wa.me href checked |
| T6 Hardening: mobile tier, reduced motion, a11y, JS budget, inspection, finish review, DESIGN.md, README | S11, S16, S18 | inline | pending | — |

Route evidence: no Writer trigger. All scenes share one scene graph and one master timeline, so units are not disjoint edit surfaces; no context backstop reached. RDD: global off (`gentle-ai review mode status`), so no native review.

## Log

- **L1 (2026-10-28, user request, verbatim):** "Quiero construir el sitio web que detalla el documento adjunto, crealo dentro de una carpeta llamada "web-arquitectura" dentro de "/programacion/propio""
- **L2 (2026-10-28, user answer):** "Demo genérica (Recomendado)" — no studio name, placeholder WhatsApp number in `src/config/architect.ts`.
- **L3 (2026-10-28):** plan approved (stack mirrors `creando-armonia`: Astro 7.4.2, Tailwind 4.3.3, three 0.186.1; plus gsap 3.15.0, lenis 1.3.27, vitest). Impeccable: brief-pinned direction, code-led (no image generation available). Next: T1.
- **L4 (2026-10-28):** Engram mirror `odd/del-trazo-al-volumen/tasks` PENDING: write refused with `session_project_mismatch` (runtime session is bound to the scratch project the session started in). Resync once a session bound to `web-arquitectura` exists.
- **L5 (2026-10-28):** T2–T5 landed as two commits, not four: the scenes share `timeline.ts` and `main.ts`, so per-scene commits would split single files. `3b03c3b` holds the building modules, `3748e47` the scroll experience. Fixes found in the browser: sketch ribbons culled (DoubleSide); 3D lagging the DOM (render on the timeline's own onUpdate, the trigger's does not fire during scrub catch-up); despiece words shifted (a zero GSAP transform on their container became their containing block; words now anchor to each layer's right-most projected edge). Checks: `pnpm test` 24/24, `pnpm check` 0 errors, `pnpm build` ok, `pnpm budget` 189.1 KB gzip of 250 KB. Next: T6.
