# NOUR Objets

A website starter for a concept store of objects and furniture. It has one public page.
The shop, the pieces, the prices, the buyer, the address, the telephone, and the email are fictional sample content.

## Pages and routes

- `/` is the home page. `src/routes/index.tsx` sets the page title and renders `LandingPage`.
- `/login`, `/app`, and `/app/profile` are the base pages. The home page has no link to them.

## Where the code is

All of the page is in `src/features/landing/`.

- `components/landing-page.tsx` stacks the sections in this order:
  header, hero (01), shelf (02), window (03), piece in focus (04), rules (05), quote (06), reservation (07), footer.
- Each section is one file in `components/`, for example `shelf-section.tsx`.
- `plinth.tsx` is the photo plate with its second view. `piece-caption.tsx` is the mono label under a plate.
- `reservation-provider.tsx` holds the basket in React state. `basket-link.tsx`, `reserve-button.tsx`,
  and `reservation-ledger.tsx` read it. `site-menu.tsx` is the phone menu.
- `lib/pieces.ts` holds the eight pieces of the shelf, the plates of each section, and the price format.
- `lib/nav-links.ts` holds the section links. `lib/type-styles.ts` holds the shared class strings.
- `hooks/use-reveal.ts` fades in each block when it comes into view.
  `hooks/use-window-sort.ts` moves the six window plates into price order while the visitor scrolls.
  On a wide screen where the row fits, it pins the section: the plates sort while the section stands still.
- `landing.css` holds the page measures, the seamless tone, the plate, the shelf grid, and the motion states.

## Sample content

- Every text is in `src/shared/i18n/messages.ts`, in the groups `site` to `footer`. Change a text there, not in a component.
- The address, the hours, the telephone, and the email are in the `site` group.
- A piece is one entry of `lib/pieces.ts`: reference, text keys (name, material, dimensions, photo text), price in dinars, stock state, and photo.
- The six photos are in `public/images/`. Each photo is 1440 x 1920 px, one object on a bare ground.
  A new photo needs the same frame, an `alt` text key, and a `closeUpPosition` for the second view.
- The site icon is `public/favicon.svg`.

## The look

- `src/styles/theme.json` holds the colors and the fonts. Only the host writes it. Change the look with the theme tool.
- The page uses token classes only. `landing.css` mixes the seamless tone and the photo tint from the same tokens.
- The display font of the theme is a mono. The class `nour-mono` uses it for every label, reference, and price.
- The world rules stay: square corners, no shadow, one green for stock and for the basket, a mono label under every photo.

## How to make each part real

- Shop facts: replace the texts of the `site`, `hero`, `rules`, `visit`, and `footer` groups.
- Pieces: create a `pieces` table (reference, name, material, dimensions, price, stock, photo path, public flag).
  Read it with `queryOptions` in `api/pieces.queries.ts`, and pass the rows to the sections in place of `lib/pieces.ts`.
  Keep `formatAmount` for the prices.
- Reservation: the basket posts no data. Its actions are a `mailto:` link with the list and a `tel:` link.
  A real reservation form goes in `components/reservation-ledger.tsx`: name, telephone, and the listed references.
  Follow "Public form contract" in `CLAUDE.md`: one `reservations` table, one RPC, one server function, and the honeypot field.
  The RPC checks the stock and the limit of three pieces again. Then the page shows a reference number.
- Quote: the `quote` group holds one buyer. For more quotes, create a `quotes` table with public rows.
- A second language: follow "Languages" in `CLAUDE.md`. The page uses logical classes, so Arabic works.
