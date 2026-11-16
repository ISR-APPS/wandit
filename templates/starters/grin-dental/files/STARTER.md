# Grin Dental Studio

A website starter for a family and kids dental studio. It has one public page in a sticker-book style.
The studio, the team, the prices, the reviews, the address, the telephone, and the email are fictional sample content.
The page has no photos. All art is inline SVG: Chompy the tooth, the team portraits, the icons, and the stickers.

## Pages and routes

- `/` is the home page. `src/routes/index.tsx` sets the title, the description, and the icon, and renders `LandingPage`.
- `/login`, `/app`, and `/app/profile` are the base pages. The home page has no link to them.

## Where the code is

All of the page is in `src/features/landing/`.

- `components/landing-page.tsx` stacks the sections in this order: header, hero, marquee, services,
  first visit, stats, team, prices, reviews, Grin Club, booking, footer.
- Each section is one file in `components/`, for example `prices-section.tsx`.
- `components/site-menu.tsx` is the section menu of the phone header. It opens a side panel.
- `components/chompy-stage.tsx` is the hero art. Chompy is a button: a press gives confetti and a new phrase.
- `lib/content.ts` holds the lists: links, services, visit steps, stats, team, price rows, reviews, club perks, booking choices.
- `lib/styles.ts` holds the shared class strings of the titles, tags, pills, and buttons.
- `landing.css` holds the sticker recipes (outline, hard shadow, die-cut line), the color mixes, and the motion.

## The motion

- `hooks/use-pop-in.ts` pops in the blocks below the first screen once.
- `hooks/use-visit-path.ts` draws the dotted path of the first visit with the scroll, from 1024 px, and walks a tooth on it.
- `hooks/use-count-up.ts` counts the stats up once. `hooks/use-pupil-follow.ts` moves the eyes of Chompy with a mouse.
- With no script, or with reduced motion, every block shows, the path is complete, and nothing moves.

## Sample content

- Every text is in `src/shared/i18n/messages.ts`, in the groups `site`, `hero`, `chompy`, `marquee`, `services`,
  `visit`, `stats`, `team`, `prices`, `reviews`, `club`, `book`, and `footer`. Change a text there, not in a component.
- The telephone and the email are in the `site` group: `phoneDisplay`, `phoneHref`, `email`, `emailHref`.
- The site icon is `public/favicon.svg`.

## The look

- `src/styles/theme.json` holds the colors and the fonts. Only the host writes it. Change the look with the theme tool.
- `.gd-page` in `landing.css` mixes the theme tokens into the sun yellow, the teal, the peach, the mint, and four skin tones.
- The style rules stay: thick ink outlines, hard offset shadows, small tilts, and scalloped section edges.

## How to make each part real

- Studio facts: replace the texts of the `site`, `hero`, `book`, and `footer` groups with the real ones.
- Services and prices: change `SERVICES` and `MENU_ROWS` in `lib/content.ts` and their texts in `messages.ts`.
  For a list that the owner edits, create a `services` table and read it with `queryOptions` in `api/services.queries.ts`.
- Team: change `TEAM` in `lib/content.ts`. A real photo can replace `member-portrait.tsx`: WebP in `public/images/`, with `alt` text.
- Reviews: replace `REVIEWS` with real reviews that the families agreed to share.
- Booking: the section posts no data. `components/visit-request-card.tsx` builds a `mailto:` link from the chosen chips.
  A real booking form goes in that card (parent name, telephone, kid age, time, note).
  Follow "Public form contract" in `CLAUDE.md`: one `visit_requests` table, one RPC, one server function, and the honeypot field.
- Grin Club: the "Join the club" button opens a `mailto:` link to the studio email. A real sign-up needs a payment flow first.
- A second language: follow "Languages" in `CLAUDE.md`. The page uses logical classes, so Arabic works.
