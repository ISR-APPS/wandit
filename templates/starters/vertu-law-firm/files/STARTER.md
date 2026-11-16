# Vertu & Associés

A website starter for a law firm. It has one public page in the "cabinet" design world: deep green, flat brass, and a serif.
The firm, the partners, the associates, the client quote, the figures, the address, the telephone, and the email are fictional sample content.

## Pages and routes

- `/` is the home page. `src/routes/index.tsx` sets the page title, the description, and the icon, then renders `LandingPage`.
- `/login`, `/app`, and `/app/profile` are the base pages. The home page has no link to them.

## Where the code is

All of the page is in `src/features/landing/`.

- `components/landing-page.tsx` stacks the sections in this order:
  header, hero, the firm (Art. 1 to 4), practice areas, the team, fees (Art. 5), references, consultation (Art. 6), footer (Art. 7).
- Each section is one file in `components/`, for example `fees-section.tsx`.
- Shared parts: `dossier-tab.tsx` (the trapezoid tab), `clause-head.tsx` ("Art. n — title"), `nameplate.tsx` (the brass plate with four screws),
  `filing-drawer.tsx` (the drawn drawer of the hero), `section-head.tsx` (the tab on the rule at the top of each section).
- `practices-section.tsx` is the drawer: `practice-folder.tsx` is one folder, `practice-panel.tsx` is one panel.
- `request-folder.tsx` and `choice-group.tsx` are the consultation request. `site-menu.tsx` is the phone menu.
- `lib/content.ts` holds the lists: sections, house rules, practice ids, partners, associates, fee lines, steps, figures, and matters.
- `landing.css` holds the tabs, the plates, the folders, the drawer colors, the two grounds, and the x-only entrances.
- `hooks/` holds the scroll hooks: the reveals, the current practice folder, and the fan of the folder tabs.

## Sample content

- Every text is in `src/shared/i18n/messages.ts`, in the groups `site`, `clause`, `hero`, `firm`, `practices`, `team`, `fees`,
  `references`, `contact`, and `footer`. Change a text there, not in a component.
- The telephone, the email, the address, the hours, and the bar number are in the `site` group.
- The fees are texts in the `fees` group. A new fee line is one entry in `FEE_LINES` and its texts.
- There is no photo. The world uses drawn objects only. The site icon is `public/favicon.svg`.

## The look

- `src/styles/theme.json` holds the colors and the fonts. Only the host writes it. Change the look with the theme tool.
- `landing.css` mixes the page inks from the tokens: `--background` is the green room, `--card` the raised file,
  `--canvas` the recess, `--foreground` the cream ink (and the ground of the two cream sections), and `--primary` the brass.
- The world rules stay: 1px rules only (the quote bar is the one 3px mark), tab-topped heads, an unbroken Art. 1 to Art. 7 sequence,
  four screws on every plate, motion on the x axis only, and no loop.

## How to make each part real

- Firm facts: replace the texts of the `site`, `firm`, `contact`, and `footer` groups with the real name, address, hours, and legal line.
- Team: each plate is one entry of `PARTNERS` and its texts. For a team that changes often, create a `lawyers` table with public rows,
  read it with `queryOptions` in `api/lawyers.queries.ts`, and map the rows in `team-section.tsx`.
- Practice areas: each folder is one id in `PRACTICE_IDS` and one text group `practices.<id>`.
- Consultation: the request posts no data. It keeps the two choices in state and fills a `mailto:` link.
  A real form goes in `components/request-folder.tsx`: name, telephone, email, matter, other party, and two lines of text.
  Follow "Public form contract" in `CLAUDE.md`: one `consultation_requests` table, one RPC, one server function, and the honeypot field.
  After a valid submit, replace the form with a reference number, the call-back delay, and what the office will not ask.
- A second language: follow "Languages" in `CLAUDE.md`. The page uses logical classes, so Arabic works.
