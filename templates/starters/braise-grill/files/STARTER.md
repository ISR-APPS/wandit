# Braise

A website starter for a charcoal grill house. It has one public page.
The restaurant, the chef, the menu, the prices, the guest quote, the address, the telephone, and the email are fictional sample content.

## Pages and routes

- `/` is the home page. `src/routes/index.tsx` sets the page title, the description, and the icon, and renders `LandingPage`.
- `/login`, `/app`, and `/app/profile` are the base pages. The home page has no link to them.

## Where the code is

All of the page is in `src/features/landing/`.

- `components/landing-page.tsx` stacks the sections in this order:
  header, hero, hearth, menu, chef, room, evening, booking, footer.
- Each section is one file in `components/`, for example `menu-section.tsx`.
- `components/site-menu.tsx` is the section menu of the phone header. It opens a side panel.
- `components/menu-slate.tsx` and `components/feast-slate.tsx` are the charcoal slates of the menu.
- `components/smoke-rail.tsx` draws the rising smoke line beside the menu.
- `lib/content.ts` holds the lists: section links, menu slates and prices, ledger, facts, register, evening, booking rows.
- `NAV_LINKS` is in page order, because the phone menu numbers the links like the section eyebrows. `isInHeader` picks the desktop links.
- `lib/type-styles.ts` holds the class strings of the labels, the titles, the prose, and the buttons.
- `landing.css` holds the world layouts (hero seam, bled photos, smoke rail) and the motion.

## The motion

- `hooks/use-scroll-reveal.ts` fades in the blocks below the first screen and draws the ember underlines.
- `hooks/use-smoke-scrub.ts` draws the smoke line with the scroll and lights each slate through `--br-lit`.
- The smoke only rises: a lit slate stays lit when the visitor scrolls back up.
- With no script, or with reduced motion, every block shows, every slate is lit, and the smoke line is complete.

## Sample content

- Every text is in `src/shared/i18n/messages.ts`, in the groups `site`, `hero`, `hearth`, `menu`, `chef`,
  `room`, `evening`, `booking`, and `footer`. Change a text there, not in a component.
- The prices are numbers in `lib/content.ts`, in Algerian dinars. `components/price.tsx` formats them.
- The telephone and the email are in the `site` group: `phoneDisplay`, `phoneHref`, `email`, `emailHref`.
- The five photos are in `public/images/`. Give each new photo its `width`, `height`, and `alt` text.
- The site icon is `public/favicon.svg`.

## The look

- `src/styles/theme.json` holds the colors and the fonts. Only the host writes it. Change the look with the theme tool.
- The page uses token classes only. `landing.css` mixes the tokens for the ash panel, the hot ember, and the hairlines.
- The world rules stay: one ember accent, one underline gradient, chalk prices on dark slates, captions under photos.

## How to make each part real

- Restaurant facts: replace the texts of the `site`, `hero`, `booking`, and `footer` groups with the real ones.
- Menu: change `MENU_SLATES` in `lib/content.ts` and the dish names in `messages.ts`. For a menu that the owner edits,
  create a `menu_items` table, and read it with `queryOptions` in `api/menu.queries.ts`.
- Ageing register: `REGISTER_ROWS` in `lib/content.ts` becomes a `register_cuts` table in the same way.
- Booking: the section posts no data. Its actions are a `tel:` link and a `mailto:` link.
  A real booking form goes in `components/booking-section.tsx`, on the slate (name, telephone, date, sitting, guests, note).
  Follow "Public form contract" in `CLAUDE.md`: one `bookings` table, one RPC, one server function, and the honeypot field.
- Quote: replace the guest line of the `booking` group with a real one, or remove the `<figure>` of the quote.
- Photos: replace the files in `public/images/` with photos of the real house.
- A second language: follow "Languages" in `CLAUDE.md`. The page uses logical classes, so Arabic works.
