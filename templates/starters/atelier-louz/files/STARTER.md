# Atelier Louz

A website starter for an interior architecture studio in Algiers. It has one public page.
The studio, the projects, the address, the telephone, and the email are fictional sample content.
The page has no photo. Every room, lamp, and material sample is a drawing in SVG and CSS.

## Pages and routes

- `/` is the home page. `src/routes/index.tsx` sets the page title and renders `LandingPage`.
- `/login`, `/app`, and `/app/profile` are the base pages. The home page has no link to them.

## Where the code is

All of the page is in `src/features/landing/`.

- `components/landing-page.tsx` stacks the sections in this order:
  header, hero, material band, material library, projects, interlude, method, contact, footer.
- Each section is one file in `components/`, for example `projects-section.tsx`.
- The drawings: `arcade-scene.tsx` (hero), `room-vignette.tsx` (living room), `project-scene.tsx` (three projects),
  `swatch-texture.tsx` (six samples). `palm-tuft.tsx` and `hanging-lamp.tsx` are parts that the drawings share.
- `lib/materials.ts` lists the six materials. `lib/sections.ts` lists the header links.
- `landing.css` holds the arch shapes, the drawing colors, the grain, and the motion.
- `hooks/use-scroll-reveal.ts` shows each block when it scrolls into view.
- `hooks/use-active-index.ts` picks the project scene. `hooks/use-scroll-progress.ts` moves the interlude sun.

## The material library

- A click on a sample sets `data-material` on the page root. `landing.css` then gives new values to
  `--louz-tint` (buttons, chips, medallions) and to the `--louz-room-*` colors of the living room.
- To add a material: add its id to `lib/materials.ts`, its texts to the `materials` group,
  its texture to `swatch-texture.tsx`, and its `.louz[data-material="<id>"]` block to `landing.css`.

## Sample content

- Every text is in `src/shared/i18n/messages.ts`, in the groups `site`, `nav`, `hero`, `band`,
  `materials`, `projects`, `interlude`, `method`, `contact`, and `footer`. Change a text there, not in a component.
- The telephone, the email, the address, and the hours are in the `site` group.
- The visit price (8,000 DA) is in `contact.intro`. Replace it with the real price.
- The site icon is `public/favicon.svg`.

## The look

- `src/styles/theme.json` holds the colors and the fonts. Only the host writes it. Change the look with the theme tool.
- `landing.css` mixes every drawing color from the theme tokens with `color-mix()`, for example `--louz-palm`.
  A new theme color changes the drawings too.
- The titles use the display face (Young Serif) at its one weight, 400. Never use italics.
- The world rules stay: arches on every frame and label, no photo, one green interlude, a 4% grain.

## How to make each part real

- Studio facts: replace the texts of the `site` and `contact` groups with the real address, hours, and fees.
- Projects: each project is one entry of `PROJECTS` in `projects-section.tsx`, with its texts in the `projects` group
  and its drawing in `project-scene.tsx`. For many projects, create a `projects` table,
  and read it with `queryOptions` in `api/projects.queries.ts`.
- Contact: the section posts no data. Its actions are a `tel:` link and a `mailto:` link.
  A real visit request form goes in `components/contact-section.tsx`, in place of the three contact boxes.
  Follow "Public form contract" in `CLAUDE.md`: one table, one RPC, one server function, and the honeypot field.
- A second language: follow "Languages" in `CLAUDE.md`. The page uses logical classes, so Arabic works.
