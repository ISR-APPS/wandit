# Campus Numidia

A website starter for a private college in Oran. It has one public page.
The college, the people, the prices, the address, the telephone, and the email are fictional sample content.

## Pages and routes

- `/` is the home page. `src/routes/index.tsx` sets the page title and renders `LandingPage`.
- `/login`, `/app`, and `/app/profile` are the base pages. The home page has no link to them.

## Where the code is

All of the page is in `src/features/landing/`.

- `components/landing-page.tsx` stacks the sections in this order: header, hero, date strip, programmes,
  timetable, campus life, admission, results, questions, enrolment, footer.
- Each section is one file in `components/`, for example `programmes-section.tsx`.
- `lib/timetable.ts` holds the posted week: the hours, the five days, and one entry per cell.
  The hero vignette (`day-vignette.tsx`) shows the Tuesday column of the same week.
- `lib/type-styles.ts` holds the shared class strings: the page column, the section rhythm, the chips, the buttons.
- `landing.css` mixes the sand and the pale sky colors from the theme tokens, and holds the timetable grid,
  the admission rail, the meters, and the reveal motion.
- `hooks/use-block-pop.ts` shows each block when it scrolls into view and counts the meter values up.
- `hooks/use-rail-progress.ts` fills the admission rail while the visitor scrolls.
- The photos are WebP files in `public/images/`. The site icon is `public/favicon.svg`.

## Sample content

- Every text is in `src/shared/i18n/messages.ts`, in the groups `site`, `hero`, `dates`, `programmes`,
  `timetable`, `courses`, `campus`, `admission`, `results`, `faq`, `enrol`, and `footer`.
  Change a text there, not in a component.
- The telephone, the email, and the office hours are in the `site` group. The address is in `enrol`.
  The telephone 041 00 00 00 is a placeholder. Replace it in `site`, `admission.ctaNote`, and `enrol.fallback`.
- The fees, the seats, and the results are sample figures. Replace each one with the real figure.
- The dates of the intake (`dates`, `admission.flagValue`) and of the posted week (`timetable`, `hero`) are fixed texts.
  Update them every year.

## The look

- `src/styles/theme.json` holds the colors and the fonts. Only the host writes it. Change the look with the theme tool.
- The page follows the campus world: white ground, navy ink, one sky accent, sand and pale sky blocks, no shadow.
- The section grounds alternate: white, sand strip, white, pale sky, white, navy, pale sky, white, pale sky.
  Keep one navy band. The theme has no light yellow, so the sand is a beige mix. It stays on small accents.

## How to make each part real

- Timetable: edit `TIMETABLE_CELLS` in `lib/timetable.ts` and the course names in the `courses` group.
  For many classes, create a `timetable_slots` table and read it with `queryOptions` in `api/timetable.queries.ts`.
- Programmes: each programme is one entry in `programmes-section.tsx`, with its texts in the `programmes` group.
  For a longer list, create a `programmes` table with the name, length, seats, and yearly fee.
- Photos: replace the files in `public/images/` with real photos of the campus. Keep the names, or update the `src`.
- Enrolment: the section posts no data. Its actions are a `tel:` link and two `mailto:` links.
  A real application form goes in `components/enrol-section.tsx`, in place of the front-desk plate.
  Follow "Public form contract" in `CLAUDE.md`: one table, one RPC, one server function, and the honeypot field.
- A second language: follow "Languages" in `CLAUDE.md`. The page uses logical classes, so Arabic works.
