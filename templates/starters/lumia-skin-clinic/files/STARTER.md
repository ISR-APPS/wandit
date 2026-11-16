# Clinique Lumia: starter notes

This project starts from the starter template "Clinique Lumia".
It is a one-page website for a dermatology and skin clinic. The look is the design world "Éclat".
All names, prices, the address, the telephone, and the email are fictional. Replace them with the real facts.

## Pages and routes

- `/`: the home page. The build prerenders it.
- `/login`, `/app`, and `/app/profile` come from the base template. The home page does not link to them.

## Where the content lives

- Text: `src/shared/i18n/messages.ts`, groups `site` to `footer`. Every string of the page is there.
- Telephone and email: `site.phoneDisplay`, `site.phoneHref`, `site.emailDisplay`, `site.emailHref`.
- Prices and durations: the `care` group. Prices are in DZD, as text.
- Photos: `public/images/*.webp`. `src/features/landing/lib/photos.ts` lists each file with its pixel size.
- Page code: `src/features/landing/`. One file per section in `components/`.
- Page colors and motion: `src/features/landing/landing.css`. All colors mix the theme tokens.

## Sections, in page order

1. Hero: the claim, four drifting photos, three badges, and the booking capsule.
2. Treatments (`#care`): three cards with a price and a duration.
3. The ritual (`#ritual`): four numbered steps on a center axis.
4. The window: one large photo with a caption capsule.
5. The doctor (`#doctor`): portrait, biography, quote, three figures, council badge.
6. Booking (`#contact`): telephone and email actions, the address, and the hours.

## Motion

- The hero photos drift with CSS keyframes.
- From 1024px, `hooks/use-orbit-scrub.ts` turns the photos one place while the hero scrolls away.
- `hooks/use-scroll-reveal.ts` blooms each section when it enters the screen.
- With reduced motion, or with no script, the page shows still and complete.

## How to make each part real

- Real photos: put the files in `public/images/`, then update the sizes in `lib/photos.ts`.
  Keep one warm, golden grade on all photos.
- A booking form: the page has no form now. Put it in `components/contact-section.tsx`, in the blush panel.
  Follow "Public form contract" in `CLAUDE.md`: one table, one RPC, one server function, and the honeypot.
  Use the three items of "What to tell us" as the fields: name and telephone, treatment, preferred times.
- A list of treatments from the database: make a `treatments` table that anyone may read.
  Read it with a query in `src/features/landing/api/`, and render one `CareCard` per row.
- A second language: follow "Languages" in `CLAUDE.md`. The page uses logical classes, so Arabic works.
