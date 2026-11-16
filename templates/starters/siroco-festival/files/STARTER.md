# Festival Siroco

A website starter for a three-day music festival by the sea. It has one public page, made as a wall of flat posters.
The festival, the bands, the prices, the address, the telephone, and the email are fictional sample content.

## Pages and routes

- `/` is the home page. `src/routes/index.tsx` sets the page title and the icon, and renders `LandingPage`.
- `/login`, `/app`, and `/app/profile` are the base pages. The home page has no link to them.

## Where the code is

All of the page is in `src/features/landing/`.

- `components/landing-page.tsx` stacks the sheets in this order:
  header, hero (cream), manifesto (vermilion), headliners (four posters), programme (cobalt),
  tickets (mustard), info (cream), booking (vermilion), footer (ink).
- Each section is one file in `components/`, for example `programme-section.tsx`.
- `components/site-menu.tsx` is the section menu of the phone header. It opens a side panel.
- `components/fitted-line.tsx` draws one line of capitals at full width. `hooks/use-fit-lines.ts` corrects its size.
- `hooks/use-slab-reveal.ts` slides each `[data-slab]` element in when it enters the view.
- `lib/content.ts` holds the lists: section links, headliners, programme, passes, questions, booking steps.
- `landing.css` holds the four poster grounds, the ink swaps, the fitted lines, and the entrances.

## The headliner paste-up

- `components/headliners-section.tsx` renders four posters. Each poster is `position: sticky`,
  one pasted edge lower than the poster before it. It is CSS layout, so it works with no script and with reduced motion.
- Under the posters is the hold: a block with the count of the other bands and a link to the programme.
- A new headliner needs a fit share in `HEADLINERS` (`fit`, `stackFits`). An estimate is enough: the fit hook corrects it.

## Sample content

- Every text is in `src/shared/i18n/messages.ts`, in the groups `site`, `nav`, `hero`, `manifesto`,
  `headliners`, `programme`, `tickets`, `info`, `booking`, and `footer`. Change a text there, not in a component.
- The band count, 24, is in `site.metaDescription`, `hero.lede`, `hero.lineup`, `headliners.moreBands`,
  `programme.moreNote`, and `FACTS` of `manifesto-section.tsx`. Keep them equal.
- The prices are whole euros in `PASSES` (`lib/content.ts`). The set times are in `HEADLINERS` and `PROGRAMME`.
- The telephone and the email are in the `site` group: `phoneDisplay`, `phoneHref`, `email`, `emailHref`.
- The page has no photo. The giant `!`, `*`, `?`, and the arrow are its images. The site icon is `public/favicon.svg`.

## The look

- `src/styles/theme.json` holds the colors and the fonts. Only the host writes it. Change the look with the theme tool.
- Cream is `background`, ink is `foreground`, and cobalt is `primary`.
- Vermilion and mustard are `--sf-vermilion` and `--sf-mustard` in `landing.css`: mixes of the `destructive`,
  `warning`, `success`, and `background` tokens.
- The world rules stay: flat grounds, square corners, no shadow, 2px rules, prices and times in the display face.
  `public/favicon.svg` has fixed colors. Change it when the theme changes.

## How to make each part real

- Festival facts: replace the texts of the `site`, `hero`, `booking`, and `footer` groups with the real ones.
- Programme: for a programme that the team edits, create the tables `acts` and `passes`,
  and read them with `queryOptions` in `api/programme.queries.ts`. Keep the shapes of `lib/content.ts`.
- Booking: the section posts no data. Its actions are a `tel:` link and a `mailto:` link.
  A real booking form goes in `components/booking-section.tsx`, in the place of the three steps
  (name, telephone, email, pass). Follow "Public form contract" in `CLAUDE.md`: one `bookings` table,
  one RPC, one server function, and the honeypot field.
- A second language: follow "Languages" in `CLAUDE.md`. The page uses logical classes, so Arabic works.
