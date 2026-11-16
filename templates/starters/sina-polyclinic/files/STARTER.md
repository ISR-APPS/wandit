# Sina Polyclinic

A website starter for a multi-specialty clinic. It has one public page.
The clinic, the practitioners, the fees, the address, the telephone, and the email are fictional sample content.

## Pages and routes

- `/` is the home page. `src/routes/index.tsx` sets the page title and renders `LandingPage`.
- `/login`, `/app`, and `/app/profile` are the base pages. The home page has no link to them.

## Where the code is

All of the page is in `src/features/landing/`.

- `components/landing-page.tsx` stacks the sections in this order:
  header, hero, specialties, figures, practitioners, oath, booking, questions, footer.
- Each section is one file in `components/`, for example `specialties-section.tsx`.
- `components/vitals-line.tsx` is the ECG line that divides the page. `components/pulse-glyph.tsx` is the small beat of the wordmark.
- `components/photo-plate.tsx` is the framed photo with its corner tick and its caption.
- `components/slot-picker.tsx` is the booking plate. `components/mobile-menu.tsx` is the phone menu.
- `lib/content.ts` holds the lists: the section links, the specialties, the practitioners, the days, and the slots.
- `lib/type-styles.ts` holds the class strings of the labels, the titles, the plates, and the buttons.
- `landing.css` holds the mixed colors, the corner tick, the entrances, the slot chips, and the FAQ mark.
- `hooks/use-scroll-reveal.ts` shows each block when the visitor scrolls to it.
- `hooks/use-beat-progress.ts` draws the trace of the deep band and counts its four figures during the scroll.

## Sample content

- Every text is in `src/shared/i18n/messages.ts`, in the groups `site`, `hero`, `specialties`, `figures`,
  `team`, `oath`, `booking`, `access`, `faq`, and `footer`. Change a text there, not in a component.
- The telephone and the email are in the `site` group: `phoneDisplay`, `phoneHref`, and `email`.
- The four counted figures are numbers in `COUNTED_FIGURES` of `lib/content.ts`.
- The four photos are in `public/images/`. To change a photo, replace the file or change its path in the section file.
  Give each new photo its `width`, `height`, `alt` text, and a caption with a place and an hour.
- The site icon is `public/favicon.svg`.

## The look

- `src/styles/theme.json` holds the colors and the fonts. Only the host writes it. Change the look with the theme tool.
- The page uses token classes only: `bg-background`, `bg-card` (plates), `text-primary` (teal), and `text-muted-foreground`.
  `landing.css` mixes the deep band, the quiet bands, and the deep teal from the same tokens.
- The world rules stay: flat hairline plates with a teal corner tick, no shadow, no gradient, no italics,
  one deep band, a duration and a fee on every specialty row, and no text on a photo.

## How to make each part real

- Clinic facts: replace the texts of the `site`, `access`, and `footer` groups with the real address, hours, and notices.
- Specialties: each row is one id in `SPECIALTY_IDS` and one text group `specialties.<id>`.
  For a list that the clinic edits, create a `specialties` table, and read it with `queryOptions` in `api/specialties.queries.ts`.
- Practitioners: each card is one id in `PRACTITIONER_IDS` and one text group `team.<id>`. A `practitioners` table replaces both.
- Figures: the band shows the register of last year. Each January, update the totals in `COUNTED_FIGURES`
  and the count of years in `figures.title`.
- Booking: the slot picker posts no data. It keeps the choice in state, and its action is a `mailto:` link with the request.
  The sample slots are `BOOKING_SLOTS` in `lib/content.ts`. `BOOKING_DAYS_BY_SPECIALTY` lists the consulting days
  of each specialty. Keep it equal to the days of the practitioner cards.
  A real booking form goes in `components/slot-picker.tsx`: add the name and telephone fields, and a submit button.
  Follow "Public form contract" in `CLAUDE.md`: one `appointments` table, one RPC, one server function, and the honeypot field.
  Real free slots come from a table that the front desk edits behind sign-in.
- Questions: each question is one id in `QUESTION_COLUMNS` and one text group `faq.<id>`.
- A second language: follow "Languages" in `CLAUDE.md`. The page uses logical classes, so Arabic works.
