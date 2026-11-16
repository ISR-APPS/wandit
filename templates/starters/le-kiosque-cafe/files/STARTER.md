# Le Kiosque

A website starter for a coffee bar and roaster. The page is one edition of the café's own newspaper.
The café, the people, the prices, the address, the telephone, and the email are fictional sample content.

## Pages and routes

- `/` is the home page. `src/routes/index.tsx` sets the title, the description, and the icon, and renders `LandingPage`.
- `/login`, `/app`, and `/app/profile` are the base pages. The home page has no link to them.

## Where the code is

All of the page is in `src/features/landing/`.

- `components/landing-page.tsx` stacks the parts in this order: masthead, front page (p. 1), the roast (p. 2),
  the press showpiece, the stop-press band, the menu (p. 3), the archives (p. 4), the newsroom, the letters (p. 5), the imprint.
- Each part is one file in `components/`. `section-menu.tsx` is the "Sections" panel of the phone masthead.
- The drawings are SVG plates: `storefront-plate.tsx`, `cup-plate.tsx`, `portrait-plate.tsx`, `roaster-plate.tsx`.
  `halftone-defs.tsx` holds the three dot screens that they fill from. The page has no photo.
- `lib/content.ts` holds the lists: rubrics and page numbers, briefs, menu and prices, figures, past editions, newsroom.
- `lib/type-styles.ts` holds the class strings of the furniture, the headlines, the captions, and the buttons.
- `kiosque.css` holds the ruled columns, the hairline colors, and the motion.

## The motion

- The masthead and the front page roll in with a CSS animation at load. No script hides them.
- `hooks/use-press-roll.ts` reveals each inside page when it scrolls into view: the bar wipes, then the blocks rise.
- `hooks/use-edition-press.ts` composes tomorrow's front page with the scroll, pinned for two screens when it fits (a timed play under 768px).
  The portrait develops dot by dot, and the proof stamp fades last. The progress only grows.
- With no script, or with reduced motion, every block shows and the edition is printed, with the proof stamp on it.

## Sample content

- Every text is in `src/shared/i18n/messages.ts`, in the groups `site`, `front`, `roast`, `press`, `stopPress`,
  `menu`, `archives`, `newsroom`, `letters`, and `imprint`. Change a text there, not in a component.
- The furniture must agree: the edition number (142), the date, the weather line, the €2 coffee, and the page numbers
  of the jump lines. When you change one, change the others in the same groups.
- Prices are numbers in euros in `MENU` of `lib/content.ts`. `components/price.tsx` formats them.
- The telephone and the email are in the `site` group: `phoneDisplay`, `phoneHref`, `email`, `emailHref`.

## The look

- `src/styles/theme.json` holds the colors and the fonts (world "gazette"). Only the host writes it.
- Paper is `background`, the deeper stock is `canvas`, ink is `foreground`, and brick is `primary`.
- The masthead and the headlines use `font-display` (Playfair Display). The furniture uses `font-sans`.
- The prose uses the news serif of the theme (the app heading face, Newsreader), through `--ks-serif` in `kiosque.css`.
- Keep the world rules: square corners, no shadow, one ink band, brick only on slugs, jump lines, and one button.

## How to make each part real

- Café facts: replace the texts of the `site`, `front`, `letters`, and `imprint` groups with the real ones.
- Menu: change `MENU` in `lib/content.ts` and the names in `messages.ts`. For a menu that the owner edits,
  create a `menu_items` table and read it with `queryOptions` in `api/menu.queries.ts`.
- Past editions and briefs: `PAST_EDITIONS` and `BRIEFS` can become `editions` and `briefs` tables in the same way.
- Letters: the coupon posts no data. Its actions are `mailto:` links with a subject and a `tel:` link.
  A real form goes in `components/letters-coupon.tsx` (name, telephone, subject, letter).
  Follow "Public form contract" in `CLAUDE.md`: one table, one RPC, one server function, and the honeypot field.
- Drawings: a new plate is an SVG component that fills from `HALFTONE` and uses `currentColor` for ink.
