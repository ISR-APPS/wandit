# Horizon Voyages

A website starter for a travel agency in Algiers that sells small-group circuits in Algeria. It has one public page.
The agency, the address, the telephone, the email, the licence, the prices, and the traveller quote are fictional sample content.
The places, the hours, and the seasons describe real geography.

## Pages and routes

- `/` is the home page. `src/routes/index.tsx` sets the title, the description, and the icon, and renders `LandingPage`.
- `/login`, `/app`, and `/app/profile` are the base pages. The home page has no link to them.

## Where the code is

All of the page is in `src/features/landing/`.

- `components/landing-page.tsx` stacks the sections in this order:
  header, hero, circuits, the line, the journey, the seasons (the one dark band), the proof, the quote, footer.
- Each section is one file in `components/`, for example `circuits-section.tsx`.
- `locked-photo.tsx` is the photo frame. It puts the horizon of each photo on one height (the "lock").
- `ticket-link.tsx` is the main action, drawn as a boarding strip. `text-link.tsx` is the second action.
- `boarding-pass.tsx` is the quote request. `site-menu.tsx` is the phone menu.
- `lib/photos.ts` holds the six photos and the crop numbers. `lib/circuits.ts` holds the three circuit cards.
- `lib/seasons.ts` holds the season table. `lib/nav-links.ts` holds the header links. `lib/type-styles.ts` holds the shared classes.
- `landing.css` holds the lock arithmetic, the hero and grid geometry, the scrolled strip, the ticket, the pass, and the reveals.
- `hooks/use-scroll-reveal.ts` shows each block when the visitor scrolls to it.
- `hooks/use-line-scrub.ts` moves the strip of "the line" sideways while the visitor scrolls, from 900px wide.
  On a phone, with reduced motion, or with no script, the strip is a swipe area.

## Sample content

- Every text is in `src/shared/i18n/messages.ts`, in the groups `site`, `hero`, `circuits`, `line`, `journey`,
  `seasons`, `proof`, `quote`, and `footer`. Change a text there, not in a component.
- The telephone is `site.phoneDisplay` and `site.phoneHref`. The email is `site.emailDisplay` and `site.emailHref`.
- The quote periods (`quote.periodOptions`) name months and years. Update them each season.
- The six photos are in `public/images/`. To change a photo, replace the file and its size in `lib/photos.ts`.
  Then measure where its horizon sits (0 to 1 from the top) and compute `ty` with the formula in `lib/photos.ts`.
  Check the result on a screenshot: the sun rule must lie on the horizon of the photo.
- `sea.webp` shows a hill town outside Algeria. The strip crops it to sea and sky only. Replace it with a photo of Algiers when you have one.
- The site icon is `public/favicon.svg`.

## The look

- `src/styles/theme.json` holds the colors and the fonts. Only the host writes it. Change the look with the theme tool.
- `landing.css` mixes the sun, the sable ground, and the hairlines from the tokens.
- The world rules stay: square photos with no text on them, one dark band that holds data, and the sun color only for rules,
  the main action, the chip dots, and the season marks.

## How to make each part real

- Agency facts: replace the texts of the `site`, `hero`, `quote`, and `footer` groups.
- Circuits: create a `circuits` table with public rows (name, text, three chips, duration, price, photo).
  Read it with `queryOptions` in `api/circuits.queries.ts`, and render the rows in place of `CIRCUITS`.
  Keep three circuits on wide screens: the grid has three frame heights.
- Seasons: the table reads `SEASON_ROWS`. A `seasons` table with one row per destination and twelve states can replace it.
- Quote: the boarding pass posts no data. It keeps the circuit, the period, and the travellers in state,
  and its action is a `mailto:` link with the request code. A real form goes in `components/boarding-pass.tsx`:
  name, telephone, email, circuit, period, travellers, and a message.
  Follow "Public form contract" in `CLAUDE.md`: one `quote_requests` table, one RPC, one server function, and the honeypot field.
  After a valid submit, replace the pass body with the request code and the reply delay ("reply within 24 h").
- A second language: follow "Languages" in `CLAUDE.md`. The page uses logical classes, so Arabic works.
