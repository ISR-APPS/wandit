# SAUCE!

A website starter for a smash burger counter. It has one public page.
The restaurant, the menu, the prices, the client, the address, the telephone, and the email are fictional sample content.

## Pages and routes

- `/` is the home page. `src/routes/index.tsx` sets the page title and renders `LandingPage`.
- `/login`, `/app`, and `/app/profile` are the base pages. The home page has no link to them.

## Where the code is

All of the page is in `src/features/landing/`.

- `components/landing-page.tsx` stacks the sections in this order:
  header, hero, info band, menu, exploded burger, sauces, drive, shakes and sides, order, footer.
- Each section is one file in `components/`, for example `menu-section.tsx`.
- `components/site-menu.tsx` is the section menu of the phone header. It opens a side panel.
- `components/drip-edge.tsx` draws the sauce runs at the top of a section. `lib/drip-paths.ts` holds its three drawings.
- `components/price.tsx` formats each price. `components/price-board.tsx` is the list with the price first.
- `lib/content.ts` holds the menu: burgers, combos, sauces, shakes, sides, and the six layers of the Double.
- `lib/type-styles.ts` holds the class strings of the labels, the titles, and the buttons.
- `landing.css` holds the mustard color, the entrances, and the sticky exploded burger.

## The exploded burger

- `components/exploded-section.tsx` and `components/exploded-stack.tsx` cut one photo into six slices.
- `hooks/use-sticky-progress.ts` writes the scroll progress into the CSS variable `--sc-progress`.
- From 901px the whole red field sticks under the header while the burger opens. On a phone only the stack sticks.
- A full-page capture thus shows an empty red area under the burger: the scroll track. This is correct.
- Reduced motion gives a normal height. No script keeps the track. Both show the open stack (`--sc-progress` is 1).
- A new burger photo needs new cuts in `BURGER_LAYERS` (`lib/content.ts`). Keep its ratio 3:4, or change `--sc-bh`.

## Sample content

- Every text is in `src/shared/i18n/messages.ts`, in the groups `site`, `hero`, `band`, `menu`, `exploded`,
  `sauces`, `drive`, `sides`, `order`, and `footer`. Change a text there, not in a component.
- The prices are numbers in `lib/content.ts`, in Algerian dinars. The currency label is `site.currency`.
- The telephone and the email are only in the `site` group: `phoneDisplay`, `phoneHref`, `email`, `emailHref`.
- The five photos are in `public/images/`. Give each new photo its `width`, `height`, and `alt` text.
- The site icon is `public/favicon.svg`.

## The look

- `src/styles/theme.json` holds the colors and the fonts. Only the host writes it. Change the look with the theme tool.
- The page uses token classes only: `bg-background` (cream), `bg-primary` (the hot accent), and `bg-foreground` (ink).
- The mustard is `--sc-mustard` in `landing.css`: a mix of the `warning`, `success`, and `card` tokens.
  Text on the red ground uses `--sc-mustard-on-hot` at 24px or more. Small text there is white.
- The world rules stay: flat colors, square corners, no shadow, prices in the display face, a drip at each ground change.

## How to make each part real

- Restaurant facts: replace the texts of the `site`, `band`, `order`, and `footer` groups with the real ones.
- Menu: change `lib/content.ts` and the names in `messages.ts`. For a menu that the owner edits, create the tables
  `menu_items` and `combos`, and read them with `queryOptions` in `api/menu.queries.ts`.
- Order: the section posts no data. Its actions are a `tel:` link and a `mailto:` link, and the slip shows a sample call.
  A real order form goes in `components/order-section.tsx`, in the place of the slip (name, telephone, time, mode, order).
  Follow "Public form contract" in `CLAUDE.md`: one `orders` table, one RPC, one server function, and the honeypot field.
- Quote: replace the client line of the `drive` group with a real one, or remove `components/quote-band.tsx`.
- A second language: follow "Languages" in `CLAUDE.md`. The page uses logical classes, so Arabic works.
