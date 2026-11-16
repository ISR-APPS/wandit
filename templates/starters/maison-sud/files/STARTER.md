# Maison Sud

A website starter for an interior architecture studio. It has one public page.
The studio, the projects, the people, the address, the telephone, and the email are fictional sample content.

## Pages and routes

- `/` is the home page. `src/routes/index.tsx` sets the page title and renders `LandingPage`.
- `/login`, `/app`, and `/app/profile` are the base pages. The home page has no link to them.

## Where the code is

All of the page is in `src/features/landing/`.

- `components/landing-page.tsx` stacks the sections in this order:
  header, hero, projects, method, rooms, materials, press, appointment, footer.
- Each section is one file in `components/`, for example `projects-section.tsx`.
- `components/aperture.tsx` is the framed photo. `components/plinth.tsx` is the caption plate on its corner.
- `components/plan-glyph.tsx` holds the small floor plan icons. Do not add another icon set to this page.
- `components/room-walk.tsx` is the room visit. It advances alone. A click on a room shows its photo and stops the clock.
- `lib/rooms.ts` lists the five rooms of the visit. The hero itinerary and the floor plan read the same list.
- `lib/type-styles.ts` holds the class strings of the labels, the titles, and the button.
- `landing.css` holds the plinth shadow, the serif face, the scroll reveals, and the room walk motion.
- `hooks/use-scroll-reveal.ts` shows each block when the visitor scrolls to it.

## Sample content

- Every text is in `src/shared/i18n/messages.ts`, in the groups `site`, `hero`, `projects`, `method`,
  `rooms`, `materials`, `press`, and `contact`. Change a text there, not in a component.
- The telephone and the email are in the `site` group: `phoneDisplay`, `phoneHref`, `email`, `emailHref`.
- The six photos are in `public/images/`. To change a photo, replace the file or change its path in the section file.
  Give each new photo its `width`, `height`, and `alt` text.
- The site icon is `public/favicon.svg`.

## The look

- `src/styles/theme.json` holds the colors and the fonts. Only the host writes it. Change the look with the theme tool.
- The page uses token classes only: `bg-background`, `bg-canvas` (second ground), `bg-card` (plinths),
  `text-primary` (stone), and `text-muted-foreground`.
- The titles use the display face at the regular weight. The class `ms-serif` gives the serif face to names.
- The world rules stay: square corners, no text on a photo, one plinth for each photo, numbered rooms.

## How to make each part real

- Studio facts: replace the texts of the `site` and `contact` groups with the real address, hours, and fees.
- Projects: each project is one block in `components/projects-section.tsx` with its texts in the `projects` group.
  For many projects, create a `projects` table, and read it with `queryOptions` in `api/projects.queries.ts`.
- Rooms: change `lib/rooms.ts` and the `rooms` group. Keep four to six rooms, in the walking order.
- Appointment: the section posts no data. Its two actions are a `tel:` link and a `mailto:` link.
  A real booking form goes in `components/contact-section.tsx`, in the column of the two contact rows.
  Follow "Public form contract" in `CLAUDE.md`: one table, one RPC, one server function, and the honeypot field.
- Press: replace the quote and the three publication names of the `press` group with real ones, or remove the section.
- A second language: follow "Languages" in `CLAUDE.md`. The page uses logical classes, so Arabic works.
