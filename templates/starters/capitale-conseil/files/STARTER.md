# Capitale Conseil

A website starter for a strategy consulting and asset management firm. It has one public page.
The firm, the partners, the client, the figures, the address, the telephone, and the email are fictional sample content.

## Pages and routes

- `/` is the home page. `src/routes/index.tsx` sets the page title and renders `LandingPage`.
- `/login`, `/app`, and `/app/profile` are the base pages. The home page has no link to them.

## Where the code is

All of the page is in `src/features/landing/`.

- `components/landing-page.tsx` stacks the sections in this order:
  header, hero, the firm (01), practices (02), figures (03), references (04), quote, partners, head office, contact (05), footer.
- Each section is one file in `components/`, for example `practices-section.tsx`.
- `components/index-spine.tsx` is the fixed rail of the five numerals. `movement-counter.tsx` is the "03 / 05" counter of the header.
- `components/duotone-plate.tsx` is the navy photo plate with its caption. `figure-row.tsx` is one counted figure of the deep band.
- `components/meeting-brief.tsx` is the request plate of the contact section. `site-menu.tsx` is the phone menu.
- `lib/content.ts` holds the lists: the five movements, the practices, the counted figures, the partners, and the subjects.
- `lib/type-styles.ts` holds the class strings of the labels, the titles, and the buttons.
- `landing.css` holds the page measures, the mixed colors, the duotone plate, and the reveal states.
- `hooks/` holds the scroll hooks. `use-scroll-reveal.ts` shows each block when the visitor scrolls to it.
  The other hooks read the scroll for the counter, the spine, the reading hairline, and the counted figures.

## Sample content

- Every text is in `src/shared/i18n/messages.ts`, in the groups `site`, `hero`, `firm`, `practices`, `figures`,
  `references`, `quote`, `partners`, `office`, `contact`, and `footer`. Change a text there, not in a component.
- The telephone and the email are in the `site` group: `phoneDisplay`, `phoneHref`, and `email`. They are samples: replace them before you publish.
- The three counted figures are numbers in `PULL_FIGURES` of `lib/content.ts`. Their units and signs are texts in the `figures` group.
  The hero row shows three other facts of the firm, as texts in the `hero` group (`hero.fig1Value` to `hero.fig3Label`).
- The three photos are in `public/images/`. To change a photo, replace the file or change its path in the section file.
  Give each new photo its `width`, `height`, `alt` text, and a caption with a place and a year. The CSS prints every photo in the two navy inks.
- The site icon is `public/favicon.svg`.

## The look

- `src/styles/theme.json` holds the colors and the fonts. Only the host writes it. Change the look with the theme tool.
- The page uses token classes only: `bg-background` (paper), `bg-foreground` (the deep band), `text-primary` (navy), and `text-warning` (copper).
  `landing.css` mixes the steel ground and the band inks from the same tokens.
- The world rules stay: square corners, no shadow, no gradient, no card, no text on a photo, a label on a dash,
  a number with its unit in each section, and copper in two places only (the current spine numeral and the last base rule).

## How to make each part real

- Firm facts: replace the texts of the `site`, `firm`, `contact`, and `footer` groups with the real name, address, hours, and legal line.
- Practices: each row is one entry of `PRACTICES` and one text group `practices.<id>`. Keep the sum of the mandate counts equal to the figure.
- Figures: change the values in `PULL_FIGURES` and the texts `figures.<id>`. The page formats each value in the locale of the visitor.
- References: the case study is the `references` group. For more than one case, create a `mandates` table with public rows,
  read it with `queryOptions` in `api/mandates.queries.ts`, and render one dossier for each row.
- Partners: each column is one id in `PARTNER_IDS` and one text group `partners.<id>`.
- Contact: the request plate posts no data. It keeps the picked subject in state, and its action is a `mailto:` link.
  A real form goes in `components/meeting-brief.tsx`: name, telephone, company, subject, and two lines of text.
  Follow "Public form contract" in `CLAUDE.md`: one `meeting_requests` table, one RPC, one server function, and the honeypot field.
  After a valid submit, replace the form with a bordered plate that shows a reference number and the next step.
- A second language: follow "Languages" in `CLAUDE.md`. The page uses logical classes, so Arabic works.
