# Stillpoint

A website starter for a yoga and pilates studio. It has one public page.
The studio, the teachers, the schedule, the prices, the quotes, the address, the telephone, and the email are fictional sample content.
The page has no photo. The breathing clock, the day panels, the poses, and the studio room are drawings in SVG and CSS.

## Pages and routes

- `/` is the home page. `src/routes/index.tsx` sets the title, the description, and the icon, and renders `LandingPage`.
- `/login`, `/app`, and `/app/profile` are the base pages. The home page has no link to them.

## Where the code is

All of the page is in `src/features/landing/`.

- `components/landing-page.tsx` stacks the sections in this order: header, hero, manifesto, practices,
  teachers, schedule, studio, memberships, whispers, begin, exhale strip, footer.
- Each section is one file in `components/`, for example `schedule-section.tsx`.
- The drawings: `breath-guide.tsx` (hero clock), `day-panel.tsx` (sun arcs), `pose-figure.tsx` (four poses), `studio-room.tsx` (the room at seven).
- `lib/schedule.ts` holds the week: `WEEK_ROWS` (seven rows, 21 classes) and `sessionsOf()` for the reserve panel.
- `lib/nav-links.ts` lists the header links. `lib/styles.ts` holds the shared title, lede, and button classes.
- `landing.css` holds the page colors, the 14-second breath keyframes, the hour gradients, the room light, and the reveals.
- `hooks/use-scroll-reveal.ts` shows each block when it scrolls into view. `hooks/use-scroll-progress.ts`
  drives the hero drift, the manifesto words, and the room light. `hooks/use-room-clock.ts` moves the room clock.

## Motion

- The hero clock breathes in a 14-second cycle: in for four counts, hold for four, out for six.
- With `prefers-reduced-motion`, every loop stops, the blocks show at once, and the clock shows one still word.

## Sample content

- Every text is in `src/shared/i18n/messages.ts`, in the groups `site`, `hero`, `manifesto`, `practices`, `teachers`,
  `schedule`, `studio`, `memberships`, `whispers`, `begin`, `exhale`, and `footer`. Change a text there, not in a component.
- The telephone, the email, the address, and the hours are in the `begin` group. `site.menuHours` repeats the opening hours in the phone menu.
- The number of classes in `studio.classesValue` (21) agrees with `WEEK_ROWS`. Change both together.
- The footer year comes from the build date. The text after it is `footer.copyright`.
- The site icon is `public/favicon.svg`.

## The look

- `src/styles/theme.json` holds the colors and the fonts. Only the host writes it. Change the look with the theme tool.
- `landing.css` mixes every page color from the theme tokens with `color-mix()`, for example `--sp-terra`.
  A new theme color changes the drawings too.
- The titles use the display face (Fraunces). Its italic is made by the browser, because the theme loads no italic file.

## How to make each part real

- Schedule: create a `classes` table (practice, day, start time, length, mats). Read it with `queryOptions`
  in `api/classes.queries.ts`, and build `WEEK_ROWS` and `sessionsOf()` from the rows.
- Teachers and memberships: `teachers-section.tsx` renders four `TeacherCard`s and `memberships-section.tsx` three `TierCard`s,
  with texts in `messages.ts`. For data that changes, create a `teachers` and a `memberships` table, and map the rows to the cards.
- Booking: the page posts no data. The reserve panel shows the times of the chosen practice, a `mailto:` link with the practice in the subject, and a `tel:` link.
  A real booking form goes in `components/reserve-panel.tsx`, in place of the two buttons.
  Follow "Public form contract" in `CLAUDE.md`: one table, one RPC, one server function, and the honeypot field.
- A second language: follow "Languages" in `CLAUDE.md`. For Arabic, remove the italic classes and keep the studio room drawing as it is.
