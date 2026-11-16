# studio sable.

A website starter for a design and branding studio. It has one public page. The project index is the home page.
The studio, the projects, the people, the prices, the address, the telephone, and the email are fictional sample content.

## Pages and routes

- `/` is the home page. `src/routes/index.tsx` sets the page title and renders `LandingPage`.
- `/login`, `/app`, and `/app/profile` are the base pages. The home page has no link to them.

## Where the code is

All of the page is in `src/features/landing/`.

- `components/landing-page.tsx` stacks the parts in this order:
  header, index hero, studio, case study, offers, wall, workshop, brief, footer.
- Each section is one file in `components/`, for example `offers-section.tsx`.
- `components/project-index.tsx`, `index-row.tsx`, and `cover-preview.tsx` are the index and the cover that follows the pointer.
- `components/plate.tsx` draws a cover. A cover is type on a flat color. The page has no photo and no image file.
- `components/site-menu.tsx` is the section menu of a phone. It uses the `Sheet` of the kit.
- `lib/projects.ts` lists the six projects. The index, the case study, and the wall read the same list.
- `lib/nav-links.ts` lists the four header links. `lib/type-styles.ts` holds the shared class strings.
- `landing.css` holds the ledger grids, the plates, the cover preview, and the motion.
- `hooks/use-cascade.ts` shows each section when the visitor scrolls to it.
- `hooks/use-case-scrub.ts` opens row 01 of the case study with the scroll, from 1200px.

## Sample content

- Every text is in `src/shared/i18n/messages.ts`, in the groups `site`, `hero`, `projects`, `studio`, `case`,
  `offers`, `wall`, `atelier`, `brief`, and `footer`. Change a text there, not in a component.
- The titles and the prose are lowercase on purpose. Only the mono labels are capitals (class `uppercase`).
- The email and the telephone are in the `site` group (`email`, `phone`, and their links). The site icon is `public/favicon.svg`.

## The look

- `src/styles/theme.json` holds the colors and the fonts. Only the host writes it. Change the look with the theme tool.
- `font-sans` and `font-display` are the grotesk face of the titles and the prose.
- The class `sable-mono` is the ledger face. It reads the display font of the theme, a mono (IBM Plex Mono).
  A new display font in the theme changes each ledger of the page, and the titles of `/login` and `/app`.
- The page uses token classes only: `bg-background` (paper), `text-foreground` (ink), `text-primary` and
  `bg-primary` (ultramarine), and ink opacity steps such as `text-foreground/55`.
- The world rules stay: square corners, no shadow, no gradient, no photo, hairlines of 1px, one accent color.
- A cover uses one of four recipes (`name`, `letter`, `stack`, `point`) and one of four tones
  (`ultra`, `ink`, `sand`, `paper`). Set both in `lib/projects.ts`. Use at most three `ultra` plates on the page.

## How to make each part real

- Projects: change `lib/projects.ts` and the `projects` group. Keep six to nine rows, each with a year, a role, and a scope.
  For many projects, create a `projects` table and read it with `queryOptions` in `api/projects.queries.ts`.
- A page for each project: add `src/routes/work.$projectId.tsx` and a `features/site/work/` folder.
  Then point `targetId` of each row to the new route.
- Case study: change the `case` group. `CASE_PROJECT` in `lib/projects.ts` selects the project.
- Offers: replace the titles, the deliverables, the prices, and the lead times of the `offers` group.
- People and quote: replace the names, the roles, and the quote of the `atelier` group with real ones.
  The years are in `components/atelier-section.tsx`.
- Brief: the section posts no data. Its actions are a `mailto:` link (`brief.sendHref`) and a `tel:` link.
  A real form goes in `components/brief-section.tsx`, in the block "what to write".
  Follow "Public form contract" in `CLAUDE.md`: one table, one RPC, one server function, and the honeypot field.
  Show the block "what happens next" as the success state of the form.
- A second language: follow "Languages" in `CLAUDE.md`. The page uses logical classes, so Arabic works.
