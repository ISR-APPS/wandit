# Le Vœu

A website starter for a wedding planner in Algiers. It has one public page.
The studio, the couples, the venues, the prices, the address, the telephone, and the email are fictional sample content.

## Pages and routes

- `/` is the home page. `src/routes/index.tsx` sets the page title, the description, and the icon, and renders `LandingPage`.
- `/login`, `/app`, and `/app/profile` are the base pages. The home page has no link to them.

## Where the code is

All of the page is in `src/features/landing/`.

- `components/landing-page.tsx` stacks the sections in this order:
  header, hero, services, weddings, evening band, process, packages, stationery, reply card, footer.
- Each section is one file in `components/`, for example `weddings-section.tsx`.
- `photo-frame.tsx` is the framed photo with its caption. Every photo of the page uses it.
- `script-word.tsx` draws the script words "Yes", "Together", and the monogram "A&Y".
  The theme has no script face, so `lib/script-outlines.ts` holds the outlines as SVG paths.
- `petal-layer.tsx` draws the petals in the page gutters. `package-carton.tsx` is one price card.
- `reply-card.tsx` is the reply card, with `card-frame.tsx`, `card-field.tsx`, and `card-select.tsx`.
- `site-header.tsx` is the header. `site-menu.tsx` is the phone menu.
- `lib/type-styles.ts` holds the shared class strings. `lib/nav-links.ts` holds the header links.
- `landing.css` holds the page colors made from the tokens, the photo grade, the reply card frames, and the motion.
- `hooks/use-scroll-reveal.ts` shows each block when the visitor scrolls to it.
  `hooks/use-scroll-scrub.ts` moves the petals and the evening photo, and draws the reply card, with the scroll.

## Sample content

- Every text is in `src/shared/i18n/messages.ts`, in the groups `site`, `hero`, `services`, `weddings`,
  `evening`, `process`, `packages`, `stationery`, `reply`, and `footer`. Change a text there, not in a component.
- The telephone is `site.phoneDisplay` and `site.phoneHref`. The email is `site.emailDisplay` and `site.emailHref`.
- The six photos are in `public/images/`. `place-card.webp` is a detail of `table.webp`.
  To change a photo, replace the file or change its path in the section file.
  Give each new photo its `width`, `height`, `alt` text, and caption.
- A new script word needs new outlines in `lib/script-outlines.ts`. Keep at most four script words on the page.
- The site icon is `public/favicon.svg`.

## The look

- `src/styles/theme.json` holds the colors and the fonts. Only the host writes it. Change the look with the theme tool.
- The page uses token classes only. `landing.css` mixes the liner ground, the gold, and the deep rose from the tokens.
- The world rules stay: square corners, gold only as 1px lines, one script word per screen, a caption under every photo.

## How to make each part real

- Studio facts: replace the texts of the `site`, `hero`, `process`, and `footer` groups.
- Weddings: to show more couples, create a `weddings` table with public rows (names, venue, guests, month, photo).
  Read it with `queryOptions` in `api/weddings.queries.ts`, and render the rows with `PhotoFrame`.
- Packages: the three cartons read the `packages` group. Keep the prices of the cartons and the stationery list true.
- Reply card: it posts no data. The fields stay in state, and "Send the card" opens a `mailto:` link with the card in the body.
  With no names or no telephone, the link shows the `reply.missingFields` alert instead.
  A real form goes in `components/reply-card.tsx`: names, telephone, email, date, place, guests, and a message.
  Follow "Public form contract" in `CLAUDE.md`: one `reply_cards` table, one RPC, one server function, and the honeypot field.
  After a valid submit, replace the fields with a success state: the ampersand, "Card received.", and the call-back window.
- A second language: follow "Languages" in `CLAUDE.md`. The page uses logical classes, so Arabic works.
  The script words have no Arabic form: hide them in Arabic and keep the monogram rule.
