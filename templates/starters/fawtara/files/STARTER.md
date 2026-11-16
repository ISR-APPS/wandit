# Fawtara

A website starter for an invoicing product (SaaS). It has one public page.
The product, the figures, the prices, the customer quote, the address, the telephone, and the email are fictional sample content.

## Pages and routes

- `/` is the home page. `src/routes/index.tsx` sets the page title and renders `LandingPage`.
- `/login`, `/app`, and `/app/profile` are the base pages. The home page has no link to them.

## Where the code is

All of the page is in `src/features/landing/`.

- `components/landing-page.tsx` stacks the sections in this order:
  header, hero, numbers, product, money path, before and with, quote, pricing, FAQ, contact, footer.
- Each section is one file in `components/`, for example `pricing-section.tsx`.
- `components/hero-tableau.tsx` is the drawn product: one invoice card and two small cards.
- `components/product-section.tsx` is the pill-tab switcher. Three radio inputs hold the selected tab, so it needs no script.
- `components/path-diagram.tsx` is the money-path diagram of a wide screen. `components/path-rail.tsx` is its phone form.
  `lib/path-nodes.ts` lists the five nodes for both.
- `components/spot-illustration.tsx` holds the four two-tone drawings. `components/node-glyph.tsx` holds the node glyphs.
- `components/mobile-menu.tsx` is the section menu of a phone. `lib/sections.ts` lists the section links.
- `landing.css` holds the sky tints, the floating card, the two gradients, the tab slide, the diagram, and the motion.
- `hooks/use-scroll-reveal.ts` shows each block when the visitor scrolls to it.
- `hooks/use-scroll-progress.ts` draws the lit path of the diagram and moves the two small hero cards during a scroll.

## Sample content

- Every text is in `src/shared/i18n/messages.ts`, in the groups `site`, `hero`, `stats`, `product`, `path`,
  `compare`, `quote`, `pricing`, `faq`, `contact`, and `footer`. Change a text there, not in a component.
- The telephone and the email are in the `site` group: `phonePrefix`, `phoneDisplay`, `phoneHref`, `email`, `emailHref`.
- The invoice of the hero is in the `hero` group. Keep its figures correct: the total is the sum of the lines and the VAT.
- The same invoice number and the same amount are in the `path` group (the three result chips). Change them together.
- The page has no photo. Its images are drawings in code. The site icon is `public/favicon.svg`.

## The look

- `src/styles/theme.json` holds the colors and the fonts. Only the host writes it. Change the look with the theme tool.
- The page uses token classes only: `bg-card` (paper), `bg-background` (cool ground), `bg-accent` (sky),
  `text-primary` (blue), `bg-foreground` (the one dark band), and `text-muted-foreground`.
- The warm color has three uses: the marker under the blue word of the title, the last chip of the diagram,
  and the flag of the recommended price. Do not add a fourth use.
- Only cards have a shadow (class `fw-card`). Buttons and sections have none.
- The world rules stay: no photo, no icon row, one blue word in a title, one dark band, two price cards.

## How to make each part real

- Product facts: replace the texts of the `hero`, `stats`, `product`, `compare`, and `faq` groups with real facts.
- Prices: the two plans are in the `pricing` group and in `components/pricing-section.tsx`.
  For plans that change often, create a `plans` table, and read it with `queryOptions` in `api/plans.queries.ts`.
- Money path: change `lib/path-nodes.ts` and the `path` group. To move a node, change its place in `landing.css`
  (`fw-node-<id>`) and the end points of the curves in `components/path-diagram.tsx`.
- Quote: replace the `quote` group with a real customer quote, or remove `QuoteSection` from the page.
- Contact: the section posts no data. Its two actions are a `tel:` link and a `mailto:` link.
  A real call-back form goes in the card of `components/contact-section.tsx`, in the place of the four rows.
  Follow "Public form contract" in `CLAUDE.md`: one table, one RPC, one server function, and the honeypot field.
- Set-up buttons: each button leads to the contact section, where a person sets up the shop. When visitors can create an account,
  link the buttons to `/login`, and build the product behind `/app`.
- A second language: follow "Languages" in `CLAUDE.md`. The page uses logical classes, so Arabic works.
