# Domaine Les Palmiers

A website starter for a property developer that sells twelve villas in a walled pine park. It has one public page.
The developer, the estate, the people, the prices, the address, the telephone, and the email are fictional sample content.

## Pages and routes

- `/` is the home page. `src/routes/index.tsx` sets the page title, the description, and the icon, and renders `LandingPage`.
- `/login`, `/app`, and `/app/profile` are the base pages. The home page has no link to them.

## Where the code is

All of the page is in `src/features/landing/`.

- `components/landing-page.tsx` stacks the sections in this order:
  header, hero, the estate, the villas, the visit, the evening band, the specification, the lots, contact, footer.
- Each section is one file in `components/`, for example `villas-section.tsx`.
- `aperture.tsx` is the framed photo. `price-plate.tsx` and `reference-strip.tsx` are the plate and the strip on a photo.
- `ledger.tsx` is the list of facts in hairline rows. `section-head.tsx` is the label, the title, and the first paragraph of a section.
- `room-tour.tsx` is the tour of four rooms in one frame. A bronze fill under the frame is its clock.
- `visit-request.tsx` is the visit request of the contact section, and `request-field.tsx` is one of its two selects.
  `site-menu.tsx` is the phone menu.
- `lib/lots.ts` holds the rows of the price table. `lib/rooms.ts` holds the four rooms of the tour.
- `lib/nav-links.ts` holds the header links. `lib/type-styles.ts` holds the shared class strings.
- `landing.css` holds the photo grade, the strip grid, the room tour, and the reveal states.
- `hooks/use-scroll-reveal.ts` shows each block when the visitor scrolls to it. `hooks/use-in-view.ts` runs the tour clock.

## Sample content

- Every text is in `src/shared/i18n/messages.ts`, in the groups `site`, `hero`, `estate`, `villas`, `visit`,
  `evening`, `spec`, `lots`, `contact`, and `footer`. Change a text there, not in a component.
- The telephone is only in `site.phoneDisplay` and `site.phoneHref`. The email is `contact.emailValue` and `contact.emailHref`.
- The lots lede gives counts of sold and free lots (`lots.lede`). Keep them equal to the rows of `lib/lots.ts`.
- The six photos are in `public/images/`. To change a photo, replace the file or change its path in the section file.
  Give each new photo its `width`, `height`, and `alt` text. The CSS gives every photo the same dusk grade.
- The site icon is `public/favicon.svg`.

## The look

- `src/styles/theme.json` holds the colors and the fonts. Only the host writes it. Change the look with the theme tool.
- The page uses token classes only. `landing.css` mixes the deep bronze and the hairlines from the tokens.
- The world rules stay: square corners, no shadow, no text on a photo, a label on a rule or in a cell,
  and bronze only for small labels, a few accents, the free lots, and the tour clock.

## How to make each part real

- Developer facts: replace the texts of the `site`, `estate`, `contact`, and `footer` groups.
- Villa types: each card of `villas-section.tsx` reads the `villas` group. The lots of the cards and the hero plate read the same keys.
- Lots: create a `lots` table with public rows (ref, type, surface, bedrooms, price, status).
  Read it with `queryOptions` in `api/lots.queries.ts`, and render the rows in place of `REMAINING_LOTS`.
  Keep the lede of the section true: the count of free lots must match the rows.
- Room tour: add or remove an entry of `TOUR_ROOMS`, with its texts in the `visit` group. Four rooms fit the rail best.
- Contact: the visit request posts no data. It keeps the villa and the evening in state, and its action is a `mailto:` link.
  A real form goes in `components/visit-request.tsx`: name, telephone, villa, evening, and a message.
  Follow "Public form contract" in `CLAUDE.md`: one `visit_requests` table, one RPC, one server function, and the honeypot field.
  After a valid submit, replace the form with a bordered plate that says who calls back and when.
- A second language: follow "Languages" in `CLAUDE.md`. The page uses logical classes, so Arabic works.
