# MERIDIAN

A website starter for a private brokerage of landmark modern houses. It has one public page, dark and cinematic,
set like an architectural monograph. The brokerage, the houses, the prices, the people, the emails,
and the telephone number are fictional sample content.

## Pages and routes

- `/` is the home page. `src/routes/index.tsx` sets the page title and the icon, and renders `LandingPage`.
- `/login`, `/app`, and `/app/profile` are the base pages. The home page has no link to them.

## Where the code is

All of the page is in `src/features/landing/`.

- `components/landing-page.tsx` stacks the parts in this order:
  header, hero, intro, portfolio, residence, numbers, contact, footer.
- Each part is one file in `components/`, for example `portfolio-section.tsx`.
- `components/site-menu.tsx` is the section menu of a phone. It uses the `Sheet` of the kit.
- `components/property-panel.tsx` draws one house of the portfolio.
- `lib/content.ts` lists the section links, the houses, the residence facts, the figures, and the viewing choices.
- `lib/format.ts` formats the prices and the figures with `Intl.NumberFormat`.
- `landing.css` holds the film grain, the hero grade, the reveal states, and the portfolio row.

## The motion

- The hero title rises and the photo settles with CSS keyframes only. With no script, the page is complete.
- `hooks/use-scroll-reveal.ts` reveals each `[data-reveal]` block once, when it enters the view.
- `hooks/use-parallax.ts` moves the hero photo and the residence photo on scroll.
- `hooks/use-header-state.ts` makes the header solid after a short scroll and hides it on a scroll down.
- From 768 px the portfolio is a sideways scroll-snap row. `hooks/use-portfolio-row.ts` drives its rule,
  its count, and its arrows. On a phone the houses stack.
- With reduced motion, nothing moves and every block is visible.

## Sample content

- Every text is in `src/shared/i18n/messages.ts`, in the groups `site`, `nav`, `hero`, `intro`,
  `portfolio`, `residence`, `numbers`, `contact`, and `footer`. Change a text there, not in a component.
- The emails and the telephone are in the `site` group. The site icon is `public/favicon.svg`.
- The photos are in `public/images/`. Keep the `width` and `height` of each `<img>` true when you replace one.

## The look

- `src/styles/theme.json` holds the colors and the fonts (world "monographe"). Only the host writes it.
- Fraunces is the display face (`font-display`). Instrument Sans is the text face (`font-sans`).
- The bronze `primary` marks one italic word in each title, the tick rules, and the prices. Keep that limit.
- No shadows, no rounded cards. Hairlines (`border-foreground/8`, `/14`) and tone steps
  (`bg-card`, `bg-canvas`) separate the sections.

## How to make each part real

- Houses: create a `houses` table and read it with `queryOptions` in `api/houses.queries.ts`.
  Map each row to the `PortfolioHouse` type of `lib/content.ts`, and keep the message keys for the labels only.
- Residence and figures: change `RESIDENCE_FACTS` and `STUDIO_FIGURES` in `lib/content.ts`.
  Keep the figures in the `intro` group equal to the numbers band (140 houses, since 2009).
- Viewing request: the section posts no data. `components/viewing-note.tsx` writes the subject
  and opens a `mailto:` link. A real form goes in that file. Follow "Public form contract" in `CLAUDE.md`:
  one table, one RPC, one server function, and the honeypot field.
- A second language: follow "Languages" in `CLAUDE.md`. The page uses logical classes, so Arabic works.
