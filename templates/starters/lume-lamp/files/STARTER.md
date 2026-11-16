# LUME

A website starter for one product: Orbe N°1, a numbered ceramic table lamp. It has one public page.
The atelier, the lamp, the prices, the edition count, the reviews, and the email are fictional sample content.

## Pages and routes

- `/` is the product page. `src/routes/index.tsx` sets the page title and renders `LandingPage`.
- `/login`, `/app`, and `/app/profile` are the base pages. The product page has no link to them.

## Where the code is

All of the page is in `src/features/landing/`.

- `components/landing-page.tsx` holds the colorway state (Crème or Noir) and stacks the sections in this order:
  announce bar, header, hero, ticker, design, noir, breath, specs, reviews, reserve, questions, footer.
- Each section is one file in `components/`, for example `specs-section.tsx`.
- `colorway-toggle.tsx`, the noir button, and the cards of `reserve-section.tsx` all change the colorway.
  The hero photo, the header and hero colors, the reserve photo, and the reservation email follow it.
- `quantity-stepper.tsx` and `edition-meter.tsx` are parts of the reserve section. `site-menu.tsx` is the phone menu.
- `lib/offer.ts` holds the price, the edition size, the reserved count, the quantity limit, the email, and the `mailto:` builders.
- `lib/colorways.ts` holds the two colorways and their photos. `lib/nav-links.ts` holds the section links.
- `lib/type-styles.ts` holds the class strings that several sections share.
- `hooks/use-reveal.ts` shows each block when it comes into view.
  `hooks/use-scroll-progress.ts` moves the photo of the breath band a little.
  `hooks/use-count-up.ts` counts the edition number up. `hooks/use-is-scrolled.ts` changes the header after 32 px.
- `landing.css` holds the page measures, the colorway variables, the arch frame, the grain, and the motion.
  All motion stops when the visitor asks for reduced motion.

## Sample content

- Every text is in `src/shared/i18n/messages.ts`, in the groups `site` to `footer`. Change a text there, not in a component.
- The price, the edition, and the email are in `lib/offer.ts`. The hero, the meter, and the reserve card read them.
  Some texts in `messages.ts` also say "250" or "$249". When you change a number, search for it there too.
- The four photos are in `public/images/`: the Crème lamp, the Noir lamp, a detail, and the lamp on a desk.
  A new colorway photo needs the same frame (about 4:5) and an `alt` text key.
- The site icon is `public/favicon.svg`.

## The look

- `src/styles/theme.json` holds the colors and the fonts. Only the host writes it. Change the look with the theme tool.
- The page uses token classes only. `landing.css` mixes the brass, the glow, and the Noir ground from the same tokens.
- The display font of the theme gives the italic turn word of each title (`.lume-turn`).
- The page rules stay: arch photo frames, pill buttons, brass for the accent, a figure caption under each photo.

## How to make each part real

- Shop facts: replace the texts of the `site`, `announce`, `hero`, `specs`, `faq`, and `footer` groups.
- Offer: create a `products` table (name, price, regular price, edition size, public flag) and a `colorways` table
  (product, key, name, photo path, stock). Read them with `queryOptions` in `api/products.queries.ts`,
  and pass the rows to the sections in place of `lib/offer.ts` and `lib/colorways.ts`. Keep `formatPrice`.
- Edition meter: count the rows of the `reservations` table in place of `RESERVED_COUNT`.
- Reservation: the page posts no data. The reserve button opens a `mailto:` note with the colorway and the quantity.
  A real reservation form goes in `components/reserve-section.tsx`: name, email, colorway, and quantity.
  Follow "Public form contract" in `CLAUDE.md`: one `reservations` table, one RPC, one server function, and the honeypot field.
  The RPC checks the stock and the limit of two lamps again. Then the page shows the lamp number.
- Payment: add a checkout only after the reservation works. The page says "nothing due today", so change that text too.
- Newsletter: the footer letter is a `mailto:` link. A real list needs a `subscribers` table and the same form contract.
- Reviews: the `reviews` group holds three quotes. For more, create a `reviews` table with public rows.
- A second language: follow "Languages" in `CLAUDE.md`. The page uses logical classes, so Arabic works.
