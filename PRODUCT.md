# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Astro (static output, no adapter) served by Cloudflare static assets; one client script orchestrates a vanilla Three.js scene with GSAP ScrollTrigger and Lenis; Tailwind CSS outside the canvas. Pinned by the brief "Del trazo al volumen" (Oct 28, 2026).

## Users

Prospective clients of an architect who both designs and builds: people evaluating whom to trust with their next building. The site is first shown as a generic demo of the system to architects who would adopt it.

## Product Purpose

A one-page site where the visitor builds a building with their scroll, from a line to a finished volume, so the architect's business differential (designing and building) is demonstrated rather than claimed. Success: the visitor reaches the closing scene and opens WhatsApp.

## Positioning

The building is procedural: the same site is a system that can be re-dressed for each architect by changing proportions, materials, accent color and WhatsApp number. It is not a render gallery.

## Capabilities and Constraints

- Eight scenes on one long page; the scroll is the main control, the mouse adds nuance; touch replaces hover with taps.
- Contact is a direct wa.me link; no form, no backend.
- Excluded in this stage: personal data, case studies, form submission, sound.
- Generic demo: no studio name; the WhatsApp number is a placeholder in `src/config/architect.ts` (to replace per architect).

## Evidence on Hand

None. No photographs, projects, testimonials or client names exist and none may be fabricated; the procedural building is the only demonstration.

## Product Principles

- 3D only where it tells the business story: design, then build.
- One sentence per scene at most; the work speaks.
- Performance is a design rule: the mobile degraded version is budgeted from day one.
- Everything moves slow and heavy, like a building; nothing bounces.

## Accessibility & Inclusion

Every storyboard sentence exists as real HTML text; the canvas carries a description; the WhatsApp link is keyboard reachable; `prefers-reduced-motion` shows the finished building with only the light following the scroll.
