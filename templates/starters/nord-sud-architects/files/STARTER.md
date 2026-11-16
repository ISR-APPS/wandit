# Atelier Nord-Sud

A website starter for an architecture studio. It has one public page, drawn as an execution drawing.
The page has no photo and no image file. Each figure is an inline SVG that a "plotter" draws.
The studio, the projects, the fees, the address, the telephone, and the email are fictional sample content.

## Pages and routes

- `/` is the home page. `src/routes/index.tsx` sets the page title and renders `LandingPage`.
- `/login`, `/app`, and `/app/profile` are the base pages. The home page has no link to them.

## Where the code is

All of the page is in `src/features/landing/`.

- `components/landing-page.tsx` stacks the parts in this order:
  header, hero (sheet 01), plan (PL·02), sheets, missions, method, figures, contact, cartouche footer.
- Each section is one file in `components/`, for example `missions-section.tsx`.
- The drawings are `south-elevation.tsx`, `villa-plan.tsx`, `bologhine-sheet-plan.tsx`,
  `lauriers-sheet-elevation.tsx`, and `casbah-sheet-section.tsx`.
- `components/site-menu.tsx` is the section menu of a phone. It uses the `Sheet` of the kit.
- `lib/content.ts` lists the section links, the plan phases, the missions, the method phases, and the figures.
- `lib/format.ts` formats metres, areas, and levels with `Intl.NumberFormat`.
- `lib/styles.ts` holds the shared class strings. `landing.css` holds the graph paper, the strokes, and the motion.

## The motion

- Each figure reads the CSS property `--plot`, from 0 (blank) to 1 (complete). A line draws in its own window.
- The hero plots once on load. Each other figure plots once when it enters the screen (`hooks/use-scroll-reveal.ts`).
- From 1024px the scroll draws the villa plan (`hooks/use-plan-progress.ts`). The rail shows the six phases.
- With less motion, or with no script, each figure shows complete.

## Sample content

- Every text is in `src/shared/i18n/messages.ts`, in the groups `site`, `nav`, `hero`, `plan`, `sheets`,
  `missions`, `method`, `figures`, `contact`, and `footer`. Change a text there, not in a component.
- The address, the telephone, and the email are in the `site` group. The site icon is `public/favicon.svg`.
- The date cells show the current month. They fill after the page loads.

## The look

- `src/styles/theme.json` holds the colors and the fonts. Only the host writes it. Change the look with the theme tool.
- `.ns-title` reads the display face of the theme at weight 800 (the current theme uses Archivo). `font-display` is the mono of the labels. `font-sans` is the prose.
- The page uses token classes only: `bg-background` (paper), `text-foreground` (ink), `info` (the cyan grid),
  and `primary` (the red pencil). Ink opacity steps such as `text-foreground/60` give the grey lines.
- The red pencil marks three things only: the plan markup, the fee ring of mission 02, and the visa.
  Keep that limit. The buttons are ink, never red.
- The world rules stay: square corners, no shadow, no gradient, no photo.

## How to make each part real

- Projects: change the `sheets` group and `components/sheets-section.tsx`. Each sheet has its own drawing.
  For many projects, create a `projects` table and read it with `queryOptions` in `api/projects.queries.ts`.
- Missions and fees: change `MISSIONS` in `lib/content.ts` and the `missions` group.
- Method: change `METHOD_PHASES` in `lib/content.ts`. Keep the weeks and the total in the `method` group equal.
- Figures: change `STUDIO_FIGURES` in `lib/content.ts` and the `figures` group.
- Study request: the section posts no data. Its actions are a `mailto:` link with the subject and a `tel:` link.
  A real form goes in `components/study-request.tsx`. Follow "Public form contract" in `CLAUDE.md`:
  one table, one RPC, one server function, and the honeypot field.
- A second language: follow "Languages" in `CLAUDE.md`. The page uses logical classes, so Arabic works.
